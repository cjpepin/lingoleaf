export function calculateProgressPercent(minutesDone: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((minutesDone / goalMinutes) * 100)));
}
