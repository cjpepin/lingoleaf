export type TrendDirection = 'up' | 'down' | 'flat';

export interface MetricTrend {
  direction: TrendDirection;
  delta: number;
  percentChange: number | null;
}

export function computeMetricTrend(current: number, previous: number): MetricTrend {
  const safeCurrent = Math.max(0, Math.floor(current));
  const safePrevious = Math.max(0, Math.floor(previous));
  const delta = safeCurrent - safePrevious;

  if (delta > 0) {
    return {
      direction: 'up',
      delta,
      percentChange: safePrevious > 0 ? Math.round((delta / safePrevious) * 100) : null,
    };
  }

  if (delta < 0) {
    return {
      direction: 'down',
      delta,
      percentChange: safePrevious > 0 ? Math.round((delta / safePrevious) * 100) : null,
    };
  }

  return {
    direction: 'flat',
    delta: 0,
    percentChange: safePrevious > 0 ? 0 : null,
  };
}
