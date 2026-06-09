import type { VocabList } from '@/supabase/types';
import { getLockedStudyListIds, sortStudyListsByRecentUpdate } from '@/screens/study/listAccess';

function makeList(id: string, updatedAt: string, createdAt: string): VocabList {
  return {
    id,
    user_id: 'u1',
    name: id,
    created_at: createdAt,
    updated_at: updatedAt,
    last_used_at: null,
  };
}

describe('study list access helpers', () => {
  it('sorts lists by most recently updated first', () => {
    const lists = [
      makeList('old', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      makeList('new', '2026-02-01T00:00:00.000Z', '2026-01-10T00:00:00.000Z'),
      makeList('mid', '2026-01-15T00:00:00.000Z', '2026-01-05T00:00:00.000Z'),
    ];

    const sorted = sortStudyListsByRecentUpdate(lists);
    expect(sorted.map((item) => item.id)).toEqual(['new', 'mid', 'old']);
  });

  it('locks lists after free access threshold for non-premium users', () => {
    const sorted = [
      makeList('a', '2026-02-05T00:00:00.000Z', '2026-02-05T00:00:00.000Z'),
      makeList('b', '2026-02-04T00:00:00.000Z', '2026-02-04T00:00:00.000Z'),
      makeList('c', '2026-02-03T00:00:00.000Z', '2026-02-03T00:00:00.000Z'),
    ];

    const locked = getLockedStudyListIds(sorted, false, 2);
    expect(Array.from(locked)).toEqual(['c']);
  });

  it('locks none for premium users', () => {
    const sorted = [makeList('a', '2026-02-05T00:00:00.000Z', '2026-02-05T00:00:00.000Z')];
    const locked = getLockedStudyListIds(sorted, true, 5);
    expect(locked.size).toBe(0);
  });
});
