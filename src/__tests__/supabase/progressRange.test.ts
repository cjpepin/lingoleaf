import { chartDaysForRange } from '@/supabase/queries';

describe('chartDaysForRange', () => {
  it('uses a 7-day chart window for day and week ranges', () => {
    expect(chartDaysForRange('day')).toBe(7);
    expect(chartDaysForRange('week')).toBe(7);
  });

  it('keeps month and year chart windows unchanged', () => {
    expect(chartDaysForRange('month')).toBe(30);
    expect(chartDaysForRange('year')).toBe(365);
  });
});
