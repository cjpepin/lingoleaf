/**
 * analytics/client
 *
 * Centralized analytics client with typed events, persisted queue, retry/backoff,
 * and development debug snapshot support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/supabase/client';
import { logger } from '@/utils/logger';
import { type EventName, type EventPayload, type CommonEventProperties, validatePayloadDev } from './events';
import { hashIdentifier, redactRouteParams, sanitizeProperties } from './privacy';

const STORAGE_KEYS = {
  queue: 'll_analytics_queue_v1',
  recent: 'll_analytics_recent_v1',
  deviceId: 'll_analytics_device_id',
  installId: 'll_analytics_install_id',
  optedOut: 'll_analytics_opted_out',
} as const;

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 15000;
const MAX_RECENT = 200;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

interface QueuedAnalyticsEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  event_name: EventName;
  event_version: number;
  properties: Record<string, unknown>;
  session_id: string;
  device_id: string;
  install_id: string;
  app_version: string;
  platform: string;
  locale: string;
}

export interface AnalyticsDebugSnapshot {
  queued: QueuedAnalyticsEvent[];
  recent: QueuedAnalyticsEvent[];
  opted_out: boolean;
  in_flight: boolean;
  last_flush_at: string | null;
}

type DebugListener = (snapshot: AnalyticsDebugSnapshot) => void;

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return (typeof value === 'object' && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
}

function getLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getAppVersion(): { appVersion: string; buildNumber: string } {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidBuild = Constants.expoConfig?.android?.versionCode;
  const buildNumber = Platform.OS === 'ios'
    ? (iosBuild ?? 'unknown')
    : (typeof androidBuild === 'number' ? String(androidBuild) : 'unknown');

  return { appVersion, buildNumber };
}

class AnalyticsClient {
  private initialized = false;
  private inFlight = false;
  private optedOut = false;
  private queue: QueuedAnalyticsEvent[] = [];
  private recent: QueuedAnalyticsEvent[] = [];
  private superProperties: Record<string, unknown> = {};
  private traits: Record<string, unknown> = {};
  private userId: string | null = null;
  private isPremium = false;
  private sessionId = randomId('sess');
  private deviceId = '';
  private installId = '';
  private backoffMs = 0;
  private nextAllowedFlushAt = 0;
  private lastFlushAt: string | null = null;
  private lastFailureTrackedAt = 0;
  private listeners = new Set<DebugListener>();

  async init(): Promise<void> {
    if (this.initialized) return;

    const [queueRaw, recentRaw, optedOutRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.queue),
      AsyncStorage.getItem(STORAGE_KEYS.recent),
      AsyncStorage.getItem(STORAGE_KEYS.optedOut),
    ]);

    this.queue = queueRaw ? (JSON.parse(queueRaw) as QueuedAnalyticsEvent[]) : [];
    this.recent = recentRaw ? (JSON.parse(recentRaw) as QueuedAnalyticsEvent[]) : [];
    this.optedOut = optedOutRaw === 'true';

    this.deviceId = await this.getOrCreateId(STORAGE_KEYS.deviceId, 'dev');
    this.installId = await this.getOrCreateId(STORAGE_KEYS.installId, 'ins');

    setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);

    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void this.flush();
      }
    });

    this.initialized = true;
    this.emitDebug();

    if (this.queue.length > 0 && !this.optedOut) {
      void this.flush();
    }
  }

  identify(userId: string | null, traits?: Record<string, unknown>): void {
    this.userId = userId;
    this.traits = asRecord(sanitizeProperties(traits ?? {}));
  }

  setPremium(isPremium: boolean): void {
    this.isPremium = isPremium;
  }

  setSuperProperties(props: Record<string, unknown>): void {
    const sanitized = asRecord(sanitizeProperties(props));
    this.superProperties = { ...this.superProperties, ...sanitized };
  }

  async reset(): Promise<void> {
    this.userId = null;
    this.traits = {};
    this.superProperties = {};
    this.sessionId = randomId('sess');
  }

  async optOut(): Promise<void> {
    this.optedOut = true;
    this.queue = [];
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.optedOut, 'true'),
      AsyncStorage.setItem(STORAGE_KEYS.queue, '[]'),
    ]);
    this.emitDebug();
  }

  async optIn(): Promise<void> {
    this.optedOut = false;
    await AsyncStorage.setItem(STORAGE_KEYS.optedOut, 'false');
    this.emitDebug();
  }

  isOptedOut(): boolean {
    return this.optedOut;
  }

  track<Name extends EventName>(name: Name, payload: EventPayload<Name>): void {
    try {
      validatePayloadDev(name, payload);
    } catch (error) {
      logger.error('Analytics payload validation failed', error);
      return;
    }

    if (this.optedOut) return;

    const common = this.getCommonProperties();
    const cleanPayload = asRecord(sanitizeProperties(payload));

    const event: QueuedAnalyticsEvent = {
      id: randomId('evt'),
      created_at: new Date().toISOString(),
      user_id: this.userId,
      event_name: name,
      event_version: 1,
      properties: {
        ...common,
        ...this.superProperties,
        ...this.traits,
        ...cleanPayload,
      },
      session_id: common.session_id,
      device_id: common.device_id,
      install_id: common.install_id,
      app_version: common.app_version,
      platform: common.platform,
      locale: common.locale,
    };

    this.enqueue(event);

    if (__DEV__) {
      logger.info('analytics.track', name, cleanPayload);
    }
  }

  screen(screenName: string, payload?: Record<string, unknown>): void {
    const safePayload = asRecord(sanitizeProperties(payload ?? {}));
    this.track('screen_viewed', {
      screen_name: screenName,
      route_params: safePayload,
    });

    if (__DEV__) {
      logger.info('analytics.screen', screenName, safePayload);
    }
  }

  getDebugSnapshot(): AnalyticsDebugSnapshot {
    return {
      queued: [...this.queue],
      recent: [...this.recent],
      opted_out: this.optedOut,
      in_flight: this.inFlight,
      last_flush_at: this.lastFlushAt,
    };
  }

  subscribeDebug(listener: DebugListener): () => void {
    this.listeners.add(listener);
    listener(this.getDebugSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async flush(force: boolean = false): Promise<void> {
    if (!this.initialized || this.optedOut || this.inFlight || this.queue.length === 0) return;
    if (!force && Date.now() < this.nextAllowedFlushAt) return;

    this.inFlight = true;
    this.emitDebug();

    const batch = this.queue.slice(0, BATCH_SIZE);

    try {
      const { error } = await supabase.functions.invoke('analytics-ingest', {
        body: { events: batch },
      });

      if (error) {
        throw error;
      }

      this.queue = this.queue.slice(batch.length);
      this.lastFlushAt = new Date().toISOString();
      this.backoffMs = 0;
      this.nextAllowedFlushAt = 0;
      await this.persistQueue();

      if (this.queue.length >= BATCH_SIZE) {
        this.inFlight = false;
        this.emitDebug();
        await this.flush(force);
        return;
      }
    } catch (error: any) {
      this.backoffMs = this.backoffMs > 0
        ? Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
        : BASE_BACKOFF_MS;
      this.nextAllowedFlushAt = Date.now() + this.backoffMs;

      if (Date.now() - this.lastFailureTrackedAt > 30000) {
        this.lastFailureTrackedAt = Date.now();
        this.track('analytics_flush_failed', {
          endpoint: 'analytics-ingest',
          code: String(error?.message ?? 'unknown_error'),
          source: 'analytics_client',
        });
      }

      logger.warn('Analytics flush failed', error);
    } finally {
      this.inFlight = false;
      this.emitDebug();
    }
  }

  private enqueue(event: QueuedAnalyticsEvent): void {
    this.queue.push(event);
    this.recent = [...this.recent, event].slice(-MAX_RECENT);

    void Promise.all([
      this.persistQueue(),
      AsyncStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(this.recent)),
    ]);

    this.emitDebug();

    if (this.queue.length >= BATCH_SIZE) {
      void this.flush();
    }
  }

  private async persistQueue(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(this.queue));
  }

  private getCommonProperties(): CommonEventProperties {
    const { appVersion, buildNumber } = getAppVersion();

    return {
      app_version: appVersion,
      build_number: buildNumber,
      platform: Platform.OS,
      locale: getLocale(),
      timezone: getTimezone(),
      is_premium: this.isPremium,
      session_id: this.sessionId,
      device_id: this.deviceId,
      install_id: this.installId,
    };
  }

  private async getOrCreateId(key: string, prefix: string): Promise<string> {
    const existing = await AsyncStorage.getItem(key);
    if (existing) return existing;

    const value = randomId(prefix);
    await AsyncStorage.setItem(key, value);
    return value;
  }

  private emitDebug(): void {
    const snapshot = this.getDebugSnapshot();
    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export const analyticsClient = new AnalyticsClient();

export function identify(userId: string | null, traits?: Record<string, unknown>): void {
  analyticsClient.identify(userId, traits);
}

export function setPremium(isPremium: boolean): void {
  analyticsClient.setPremium(isPremium);
}

export function track<Name extends EventName>(name: Name, payload: EventPayload<Name>): void {
  analyticsClient.track(name, payload);
}

export function screen(screenName: string, payload?: Record<string, unknown>): void {
  analyticsClient.screen(screenName, payload);
}

export function setSuperProperties(props: Record<string, unknown>): void {
  analyticsClient.setSuperProperties(props);
}

export async function reset(): Promise<void> {
  await analyticsClient.reset();
}

export async function optIn(): Promise<void> {
  await analyticsClient.optIn();
}

export async function optOut(): Promise<void> {
  await analyticsClient.optOut();
}

export function isOptedOut(): boolean {
  return analyticsClient.isOptedOut();
}

export async function flushAnalytics(force: boolean = false): Promise<void> {
  await analyticsClient.flush(force);
}

export function hashAnalyticsId(value: string): string {
  return hashIdentifier(value);
}

export function redactedScreenParams(params: unknown): Record<string, unknown> {
  return redactRouteParams(params);
}
