import React from 'react';
import { render } from '@testing-library/react-native';
import { GardenSummaryCard } from '@/components/progress/GardenSummaryCard';

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string) => (key === 'home.viewProgress' ? 'View Progress' : key),
}));

jest.mock('@/components/progress/GardenStageVisual', () => ({
  GardenStageVisual: () => null,
}));

jest.mock('@/components/progress/GoalProgressBar', () => ({
  GoalProgressBar: () => null,
}));

const snapshot = {
  state: { stage: 'seed', freshness: 'fresh', streak_days: 3, last_activity_on: null },
  daily: { reading_minutes: 2, saved_count: 1, learned_count: 1, goal_completed: false },
  goalMinutes: 10,
  savedGoal: 10,
  learnedGoal: 5,
} as any;

describe('GardenSummaryCard', () => {
  it('shows progress hint by default', () => {
    const { getByText } = render(<GardenSummaryCard snapshot={snapshot} />);

    expect(getByText('View Progress >')).toBeTruthy();
  });

  it('hides progress hint when disabled', () => {
    const { queryByText } = render(<GardenSummaryCard snapshot={snapshot} showProgressHint={false} />);

    expect(queryByText('View Progress >')).toBeNull();
  });

  it('shows daily goals counter instead of recent 7-day ratio', () => {
    const { getByText, queryByText } = render(<GardenSummaryCard snapshot={snapshot} />);

    expect(getByText('garden.dailyGoalCounter')).toBeTruthy();
    expect(queryByText('garden.recentGoalRate')).toBeNull();
  });

  it('replaces growth hint with encouragement/congrats text when available', () => {
    const { getByText, queryByText, rerender } = render(<GardenSummaryCard snapshot={snapshot} />);

    expect(getByText('garden.status.keepGoingInline')).toBeTruthy();
    expect(queryByText('garden.growthHint')).toBeNull();

    rerender(<GardenSummaryCard snapshot={{ ...snapshot, daily: { ...snapshot.daily, reading_minutes: 0 } }} />);
    expect(getByText('garden.status.encourageInline')).toBeTruthy();

    rerender(<GardenSummaryCard snapshot={{ ...snapshot, daily: { ...snapshot.daily, goal_completed: true } }} />);
    expect(getByText('garden.status.congratsInline')).toBeTruthy();
  });
});
