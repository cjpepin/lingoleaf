import React from 'react';
import { act, render } from '@testing-library/react-native';
import { HomeTutorial } from '@/components/HomeTutorial';

const mockHasSeenTutorial = jest.fn();
const mockMarkTutorialSeen = jest.fn();
let mockAuthState: { user: { id: string } | null; loading: boolean } = { user: null, loading: false };

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null; loading: boolean }) => unknown) =>
    selector(mockAuthState),
}));

jest.mock('@/utils/tutorialSeen', () => ({
  hasSeenTutorial: (...args: unknown[]) => mockHasSeenTutorial(...args),
  markTutorialSeen: (...args: unknown[]) => mockMarkTutorialSeen(...args),
}));

jest.mock('@/components/HomeTutorialModal', () => {
  const ReactLib = require('react');
  const { Text: NativeText } = require('react-native');
  return {
    HomeTutorialModal: () => ReactLib.createElement(NativeText, null, 'home-tutorial-modal'),
  };
});

describe('HomeTutorial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthState = { user: null, loading: false };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not check tutorial state while auth is loading', () => {
    mockAuthState = { user: null, loading: true };
    const { queryByText } = render(<HomeTutorial ready />);

    expect(mockHasSeenTutorial).not.toHaveBeenCalled();
    expect(queryByText('home-tutorial-modal')).toBeNull();
  });

  it('hides stale visible modal when user identity resolves to a seen tutorial', async () => {
    mockHasSeenTutorial.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = render(<HomeTutorial ready />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(view.queryByText('home-tutorial-modal')).toBeTruthy();

    mockAuthState = { user: { id: 'u1' }, loading: false };
    view.rerender(<HomeTutorial ready />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.queryByText('home-tutorial-modal')).toBeNull();
    expect(mockHasSeenTutorial).toHaveBeenCalledTimes(2);
  });
});
