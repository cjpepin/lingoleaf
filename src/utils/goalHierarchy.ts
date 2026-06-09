export type GoalKey = 'reading_minutes' | 'words_saved' | 'words_learned';

const GOAL_KEYS: GoalKey[] = ['reading_minutes', 'words_saved', 'words_learned'];

export function normalizePrimaryGoal(raw: unknown): GoalKey {
  if (raw === 'reading_minutes' || raw === 'words_saved' || raw === 'words_learned') {
    return raw;
  }
  return 'reading_minutes';
}

export function normalizeSubGoals(raw: unknown, primaryGoal: GoalKey): GoalKey[] {
  const fromRaw = Array.isArray(raw)
    ? raw.filter((item): item is GoalKey => GOAL_KEYS.includes(item as GoalKey))
    : [];
  const unique = Array.from(new Set(fromRaw));
  return unique.filter((goal) => goal !== primaryGoal);
}

export function getActiveGoals(primaryGoal: GoalKey, rawSubGoals: unknown): GoalKey[] {
  return [primaryGoal, ...normalizeSubGoals(rawSubGoals, primaryGoal)];
}

export function defaultSubGoals(primaryGoal: GoalKey): GoalKey[] {
  return GOAL_KEYS.filter((goal) => goal !== primaryGoal);
}
