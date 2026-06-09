import { computeMetricTrend } from '@/screens/progress/trend';

describe('progress trend helpers', () => {
  it('returns up direction with percent when baseline exists', () => {
    expect(computeMetricTrend(30, 20)).toEqual({
      direction: 'up',
      delta: 10,
      percentChange: 50,
    });
  });

  it('returns down direction with percent when baseline exists', () => {
    expect(computeMetricTrend(15, 20)).toEqual({
      direction: 'down',
      delta: -5,
      percentChange: -25,
    });
  });

  it('returns flat direction for unchanged values', () => {
    expect(computeMetricTrend(12, 12)).toEqual({
      direction: 'flat',
      delta: 0,
      percentChange: 0,
    });
  });

  it('returns null percent when baseline is zero', () => {
    expect(computeMetricTrend(6, 0)).toEqual({
      direction: 'up',
      delta: 6,
      percentChange: null,
    });
  });
});
