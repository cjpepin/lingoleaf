import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ReaderTutorial } from '@/components/ReaderTutorial';

const mockHasSeenTutorial = jest.fn();
const mockMarkTutorialSeen = jest.fn();
const mockHasReadingHistory = jest.fn();
let mockAuthState: { user: { id: string } | null; loading: boolean; isGuest: boolean } = {
  user: null,
  loading: false,
  isGuest: false,
};

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null; loading: boolean; isGuest: boolean }) => unknown) =>
    selector(mockAuthState),
}));

jest.mock('@/utils/tutorialSeen', () => ({
  hasSeenTutorial: (...args: unknown[]) => mockHasSeenTutorial(...args),
  markTutorialSeen: (...args: unknown[]) => mockMarkTutorialSeen(...args),
}));

jest.mock('@/supabase/queries', () => ({
  hasReadingHistory: (...args: unknown[]) => mockHasReadingHistory(...args),
}));

jest.mock('@/components/ReaderTutorialModal', () => {
  const ReactLib = require('react');
  const { Text: NativeText } = require('react-native');
  return {
    ReaderTutorialModal: () => ReactLib.createElement(NativeText, null, 'reader-tutorial-modal'),
  };
});

describe('ReaderTutorial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthState = { user: null, loading: false, isGuest: false };
    mockHasReadingHistory.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not check tutorial state while auth is loading', () => {
    mockAuthState = { user: null, loading: true, isGuest: false };
    const { queryByText } = render(<ReaderTutorial />);

    expect(mockHasSeenTutorial).not.toHaveBeenCalled();
    expect(queryByText('reader-tutorial-modal')).toBeNull();
  });

  it('hides stale visible modal when user identity resolves to a seen tutorial', async () => {
    mockHasSeenTutorial.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = render(<ReaderTutorial />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(view.queryByText('reader-tutorial-modal')).toBeTruthy();

    mockAuthState = { user: { id: 'u1' }, loading: false, isGuest: false };
    view.rerender(<ReaderTutorial />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.queryByText('reader-tutorial-modal')).toBeNull();
    expect(mockHasSeenTutorial).toHaveBeenCalledTimes(2);
  });

  it('auto-marks tutorial seen for signed-in returning users with reading history', async () => {
    mockAuthState = { user: { id: 'u42' }, loading: false, isGuest: false };
    mockHasSeenTutorial.mockResolvedValue(false);
    mockHasReadingHistory.mockResolvedValue(true);
    const view = render(<ReaderTutorial />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(mockHasReadingHistory).toHaveBeenCalledWith('u42');
    expect(mockMarkTutorialSeen).toHaveBeenCalledWith('@lingoleaf:reader_tutorial_seen', 'u42');
    expect(view.queryByText('reader-tutorial-modal')).toBeNull();
  });
});
