import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { translations } from '@/i18n/translations';

const NOTIFICATION_ID_KEY = '@lingoleaf:daily_goal_notification_id';
const IMMEDIATE_FIRE_GUARD_MS = 60 * 1000;

interface ReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
  title: string;
  body: string;
  bodyOptions?: string[];
  requestPermissionIfNeeded?: boolean;
}

interface NotificationsModule {
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  scheduleNotificationAsync: (request: {
    content: { title: string; body: string; sound?: boolean };
    trigger: {
      type: 'calendar';
      weekday: number;
      hour: number;
      minute: number;
      second: number;
      repeats: true;
    };
  }) => Promise<string>;
  setNotificationHandler?: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }) => void;
}

function getNotificationsModule(): NotificationsModule | null {
  try {
    // Optional dependency so app remains stable if notifications package isn't installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

async function cancelExistingReminder(mod: NotificationsModule): Promise<void> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  if (!raw) return;

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      ids = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
  } catch {
    // Backward compatibility for previously stored single notification id.
    if (raw.length > 0) ids = [raw];
  }

  for (const id of ids) {
    try {
      await mod.cancelScheduledNotificationAsync(id);
    } catch (e) {
      logger.warn('Failed canceling previous daily reminder', e);
    }
  }

  await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
}

interface ReminderTrigger {
  type: 'calendar';
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  repeats: true;
}

function expoWeekdayFromDate(d: Date): number {
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  return jsDay + 1; // 1=Sun..7=Sat
}

function shouldIncludeTodayTrigger(now: Date, hour: number, minute: number): boolean {
  const todayTarget = new Date(now);
  todayTarget.setHours(hour, minute, 0, 0);
  return todayTarget.getTime() - now.getTime() > IMMEDIATE_FIRE_GUARD_MS;
}

export function buildDailyReminderTriggers(
  hour: number,
  minute: number,
  now: Date = new Date()
): ReminderTrigger[] {
  const normalizedHour = Math.max(0, Math.min(23, Math.round(hour)));
  const normalizedMinute = Math.max(0, Math.min(59, Math.round(minute)));
  const todayWeekday = expoWeekdayFromDate(now);
  const includeToday = shouldIncludeTodayTrigger(now, normalizedHour, normalizedMinute);
  const triggers: ReminderTrigger[] = [];

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    if (weekday === todayWeekday && !includeToday) {
      continue;
    }
    triggers.push({
      type: 'calendar',
      weekday,
      hour: normalizedHour,
      minute: normalizedMinute,
      second: 0,
      repeats: true,
    });
  }

  return triggers;
}

function normalizeReminderBodies(primaryBody: string, bodyOptions?: string[]): string[] {
  const trimmedPrimary = primaryBody.trim();
  const normalized = (bodyOptions ?? [])
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
  const appTitle = translations.en['app.title'];
  if (normalized.length === 0) {
    return trimmedPrimary.length > 0 ? [trimmedPrimary] : [appTitle];
  }
  return normalized;
}

function shuffleReminderBodies(
  bodies: string[],
  random: () => number = Math.random
): string[] {
  const shuffled = [...bodies];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[nextIndex];
    shuffled[nextIndex] = current;
  }
  return shuffled;
}

export function buildDailyReminderBodySchedule(
  triggerCount: number,
  body: string,
  bodyOptions?: string[],
  random: () => number = Math.random
): string[] {
  const options = normalizeReminderBodies(body, bodyOptions);
  if (triggerCount <= 0) return [];
  if (options.length === 1) return Array.from({ length: triggerCount }, () => options[0]);

  const shuffled = shuffleReminderBodies(options, random);
  return Array.from({ length: triggerCount }, (_, index) => shuffled[index % shuffled.length]);
}

export function initializeNotificationHandler(): void {
  const mod = getNotificationsModule();
  if (!mod?.setNotificationHandler) return;

  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestDailyGoalReminderPermission(
  requestIfNeeded: boolean = true
): Promise<'granted' | 'denied' | 'unavailable'> {
  const mod = getNotificationsModule();
  if (!mod) {
    return 'unavailable';
  }

  let permission = await mod.getPermissionsAsync();
  if (permission.status === 'granted') {
    return 'granted';
  }

  if (!requestIfNeeded) {
    return 'denied';
  }

  permission = await mod.requestPermissionsAsync();
  return permission.status === 'granted' ? 'granted' : 'denied';
}

export async function syncDailyGoalReminder(config: ReminderConfig): Promise<'scheduled' | 'disabled' | 'denied' | 'unavailable'> {
  const mod = getNotificationsModule();
  if (!mod) {
    return 'unavailable';
  }

  await cancelExistingReminder(mod);

  if (!config.enabled) {
    return 'disabled';
  }

  const permission = await requestDailyGoalReminderPermission(config.requestPermissionIfNeeded ?? true);
  if (permission !== 'granted') {
    return permission === 'unavailable' ? 'unavailable' : 'denied';
  }

  const triggers = buildDailyReminderTriggers(config.hour, config.minute);
  const bodies = buildDailyReminderBodySchedule(triggers.length, config.body, config.bodyOptions);
  const ids: string[] = [];
  for (const [index, trigger] of triggers.entries()) {
    const id = await mod.scheduleNotificationAsync({
      content: {
        title: config.title,
        body: bodies[index] ?? config.body,
        sound: true,
      },
      trigger,
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, JSON.stringify(ids));
  return 'scheduled';
}
