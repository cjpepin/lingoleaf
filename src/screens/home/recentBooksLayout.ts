interface RecentBooksLayoutOptions {
  columns: number;
  outerMargin: number;
  cardPadding: number;
  columnGap: number;
}

interface RecentBooksLayout {
  itemWidth: number;
  columnGap: number;
}

const DEFAULT_OPTIONS: RecentBooksLayoutOptions = {
  columns: 3,
  outerMargin: 16,
  cardPadding: 16,
  columnGap: 8,
};

export function getRecentBooksLayout(
  windowWidth: number,
  options: Partial<RecentBooksLayoutOptions> = {}
): RecentBooksLayout {
  const merged: RecentBooksLayoutOptions = { ...DEFAULT_OPTIONS, ...options };
  const totalInsets = (merged.outerMargin * 2) + (merged.cardPadding * 2);
  const totalGap = merged.columnGap * Math.max(0, merged.columns - 1);
  const available = Math.max(0, windowWidth - totalInsets - totalGap);
  const itemWidth = Math.max(1, Math.floor(available / merged.columns));

  return {
    itemWidth,
    columnGap: merged.columnGap,
  };
}
