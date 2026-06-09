export interface ChartPoint {
  day: string;
  value: number;
}

export interface ChartBar {
  label: string;
  value: number;
}

function formatDayLabel(day: string): string {
  if (day.length !== 10) return day;
  return `${day.slice(5, 7)}/${day.slice(8, 10)}`;
}

export function buildChartBars(points: ChartPoint[], maxBars: number): ChartBar[] {
  if (points.length === 0 || maxBars <= 0) return [];
  if (points.length <= maxBars) {
    return points.map((point) => ({
      label: formatDayLabel(point.day),
      value: Math.max(0, Math.floor(point.value)),
    }));
  }

  const bucketSize = Math.ceil(points.length / maxBars);
  const bars: ChartBar[] = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize);
    const total = bucket.reduce((sum, point) => sum + Math.max(0, Math.floor(point.value)), 0);
    const label = formatDayLabel(bucket[bucket.length - 1]?.day ?? '');
    bars.push({ label, value: total });
  }
  return bars;
}

export function averagePerDay(points: ChartPoint[]): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + Math.max(0, Math.floor(point.value)), 0);
  return Math.round(total / points.length);
}

export function bestDay(points: ChartPoint[]): number {
  if (points.length === 0) return 0;
  return points.reduce((max, point) => Math.max(max, Math.max(0, Math.floor(point.value))), 0);
}
