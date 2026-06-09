import React from 'react';
import { render, within } from '@testing-library/react-native';
import MyProgressScreen from '@/screens/MyProgressScreen';

let mockIsPremium = false;
const mockGardenSummaryCard = jest.fn();
const mockStatCard = jest.fn();
const mockUseProgressStats = jest.fn();
const mockUseGardenState = jest.fn();
const mockSegmentedTabs = jest.fn();

interface GardenSummaryCardMockProps {
  showProgressHint?: boolean;
}

interface StatCardMockProps {
  label: string;
  tone?: string;
}

interface SegmentedTabsMockProps {
  tabs: Array<{ key: string; label: string; locked?: boolean }>;
  activeKey: string;
  onPress: (key: string, locked: boolean) => void;
}

jest.mock('@/premium/PremiumProvider', () => ({
  usePremium: () => ({ isPremium: mockIsPremium }),
}));

jest.mock('@/premium/usePremiumGate', () => ({
  usePremiumGate: () => ({
    openPaywallOrAuth: jest.fn(() => true),
  }),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

jest.mock('@/hooks/useProgressStats', () => ({
  useProgressStats: () => mockUseProgressStats(),
}));

jest.mock('@/hooks/useGardenState', () => ({
  useGardenState: () => mockUseGardenState(),
}));

jest.mock('@/components/progress/SegmentedTabs', () => ({
  SegmentedTabs: (props: SegmentedTabsMockProps) => {
    mockSegmentedTabs(props);
    return null;
  },
}));

jest.mock('@/components/progress/StatCard', () => ({
  StatCard: (props: StatCardMockProps) => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    mockStatCard(props);
    return ReactLib.createElement(Text, null, `stat:${props.label}`);
  },
}));

jest.mock('@/components/progress/ProgressChartCard', () => ({
  ProgressChartCard: () => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    return ReactLib.createElement(Text, null, 'progress-chart');
  },
}));

jest.mock('@/components/progress/GardenSummaryCard', () => ({
  GardenSummaryCard: (props: GardenSummaryCardMockProps) => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    mockGardenSummaryCard(props);
    return ReactLib.createElement(Text, null, `hint:${props.showProgressHint === false ? 'hidden' : 'shown'}`);
  },
}));

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: ({ placement }: { placement?: string }) => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    return ReactLib.createElement(Text, null, `ad:${placement ?? 'unknown'}`);
  },
}));

describe('MyProgressScreen ads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGardenSummaryCard.mockReset();
    mockStatCard.mockReset();
    mockSegmentedTabs.mockReset();
    mockUseProgressStats.mockReturnValue({
      loading: false,
      minutesRead: 12,
      streakDays: 2,
      wordsSaved: 4,
      wordsReviewed: 8,
      wordsLearned: 3,
      trends: {
        windowDays: 7,
        minutesRead: { direction: 'up', delta: 2, percentChange: 20 },
        wordsSaved: { direction: 'down', delta: -1, percentChange: -10 },
        wordsReviewed: { direction: 'up', delta: 3, percentChange: 30 },
      },
      timeline: null,
    });
    mockUseGardenState.mockReturnValue({
      snapshot: {
        state: { stage: 'seed', freshness: 'fresh' },
        daily: { reading_minutes: 10, saved_count: 2, learned_count: 1 },
        goalMinutes: 10,
        savedGoal: 10,
        learnedGoal: 5,
        primaryGoal: 'reading_minutes',
        goalPriority: ['reading_minutes', 'words_saved', 'words_learned'],
      },
    });
  });

  it('renders ad slots for non-premium users', () => {
    mockIsPremium = false;
    const { getByText } = render(<MyProgressScreen />);

    expect(getByText('ad:my_progress_top')).toBeTruthy();
    expect(getByText('ad:my_progress_mid')).toBeTruthy();
  });

  it('hides ad slots for premium users', () => {
    mockIsPremium = true;
    const { queryByText } = render(<MyProgressScreen />);

    expect(queryByText('ad:my_progress_top')).toBeNull();
    expect(queryByText('ad:my_progress_mid')).toBeNull();
  });

  it('passes hide hint flag to garden card', () => {
    mockIsPremium = false;
    const { getByText } = render(<MyProgressScreen />);

    expect(getByText('hint:hidden')).toBeTruthy();
  });

  it('renders primary-goal cards on top and non-goal cards on bottom', () => {
    const { getByTestId } = render(<MyProgressScreen />);
    const topRow = getByTestId('stats-row-top');
    const bottomRow = getByTestId('stats-row-bottom');

    expect(within(topRow).queryAllByText(/^stat:/).length).toBe(3);
    expect(within(topRow).getByText('stat:progress.minutesRead')).toBeTruthy();
    expect(within(topRow).getByText('stat:progress.wordsSaved')).toBeTruthy();
    expect(within(topRow).getByText('stat:progress.wordsLearned')).toBeTruthy();

    expect(within(bottomRow).queryAllByText(/^stat:/).length).toBe(2);
    expect(within(bottomRow).getByText('stat:progress.streakDays')).toBeTruthy();
    expect(within(bottomRow).getByText('stat:progress.wordsReviewed')).toBeTruthy();
  });

  it('applies deterministic tone pattern for met goals and trends', () => {
    render(<MyProgressScreen />);
    const propsByLabel = new Map<string, StatCardMockProps>(
      mockStatCard.mock.calls.map(([props]: [StatCardMockProps]) => [props.label, props])
    );

    expect(propsByLabel.get('progress.minutesRead')?.tone).toBe('positive');
    expect(propsByLabel.get('progress.wordsSaved')?.tone).toBe('warning');
    expect(propsByLabel.get('progress.wordsLearned')?.tone).toBe('neutral');
    expect(propsByLabel.get('progress.wordsReviewed')?.tone).toBe('positive');
  });

  it('renders day/week/month/year range tabs in order', () => {
    mockIsPremium = false;
    render(<MyProgressScreen />);

    const tabs = (mockSegmentedTabs.mock.calls[0]?.[0] as SegmentedTabsMockProps).tabs;
    expect(tabs.map((tab) => tab.key)).toEqual(['day', 'week', 'month', 'year']);
    expect(tabs.find((tab) => tab.key === 'month')?.locked).toBe(true);
    expect(tabs.find((tab) => tab.key === 'year')?.locked).toBe(true);
  });
});
