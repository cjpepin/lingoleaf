import type { VocabList } from '@/supabase/types';

function toMillis(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function sortStudyListsByRecentUpdate(lists: VocabList[]): VocabList[] {
  return [...lists].sort((a, b) => {
    const byUpdated = toMillis(b.updated_at) - toMillis(a.updated_at);
    if (byUpdated !== 0) return byUpdated;
    const byCreated = toMillis(b.created_at) - toMillis(a.created_at);
    if (byCreated !== 0) return byCreated;
    return a.name.localeCompare(b.name);
  });
}

export function getLockedStudyListIds(
  sortedLists: VocabList[],
  isPremium: boolean,
  freeAccessibleCount: number
): Set<string> {
  if (isPremium) return new Set();
  if (freeAccessibleCount <= 0) return new Set(sortedLists.map((list) => list.id));
  return new Set(sortedLists.slice(freeAccessibleCount).map((list) => list.id));
}
