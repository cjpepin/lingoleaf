import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildDailyReminderBodySchedule,
  buildDailyReminderTriggers,
  requestDailyGoalReminderPermission,
  syncDailyGoalReminder,
} from '@/notifications/dailyGoalReminder';

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
}));

describe('dailyGoalReminder triggers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('schedules all weekdays when selected time is still ahead today', () => {
    const now = new Date(2026, 2, 4, 10, 0, 0);
    const triggers = buildDailyReminderTriggers(20, 0, now);

    expect(triggers).toHaveLength(7);
    expect(triggers.every((trigger) => trigger.type === 'calendar')).toBe(true);
    expect(triggers.every((trigger) => trigger.hour === 20 && trigger.minute === 0)).toBe(true);
  });

  it('skips today trigger when selected time has already passed to avoid immediate fire', () => {
    const now = new Date(2026, 2, 4, 20, 30, 0);
    const triggers = buildDailyReminderTriggers(20, 0, now);
    const todayWeekday = now.getDay() + 1;

    expect(triggers).toHaveLength(6);
    expect(triggers.some((trigger) => trigger.weekday === todayWeekday)).toBe(false);
  });

  it('skips today trigger when selected time is within the immediate fire guard', () => {
    const now = new Date(2026, 2, 4, 19, 59, 0);
    const triggers = buildDailyReminderTriggers(20, 0, now);
    const todayWeekday = now.getDay() + 1;

    expect(triggers).toHaveLength(6);
    expect(triggers.some((trigger) => trigger.weekday === todayWeekday)).toBe(false);
  });

  it('keeps today trigger when selected time is more than the immediate fire guard away', () => {
    const now = new Date(2026, 2, 4, 19, 58, 59);
    const triggers = buildDailyReminderTriggers(20, 0, now);
    const todayWeekday = now.getDay() + 1;

    expect(triggers).toHaveLength(7);
    expect(triggers.some((trigger) => trigger.weekday === todayWeekday)).toBe(true);
  });

  it('builds a shuffled reminder body schedule when options are provided', () => {
    const randomValues = [0.9, 0.3, 0.6, 0.1];
    const random = jest.fn(() => randomValues.shift() ?? 0);
    const bodies = buildDailyReminderBodySchedule(7, 'Default body', ['A', 'B', 'C', 'D', 'E'], random);

    expect(bodies).toEqual(['C', 'A', 'D', 'B', 'E', 'C', 'A']);
    expect(new Set(bodies).size).toBeGreaterThan(1);
  });

  it('falls back to default body when options are empty', () => {
    const bodies = buildDailyReminderBodySchedule(3, 'Default body', ['', '   ']);
    expect(bodies).toEqual(['Default body', 'Default body', 'Default body']);
  });
});

describe('syncDailyGoalReminder', () => {
  const NOTIFICATION_KEY = '@lingoleaf:daily_goal_notification_id';

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 4, 10, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels all existing reminders and does not schedule when disabled', async () => {
    await AsyncStorage.setItem(NOTIFICATION_KEY, JSON.stringify(['a', 'b', 'c']));

    const outcome = await syncDailyGoalReminder({
      enabled: false,
      hour: 20,
      minute: 0,
      title: 'LingoLeaf',
      body: 'Read today',
    });

    expect(outcome).toBe('disabled');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(NOTIFICATION_KEY)).toBeNull();
  });

  it('handles legacy single-id storage format when canceling reminders', async () => {
    await AsyncStorage.setItem(NOTIFICATION_KEY, 'legacy-id');

    const outcome = await syncDailyGoalReminder({
      enabled: false,
      hour: 20,
      minute: 0,
      title: 'LingoLeaf',
      body: 'Read today',
    });

    expect(outcome).toBe('disabled');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('legacy-id');
  });

  it('returns denied and avoids scheduling when permission is not granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const outcome = await syncDailyGoalReminder({
      enabled: true,
      hour: 20,
      minute: 0,
      title: 'LingoLeaf',
      body: 'Read today',
    });

    expect(outcome).toBe('denied');
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(NOTIFICATION_KEY)).toBeNull();
  });

  it('checks permission without prompting when silent permission sync is requested', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const outcome = await syncDailyGoalReminder({
      enabled: true,
      hour: 20,
      minute: 0,
      title: 'LingoLeaf',
      body: 'Read today',
      requestPermissionIfNeeded: false,
    });

    expect(outcome).toBe('denied');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules weekly reminders, rotates body copy, and persists ids', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockScheduleNotificationAsync.mockImplementation(
      async (request: { trigger: { weekday: number } }) => `id-${request.trigger.weekday}`
    );

    const outcome = await syncDailyGoalReminder({
      enabled: true,
      hour: 20,
      minute: 0,
      title: 'LingoLeaf',
      body: 'Default body',
      bodyOptions: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
    });

    expect(outcome).toBe('scheduled');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(7);

    const scheduleCalls = mockScheduleNotificationAsync.mock.calls as Array<
      [{ trigger: { weekday: number }; content: { body: string; title: string } }]
    >;
    const scheduledWeekdays = scheduleCalls
      .map((call) => call[0].trigger.weekday)
      .sort((a, b) => a - b);
    expect(scheduledWeekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const scheduledBodies = scheduleCalls.map((call) => call[0].content.body);
    expect(new Set(scheduledBodies).size).toBeGreaterThan(1);
    expect(scheduleCalls[0][0].content.title).toBe('LingoLeaf');

    const stored = await AsyncStorage.getItem(NOTIFICATION_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '[]')).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6', 'id-7']);
  });
});

describe('requestDailyGoalReminderPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests permission when needed by default', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const outcome = await requestDailyGoalReminderPermission();

    expect(outcome).toBe('granted');
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not request permission when requestIfNeeded is false', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

    const outcome = await requestDailyGoalReminderPermission(false);

    expect(outcome).toBe('denied');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });
});
