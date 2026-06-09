import { buildReadingSessionWindow, MAX_READING_SESSION_MINUTES } from '@/utils/readerSession';

describe('readerSession', () => {
  it('derives start/end and minutes from active ms', () => {
    const endedAt = Date.UTC(2026, 2, 4, 12, 0, 0);
    const session = buildReadingSessionWindow(endedAt, 25 * 60 * 1000);

    expect(session.minutes).toBe(25);
    expect(session.durationMs).toBe(25 * 60 * 1000);
    expect(session.endedAtMs).toBe(endedAt);
    expect(session.startedAtMs).toBe(endedAt - 25 * 60 * 1000);
  });

  it('caps extremely long sessions to avoid background-time inflation', () => {
    const endedAt = Date.UTC(2026, 2, 4, 12, 0, 0);
    const session = buildReadingSessionWindow(endedAt, 12 * 60 * 60 * 1000);

    expect(session.minutes).toBe(MAX_READING_SESSION_MINUTES);
    expect(session.durationMs).toBe(MAX_READING_SESSION_MINUTES * 60 * 1000);
  });
});
