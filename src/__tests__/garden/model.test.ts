import {
  addDays,
  computeGardenProgressUpdate,
  emptyDailyProgress,
  regressGardenGp,
  resolveGardenFreshness,
  resolveGardenStage,
} from '@/garden/model';

describe('garden model', () => {
  it('maps stages by total GP', () => {
    expect(resolveGardenStage(0)).toBe('seed');
    expect(resolveGardenStage(40)).toBe('sprout');
    expect(resolveGardenStage(120)).toBe('sapling');
    expect(resolveGardenStage(280)).toBe('young_tree');
    expect(resolveGardenStage(560)).toBe('mature_tree');
    expect(resolveGardenStage(900)).toBe('blooming_tree');
    expect(resolveGardenStage(1400)).toBe('ancient_tree');
  });

  it('computes freshness from last activity date', () => {
    const today = '2026-03-03';
    expect(resolveGardenFreshness(today, today)).toBe('fresh');
    expect(resolveGardenFreshness('2026-03-02', today)).toBe('resting');
    expect(resolveGardenFreshness('2026-03-01', today)).toBe('resting');
    expect(resolveGardenFreshness('2026-02-28', today)).toBe('dead');
    expect(resolveGardenFreshness(null, today)).toBe('fresh');
  });

  it('awards reading GP with goal and streak bonus', () => {
    const daily = emptyDailyProgress('u1', '2026-03-03');
    const result = computeGardenProgressUpdate({
      daily,
      input: { readingMinutes: 12, source: 'reading' },
      goalMinutes: 10,
      savedGoal: 10,
      learnedGoal: 5,
      primaryGoal: 'reading_minutes',
      day: '2026-03-03',
      state: {
        streak_days: 4,
        last_goal_completed_on: '2026-03-02',
      },
    });

    // 10 reading GP + 5 goal bonus + 5 streak bonus
    expect(result.deltaGp).toBe(20);
    expect(result.goalCompletedNow).toBe(true);
    expect(result.streakBonusAwardedNow).toBe(true);
    expect(result.nextStreakDays).toBe(5);
    expect(result.nextDaily.reading_minutes).toBe(12);
    expect(result.nextDaily.goal_completed).toBe(true);
  });

  it('respects daily GP cap', () => {
    const daily = {
      ...emptyDailyProgress('u1', '2026-03-03'),
      gp_awarded: 39,
    };

    const result = computeGardenProgressUpdate({
      daily,
      input: { savedCount: 4, source: 'saved' },
      goalMinutes: 10,
      savedGoal: 10,
      learnedGoal: 5,
      primaryGoal: 'reading_minutes',
      day: '2026-03-03',
      state: {
        streak_days: 1,
        last_goal_completed_on: '2026-03-02',
      },
    });

    expect(result.deltaGp).toBe(1);
    expect(result.nextDaily.saved_count).toBe(4);
    expect(result.nextDaily.gp_awarded).toBe(40);
  });

  it('tracks uncapped daily activity counters while capping GP accrual', () => {
    const daily = {
      ...emptyDailyProgress('u1', '2026-03-03'),
      saved_count: 14,
      learned_count: 9,
    };

    const result = computeGardenProgressUpdate({
      daily,
      input: { savedCount: 6, learnedCount: 4, source: 'manual' },
      goalMinutes: 10,
      savedGoal: 10,
      learnedGoal: 5,
      primaryGoal: 'reading_minutes',
      day: '2026-03-03',
      state: {
        streak_days: 1,
        last_goal_completed_on: '2026-03-02',
      },
    });

    expect(result.nextDaily.saved_count).toBe(20);
    expect(result.nextDaily.learned_count).toBe(13);
    // +1 saved GP (cap 15) and +2 learned GP (cap 10, multiplier x2)
    expect(result.deltaGp).toBe(3);
  });

  describe('regressGardenGp', () => {
    it('drops ancient_tree to blooming_tree threshold', () => {
      expect(regressGardenGp(1400)).toBe(900);
      expect(regressGardenGp(1800)).toBe(900);
    });

    it('drops blooming_tree to mature_tree threshold', () => {
      expect(regressGardenGp(900)).toBe(560);
      expect(regressGardenGp(1100)).toBe(560);
    });

    it('drops mature_tree to young_tree threshold', () => {
      expect(regressGardenGp(560)).toBe(280);
    });

    it('drops young_tree to sapling threshold', () => {
      expect(regressGardenGp(280)).toBe(120);
    });

    it('drops sapling to sprout threshold', () => {
      expect(regressGardenGp(120)).toBe(40);
    });

    it('drops sprout to seed (0)', () => {
      expect(regressGardenGp(40)).toBe(0);
      expect(regressGardenGp(80)).toBe(0);
    });

    it('keeps seed at 0', () => {
      expect(regressGardenGp(0)).toBe(0);
      expect(regressGardenGp(10)).toBe(0);
      expect(regressGardenGp(39)).toBe(0);
    });

    it('handles negative and fractional input', () => {
      expect(regressGardenGp(-10)).toBe(0);
      expect(regressGardenGp(560.9)).toBe(280);
    });
  });

  it('handles date math helper', () => {
    expect(addDays('2026-03-03', -1)).toBe('2026-03-02');
  });
});
