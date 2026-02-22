import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReaderOverlays } from '@/components/ReaderOverlays';

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
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
    expect(getByText('Loading…')).toBeTruthy();
  });

  it('shows "Page N" when totalPages is not available', () => {
    const { getByText } = render(
      <ReaderOverlays currentPage={3} totalPages={0} />
    );
    expect(getByText('Page 3')).toBeTruthy();
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
});
