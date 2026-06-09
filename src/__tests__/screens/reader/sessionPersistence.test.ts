import { buildPersistableReadingSegment } from '@/screens/reader/sessionPersistence';

describe('reader sessionPersistence', () => {
  it('builds a persistable segment for completed reading time', () => {
    const endedAtMs = Date.UTC(2026, 2, 18, 15, 30, 0);
    const segment = buildPersistableReadingSegment({
      activeDurationMs: 17 * 60 * 1000,
      endedAtMs,
    });

    expect(segment).toEqual({
      startedAtIso: new Date(endedAtMs - 17 * 60 * 1000).toISOString(),
      endedAtIso: new Date(endedAtMs).toISOString(),
      minutes: 17,
      durationMs: 17 * 60 * 1000,
    });
  });

  it('returns null when the segment rounds down to zero minutes', () => {
    expect(
      buildPersistableReadingSegment({
        activeDurationMs: 30 * 1000,
        endedAtMs: Date.UTC(2026, 2, 18, 15, 30, 0),
      })
    ).toBeNull();
  });
});
