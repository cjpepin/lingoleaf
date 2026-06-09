import { calculateProgressPercent } from '@/screens/history/progress';

describe('calculateProgressPercent', () => {
  it('returns 0 when goal is invalid', () => {
    expect(calculateProgressPercent(10, 0)).toBe(0);
    expect(calculateProgressPercent(10, -5)).toBe(0);
  });

  it('returns rounded percentage for normal values', () => {
    expect(calculateProgressPercent(5, 10)).toBe(50);
    expect(calculateProgressPercent(7, 15)).toBe(47);
  });

  it('clamps to [0, 100]', () => {
    expect(calculateProgressPercent(-5, 10)).toBe(0);
    expect(calculateProgressPercent(999, 10)).toBe(100);
  });
});
