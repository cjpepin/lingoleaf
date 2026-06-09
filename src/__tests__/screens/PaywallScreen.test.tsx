import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PaywallScreen from '@/screens/PaywallScreen';
import { LEGAL_URLS } from '@/constants/legal';

const mockGoBack = jest.fn();
const mockTrack = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {
      source: 'settings',
      placement: 'profile_upgrade_button',
    },
  }),
}));

jest.mock('@/analytics/client', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock('@/premium/PremiumProvider', () => ({
  usePremium: () => ({
    isPremium: false,
    purchase: (...args: unknown[]) => mockPurchase(...args),
    restore: (...args: unknown[]) => mockRestore(...args),
  }),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) =>
    `${key}${params ? JSON.stringify(params) : ''}`,
}));

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks paywall viewed on mount', () => {
    render(<PaywallScreen />);

    expect(mockTrack).toHaveBeenCalledWith('paywall_viewed', {
      source: 'settings',
      placement: 'profile_upgrade_button',
      plan_selected: 'yearly',
    });
  });

  it('dismisses from continue free and tracks once', () => {
    const { getByText, unmount } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.continueFree'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('paywall_dismissed', {
      source: 'settings',
      placement: 'profile_upgrade_button',
      plan_selected: 'yearly',
    });

    const dismissedCallsBeforeUnmount = mockTrack.mock.calls.filter(([name]) => name === 'paywall_dismissed').length;
    unmount();
    const dismissedCallsAfterUnmount = mockTrack.mock.calls.filter(([name]) => name === 'paywall_dismissed').length;

    expect(dismissedCallsAfterUnmount).toBe(dismissedCallsBeforeUnmount);
  });

  it('uses selected plan in unmount dismiss tracking', () => {
    const { getByText, unmount } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.plan.monthly'));
    unmount();

    expect(mockTrack).toHaveBeenCalledWith('paywall_dismissed', {
      source: 'settings',
      placement: 'profile_upgrade_button',
      plan_selected: 'monthly',
    });
  });

  it('handles successful purchase', async () => {
    mockPurchase.mockResolvedValueOnce('success');
    const { getByText } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.startPremiumPrice{"price":"69.99"}'));

    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalledWith('yearly', 'settings', 'profile_upgrade_button');
      expect(Alert.alert).toHaveBeenCalledWith('paywall.alert.activatedTitle', 'paywall.alert.activatedBody');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows unavailable alert on purchase error', async () => {
    mockPurchase.mockResolvedValueOnce('error');
    const { getByText } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.startPremiumPrice{"price":"69.99"}'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('paywall.alert.unavailableTitle', 'paywall.alert.unavailableBody');
    });
  });

  it('handles restore outcomes', async () => {
    mockRestore.mockResolvedValueOnce('success');
    const { getByText, rerender } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.restore'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('paywall.alert.restoredTitle', 'paywall.alert.restoredBody');
    });

    mockRestore.mockResolvedValueOnce('error');
    rerender(<PaywallScreen />);
    fireEvent.press(getByText('paywall.restore'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('paywall.alert.unavailableTitle', 'paywall.alert.unavailableBody');
    });

    mockRestore.mockResolvedValueOnce('none');
    rerender(<PaywallScreen />);
    fireEvent.press(getByText('paywall.restore'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'paywall.alert.nothingToRestoreTitle',
        'paywall.alert.nothingToRestoreBody'
      );
    });
  });

  it('opens legal links and handles open failure', async () => {
    const { getByText } = render(<PaywallScreen />);

    fireEvent.press(getByText('paywall.terms'));
    expect(Linking.openURL).toHaveBeenCalledWith(LEGAL_URLS.terms);

    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('open failed'));
    fireEvent.press(getByText('paywall.privacy'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('paywall.alert.unableOpenLink');
    });
  });
});
