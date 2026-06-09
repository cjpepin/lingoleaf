import AsyncStorage from '@react-native-async-storage/async-storage';

const mockInvoke = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('analytics client', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    await AsyncStorage.clear();
    mockInvoke.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function loadAnalytics() {
    return require('@/analytics/client') as typeof import('@/analytics/client');
  }

  it('does not enqueue invalid payloads and logs validation error', async () => {
    const analytics = loadAnalytics();
    await analytics.analyticsClient.init();

    analytics.track('search_performed', { query_length: 'bad' as unknown as number });
    const snapshot = analytics.analyticsClient.getDebugSnapshot();

    expect(snapshot.queued).toHaveLength(0);
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Analytics payload validation failed',
      expect.any(Error)
    );
  });

  it('tracks analytics_flush_failed on flush error and applies backoff', async () => {
    const analytics = loadAnalytics();
    await analytics.analyticsClient.init();

    analytics.track('library_opened', { source: 'test' });
    mockInvoke.mockResolvedValueOnce({ error: new Error('network_down') });

    await analytics.flushAnalytics(true);
    const firstSnapshot = analytics.analyticsClient.getDebugSnapshot();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(firstSnapshot.queued.some((event) => event.event_name === 'analytics_flush_failed')).toBe(true);

    await analytics.flushAnalytics();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith('Analytics flush failed', expect.any(Error));
  });

  it('force flush bypasses backoff gate', async () => {
    const analytics = loadAnalytics();
    await analytics.analyticsClient.init();

    analytics.track('library_opened', { source: 'test' });
    mockInvoke.mockResolvedValueOnce({ error: new Error('network_down') });
    await analytics.flushAnalytics(true);

    mockInvoke.mockResolvedValue({ error: null });
    await analytics.flushAnalytics(true);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('flushes queued events successfully and clears queue', async () => {
    const analytics = loadAnalytics();
    await analytics.analyticsClient.init();

    analytics.track('library_opened', { source: 'test' });
    analytics.track('study_opened', { source: 'test' });

    await analytics.flushAnalytics(true);

    const snapshot = analytics.analyticsClient.getDebugSnapshot();
    expect(snapshot.queued).toHaveLength(0);
    expect(snapshot.last_flush_at).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledWith('analytics-ingest', {
      body: {
        events: expect.any(Array),
      },
    });
  });
});
