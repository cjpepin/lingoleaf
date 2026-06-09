import React from 'react';
import { render } from '@testing-library/react-native';
import { ProgressChartCard } from '@/components/progress/ProgressChartCard';

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ProgressChartCard', () => {
  it('shows empty message when timeline is missing', () => {
    const { getByTestId } = render(<ProgressChartCard timeline={null} />);

    expect(getByTestId('progress-chart-empty')).toBeTruthy();
  });

  it('renders bars when timeline has data', () => {
    const timeline = {
      windowDays: 7,
      points: [
        { day: '2026-03-01', minutesRead: 10, wordsSaved: 0, wordsReviewed: 0 },
        { day: '2026-03-02', minutesRead: 5, wordsSaved: 0, wordsReviewed: 0 },
        { day: '2026-03-03', minutesRead: 0, wordsSaved: 0, wordsReviewed: 0 },
      ],
    };
    const { queryByTestId, queryAllByTestId } = render(<ProgressChartCard timeline={timeline} />);

    expect(queryByTestId('progress-chart-empty')).toBeNull();
    expect(queryAllByTestId('progress-chart-bar').length).toBe(3);
  });
});
