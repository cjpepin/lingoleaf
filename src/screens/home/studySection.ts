export type HomeStudySectionMode = 'ready' | 'recent_studied' | 'recent_created';

export interface HomeStudyListCandidate {
  id: string;
  name: string;
  dueCount: number;
  totalWords: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface HomeStudySectionSelection {
  mode: HomeStudySectionMode;
  items: HomeStudyListCandidate[];
}

function byIsoDesc(a: string | null, b: string | null): number {
  const aa = a ?? '';
  const bb = b ?? '';
  return bb.localeCompare(aa);
}

export function selectHomeStudySection(
  candidates: HomeStudyListCandidate[],
  limit: number = 3
): HomeStudySectionSelection {
  const safeLimit = Math.max(1, Math.floor(limit));

  const ready = candidates
    .filter((item) => item.dueCount > 0)
    .sort((a, b) => {
      if (b.dueCount !== a.dueCount) return b.dueCount - a.dueCount;
      const byLastUsed = byIsoDesc(a.lastUsedAt, b.lastUsedAt);
      if (byLastUsed !== 0) return byLastUsed;
      return byIsoDesc(a.createdAt, b.createdAt);
    });
  if (ready.length > 0) {
    return {
      mode: 'ready',
      items: ready.slice(0, safeLimit),
    };
  }

  const recentlyStudied = candidates
    .filter((item) => typeof item.lastUsedAt === 'string' && item.lastUsedAt.length > 0)
    .sort((a, b) => byIsoDesc(a.lastUsedAt, b.lastUsedAt));
  if (recentlyStudied.length > 0) {
    return {
      mode: 'recent_studied',
      items: recentlyStudied.slice(0, safeLimit),
    };
  }

  const recentlyCreated = [...candidates]
    .sort((a, b) => byIsoDesc(a.createdAt, b.createdAt));
  return {
    mode: 'recent_created',
    items: recentlyCreated.slice(0, safeLimit),
  };
}
