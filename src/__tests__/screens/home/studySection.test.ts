import {
  selectHomeStudySection,
  type HomeStudyListCandidate,
} from '@/screens/home/studySection';

function list(
  id: string,
  overrides?: Partial<HomeStudyListCandidate>
): HomeStudyListCandidate {
  return {
    id,
    name: id,
    dueCount: 0,
    totalWords: 10,
    lastUsedAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectHomeStudySection', () => {
  it('prioritizes ready lists when due cards exist', () => {
    const result = selectHomeStudySection([
      list('a', { dueCount: 2 }),
      list('b', { dueCount: 6 }),
      list('c', { dueCount: 0 }),
    ]);

    expect(result.mode).toBe('ready');
    expect(result.items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('falls back to recently studied lists when no due cards exist', () => {
    const result = selectHomeStudySection([
      list('a', { lastUsedAt: '2026-03-03T10:00:00.000Z' }),
      list('b', { lastUsedAt: '2026-03-04T10:00:00.000Z' }),
      list('c', { lastUsedAt: null }),
    ]);

    expect(result.mode).toBe('recent_studied');
    expect(result.items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('falls back to recently created lists when no ready or studied lists exist', () => {
    const result = selectHomeStudySection([
      list('a', { createdAt: '2026-03-02T10:00:00.000Z' }),
      list('b', { createdAt: '2026-03-04T10:00:00.000Z' }),
      list('c', { createdAt: '2026-03-03T10:00:00.000Z' }),
    ]);

    expect(result.mode).toBe('recent_created');
    expect(result.items.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });
});
