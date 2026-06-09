import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyGoalReadingEvent {
  userId: string;
  minutes: number;
  occurredAtIso: string;
}

type Listener = (event: DailyGoalReadingEvent) => void;

const listeners = new Set<Listener>();
const minutesCache = new Map<string, { dayKey: string; minutes: number }>();
const STORAGE_KEY_PREFIX = 'll_daily_goal_minutes';

function cacheKey(userId: string): string {
  return userId;
}

function storageKey(userId: string, dayKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}:${dayKey}`;
}

function normalizeMinutes(raw: unknown): number | null {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function setCachedDailyGoalMinutesMemory(userId: string, dayKey: string, minutes: number): number {
  const normalizedMinutes = Math.max(0, Math.floor(minutes));
  minutesCache.set(cacheKey(userId), {
    dayKey,
    minutes: normalizedMinutes,
  });
  return normalizedMinutes;
}

async function persistCachedDailyGoalMinutes(userId: string, dayKey: string, minutes: number): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId, dayKey), String(Math.max(0, Math.floor(minutes))));
  } catch {
    // best-effort
  }
}

export function getDateKey(iso: string, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date(iso));
  } catch {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export function getCachedDailyGoalMinutes(userId: string, dayKey: string): number | null {
  const cached = minutesCache.get(cacheKey(userId));
  if (!cached || cached.dayKey !== dayKey) return null;
  return cached.minutes;
}

export function setCachedDailyGoalMinutes(userId: string, dayKey: string, minutes: number): void {
  const normalizedMinutes = setCachedDailyGoalMinutesMemory(userId, dayKey, minutes);
  void persistCachedDailyGoalMinutes(userId, dayKey, normalizedMinutes);
}

export async function hydrateCachedDailyGoalMinutes(userId: string, dayKey: string): Promise<number | null> {
  const cached = getCachedDailyGoalMinutes(userId, dayKey);
  if (cached != null) return cached;

  try {
    const raw = await AsyncStorage.getItem(storageKey(userId, dayKey));
    const minutes = normalizeMinutes(raw);
    if (minutes == null) return null;
    return setCachedDailyGoalMinutesMemory(userId, dayKey, minutes);
  } catch {
    return null;
  }
}

export function incrementCachedDailyGoalMinutes(userId: string, dayKey: string, deltaMinutes: number): number {
  const current = getCachedDailyGoalMinutes(userId, dayKey) ?? 0;
  const next = Math.max(0, current + Math.max(0, Math.floor(deltaMinutes)));
  setCachedDailyGoalMinutes(userId, dayKey, next);
  return next;
}

export function emitDailyGoalReadingEvent(event: DailyGoalReadingEvent): void {
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    } catch {
      return 'America/Chicago';
    }
  })();
  const dayKey = getDateKey(event.occurredAtIso, timeZone);
  incrementCachedDailyGoalMinutes(event.userId, dayKey, event.minutes);

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // no-op
    }
  });
}

export function subscribeDailyGoalReadingEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
