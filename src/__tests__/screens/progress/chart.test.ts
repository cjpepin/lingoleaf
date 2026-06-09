import { averagePerDay, bestDay, buildChartBars } from '@/screens/progress/chart';

describe('progress chart helpers', () => {
  it('returns direct day labels when points fit max bars', () => {
    const bars = buildChartBars(
      [
        { day: '2026-03-01', value: 10 },
        { day: '2026-03-02', value: 5 },
      ],
      4
    );

    expect(bars).toEqual([
      { label: '03/01', value: 10 },
      { label: '03/02', value: 5 },
    ]);
  });

  it('groups points into buckets when points exceed max bars', () => {
    const bars = buildChartBars(
      [
        { day: '2026-03-01', value: 1 },
        { day: '2026-03-02', value: 2 },
        { day: '2026-03-03', value: 3 },
        { day: '2026-03-04', value: 4 },
      ],
      2
    );

    expect(bars).toEqual([
      { label: '03/02', value: 3 },
      { label: '03/04', value: 7 },
    ]);
  });

  it('computes average and best day values', () => {
    const points = [
      { day: '2026-03-01', value: 0 },
      { day: '2026-03-02', value: 8 },
      { day: '2026-03-03', value: 4 },
    ];

    expect(averagePerDay(points)).toBe(4);
    expect(bestDay(points)).toBe(8);
  });
});
