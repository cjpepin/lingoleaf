import {
  normalizeDailyReadingGoalMinutes,
  resolveDailyReadingMinutes,
} from '@/hooks/useDailyGoal';

describe('normalizeDailyReadingGoalMinutes', () => {
  it('returns default for invalid values', () => {
    expect(normalizeDailyReadingGoalMinutes(undefined)).toBe(10);
    expect(normalizeDailyReadingGoalMinutes(null)).toBe(10);
    expect(normalizeDailyReadingGoalMinutes('15')).toBe(10);
  });

  it('clamps values to 5..60 and rounds to nearest 5', () => {
    expect(normalizeDailyReadingGoalMinutes(1)).toBe(5);
    expect(normalizeDailyReadingGoalMinutes(7)).toBe(5);
    expect(normalizeDailyReadingGoalMinutes(8)).toBe(10);
    expect(normalizeDailyReadingGoalMinutes(61)).toBe(60);
  });

  it('keeps valid 5-minute increments unchanged', () => {
    expect(normalizeDailyReadingGoalMinutes(5)).toBe(5);
    expect(normalizeDailyReadingGoalMinutes(25)).toBe(25);
    expect(normalizeDailyReadingGoalMinutes(60)).toBe(60);
  });
});

describe('resolveDailyReadingMinutes', () => {
  it('keeps a higher cached total when the remote fetch is stale', () => {
    expect(resolveDailyReadingMinutes(14, 0)).toBe(14);
  });

  it('accepts the remote total when it is newer than the cache', () => {
    expect(resolveDailyReadingMinutes(4, 11)).toBe(11);
  });
});
