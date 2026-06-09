import type { MetricTrend } from '@/screens/progress/trend';

export type StatCardTone = 'neutral' | 'positive' | 'warning' | 'info';

interface GoalToneParams {
  goalMet: boolean;
  trend?: MetricTrend | null;
}

interface SupportToneParams {
  trend?: MetricTrend | null;
}

export function resolveGoalCardTone(params: GoalToneParams): StatCardTone {
  if (params.goalMet) return 'positive';
  if (params.trend?.direction === 'down') return 'warning';
  if (params.trend?.direction === 'up') return 'info';
  return 'neutral';
}

export function resolveSupportCardTone(params: SupportToneParams): StatCardTone {
  if (params.trend?.direction === 'down') return 'warning';
  if (params.trend?.direction === 'up') return 'positive';
  return 'neutral';
}
