import { getRecentBooksLayout } from '@/screens/home/recentBooksLayout';

describe('getRecentBooksLayout', () => {
  it('fits three book tiles inside card content width', () => {
    const windowWidth = 390;
    const layout = getRecentBooksLayout(windowWidth, {
      columns: 3,
      outerMargin: 16,
      cardPadding: 16,
      columnGap: 4,
    });

    const contentWidth = windowWidth - (16 * 2) - (16 * 2);
    const usedWidth = (layout.itemWidth * 3) + (layout.columnGap * 2);
    expect(usedWidth).toBeLessThanOrEqual(contentWidth);
  });

  it('returns positive width for small screens', () => {
    const layout = getRecentBooksLayout(240, {
      columns: 3,
      outerMargin: 16,
      cardPadding: 16,
      columnGap: 4,
    });

    expect(layout.itemWidth).toBeGreaterThan(0);
  });
});
