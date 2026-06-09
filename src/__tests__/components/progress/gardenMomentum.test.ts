import { resolveGardenMomentum } from '@/components/progress/gardenMomentum';

function makeSnapshot(overrides?: Record<string, unknown>): any {
  return {
    goalMinutes: 10,
    daily: { reading_minutes: 0, goal_completed: false },
    state: { streak_days: 0, last_activity_on: '2026-03-05' },
    recentGoalCompletion: { daysMet: 1, daysConsidered: 7, completionRate: 1 / 7 },
    ...overrides,
  };
}

describe('resolveGardenMomentum', () => {
  it('returns success when goal is completed today', () => {
    const result = resolveGardenMomentum(makeSnapshot({ daily: { reading_minutes: 0, goal_completed: true } }));

    expect(result.tone).toBe('success');
    expect(result.inlineKey).toBe('garden.status.congratsInline');
  });

  it('returns encouraging text when no reading happened yet', () => {
    const result = resolveGardenMomentum(makeSnapshot({ daily: { reading_minutes: 0, goal_completed: false } }));

    expect(result.tone).toBe('warning');
    expect(result.inlineKey).toBe('garden.status.encourageInline');
  });

  it('returns keep-going text when reading has started but is below goal', () => {
    const result = resolveGardenMomentum(makeSnapshot({ daily: { reading_minutes: 6, goal_completed: false } }));

    expect(result.tone).toBe('neutral');
    expect(result.inlineKey).toBe('garden.status.keepGoingInline');
  });

  it('returns success when reading goal minutes are reached', () => {
    const result = resolveGardenMomentum(makeSnapshot({ daily: { reading_minutes: 10, goal_completed: false } }));

    expect(result.tone).toBe('success');
    expect(result.inlineKey).toBe('garden.status.congratsInline');
  });
});
