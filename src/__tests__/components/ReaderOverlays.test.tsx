import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReaderOverlays } from '@/components/ReaderOverlays';

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'reader.loading') return 'reader.loading.localized';
    if (key === 'reader.dailyGoalTooltip') {
      return `${params?.minutes}/${params?.goal} min today (${params?.percent}%)`;
    }
    if (key === 'reader.pagesLeft') return `${params?.n} pgs left in chapter`;
    if (key === 'reader.percentChapter') return `${params?.n}% through chapter`;
    if (key === 'reader.timeLeft') return `~${params?.n} min left in chapter`;
    if (key === 'reader.timeLeftUnder') return `< 1 min left in chapter`;
    return key;
  },
}));

describe('ReaderOverlays', () => {
  it('shows page counter with current/total', () => {
    const { getByText } = render(
      <ReaderOverlays currentPage={5} totalPages={42} />
    );
    expect(getByText('5 / 42')).toBeTruthy();
  });

  it('shows loading indicator when currentPage <= 0', () => {
    const { getByText } = render(
      <ReaderOverlays currentPage={0} totalPages={0} />
    );
    expect(getByText('reader.loading.localized')).toBeTruthy();
  });

  it('keeps loading state until totalPages is available', () => {
    const { getByText, queryByText } = render(
      <ReaderOverlays currentPage={3} totalPages={0} />
    );
    expect(getByText('reader.loading.localized')).toBeTruthy();
    expect(queryByText('3 / 0')).toBeNull();
  });

  it('keeps loading state while pageLoading is true', () => {
    const { getByText, queryByText } = render(
      <ReaderOverlays currentPage={3} totalPages={42} pageLoading />
    );
    expect(getByText('reader.loading.localized')).toBeTruthy();
    expect(queryByText('3 / 42')).toBeNull();
  });

  it('shows chapter progress when chapter data is provided', () => {
    const { getByText } = render(
      <ReaderOverlays
        currentPage={10}
        totalPages={100}
        chapterPage={3}
        chapterTotal={10}
      />
    );
    expect(getByText('7 pgs left in chapter')).toBeTruthy();
  });

  it('does not show chapter progress without chapter data', () => {
    const { queryByText } = render(
      <ReaderOverlays currentPage={10} totalPages={100} />
    );
    expect(queryByText(/pgs left/)).toBeNull();
    expect(queryByText(/% through/)).toBeNull();
  });

  it('cycles through modes on tap', () => {
    const { getByText } = render(
      <ReaderOverlays
        currentPage={10}
        totalPages={100}
        chapterPage={3}
        chapterTotal={10}
        getSecondsPerPage={() => 30}
      />
    );

    // Default: pages mode
    const indicator = getByText('7 pgs left in chapter');
    expect(indicator).toBeTruthy();

    // Tap -> percent mode
    fireEvent.press(indicator);
    expect(getByText('30% through chapter')).toBeTruthy();

    // Tap -> time mode
    fireEvent.press(getByText('30% through chapter'));
    expect(getByText('~4 min left in chapter')).toBeTruthy();

    // Tap -> back to pages
    fireEvent.press(getByText('~4 min left in chapter'));
    expect(getByText('7 pgs left in chapter')).toBeTruthy();
  });

  it('shows daily goal tooltip from the loop indicator', () => {
    const { getByTestId, queryByText } = render(
      <ReaderOverlays
        currentPage={10}
        totalPages={100}
        dailyMinutesRead={12}
        dailyGoalMinutes={30}
      />
    );

    expect(queryByText('12/30 min today (40%)')).toBeNull();
    fireEvent.press(getByTestId('reader-daily-goal-ring'));
    expect(queryByText('12/30 min today (40%)')).toBeTruthy();
  });

  it('caps tooltip percent at 100 so text matches visual ring fill', () => {
    const { getByTestId, queryByText } = render(
      <ReaderOverlays
        currentPage={10}
        totalPages={100}
        dailyMinutesRead={45}
        dailyGoalMinutes={30}
      />
    );

    fireEvent.press(getByTestId('reader-daily-goal-ring'));
    expect(queryByText('45/30 min today (100%)')).toBeTruthy();
  });
});
