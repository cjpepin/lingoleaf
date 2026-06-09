import { resolveGoalCardTone, resolveSupportCardTone } from '@/screens/progress/cardTone';

describe('progress card tones', () => {
  it('uses positive tone when a goal is met', () => {
    expect(resolveGoalCardTone({ goalMet: true, trend: { direction: 'down', delta: -1, percentChange: -10 } })).toBe('positive');
  });

  it('uses warning tone for unmet goals with downward trend', () => {
    expect(resolveGoalCardTone({ goalMet: false, trend: { direction: 'down', delta: -2, percentChange: -20 } })).toBe('warning');
  });

  it('uses info tone for unmet goals with upward trend', () => {
    expect(resolveGoalCardTone({ goalMet: false, trend: { direction: 'up', delta: 2, percentChange: 20 } })).toBe('info');
  });

  it('uses neutral tone for flat/no trend', () => {
    expect(resolveGoalCardTone({ goalMet: false, trend: { direction: 'flat', delta: 0, percentChange: 0 } })).toBe('neutral');
    expect(resolveSupportCardTone({ trend: undefined })).toBe('neutral');
  });

  it('uses positive/warning support tones from trend direction', () => {
    expect(resolveSupportCardTone({ trend: { direction: 'up', delta: 5, percentChange: 50 } })).toBe('positive');
    expect(resolveSupportCardTone({ trend: { direction: 'down', delta: -3, percentChange: -30 } })).toBe('warning');
  });
});
