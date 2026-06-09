import { defaultSubGoals, getActiveGoals, normalizePrimaryGoal, normalizeSubGoals } from '@/utils/goalHierarchy';

describe('goalHierarchy', () => {
  it('falls back to reading_minutes for invalid primary goal', () => {
    expect(normalizePrimaryGoal('invalid')).toBe('reading_minutes');
    expect(normalizePrimaryGoal(null)).toBe('reading_minutes');
  });

  it('removes duplicates and excludes primary goal from sub-goals', () => {
    expect(
      normalizeSubGoals(
        ['reading_minutes', 'words_saved', 'words_saved', 'words_learned'],
        'words_saved'
      )
    ).toEqual(['reading_minutes', 'words_learned']);
  });

  it('returns default sub-goals as all non-primary goals', () => {
    expect(defaultSubGoals('reading_minutes')).toEqual(['words_saved', 'words_learned']);
    expect(defaultSubGoals('words_saved')).toEqual(['reading_minutes', 'words_learned']);
  });

  it('returns only the primary goal plus selected sub-goals for active goal rendering', () => {
    expect(getActiveGoals('words_saved', ['reading_minutes', 'words_saved', 'reading_minutes'])).toEqual([
      'words_saved',
      'reading_minutes',
    ]);
    expect(getActiveGoals('reading_minutes', [])).toEqual(['reading_minutes']);
  });
});
