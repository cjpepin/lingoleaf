import React, { useEffect } from 'react';
import { Alert, AppState, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { PremiumProvider, usePremium } from '@/premium/PremiumProvider';

const mockUseAuthStore = jest.fn();
const mockFetchUserPremiumStatus = jest.fn();
const mockSyncUserPremiumEntitlement = jest.fn();
const mockSetAnalyticsPremium = jest.fn();
const mockTrack = jest.fn();
const mockStartPremiumPurchase = jest.fn();
const mockRestorePremiumPurchases = jest.fn();
const mockFetchCurrentPremiumStatus = jest.fn();
const mockSyncRevenueCatIdentity = jest.fn();
const mockSubscribeToPremiumStatusUpdates = jest.fn();

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
    mockUseAuthStore(selector),
}));

jest.mock('@/supabase/queries', () => ({
  fetchUserPremiumStatus: (...args: unknown[]) => mockFetchUserPremiumStatus(...args),
  syncUserPremiumEntitlement: (...args: unknown[]) => mockSyncUserPremiumEntitlement(...args),
}));

jest.mock('@/analytics/client', () => ({
  setPremium: (...args: unknown[]) => mockSetAnalyticsPremium(...args),
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock('@/premium/purchases', () => ({
  startPremiumPurchase: (...args: unknown[]) => mockStartPremiumPurchase(...args),
  restorePremiumPurchases: (...args: unknown[]) => mockRestorePremiumPurchases(...args),
  fetchCurrentPremiumStatus: (...args: unknown[]) => mockFetchCurrentPremiumStatus(...args),
  syncRevenueCatIdentity: (...args: unknown[]) => mockSyncRevenueCatIdentity(...args),
  subscribeToPremiumStatusUpdates: (...args: unknown[]) => mockSubscribeToPremiumStatusUpdates(...args),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

function Probe() {
  const { isPremium, loading } = usePremium();
  return <Text>{`premium:${String(isPremium)} loading:${String(loading)}`}</Text>;
}

interface RestoreProbeProps {
  source: string;
  onDone: (value: string) => void;
}

function RestoreProbe({ source, onDone }: RestoreProbeProps) {
  const { restore } = usePremium();
  useEffect(() => {
    void (async () => {
      const result = await restore(source);
      onDone(result);
    })();
  }, [onDone, restore, source]);
  return null;
}

describe('usePremium', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    mockFetchCurrentPremiumStatus.mockResolvedValue({
      ok: false,
      isPremium: false,
      errorCode: 'iap_not_configured',
    });
    mockSyncRevenueCatIdentity.mockResolvedValue(true);
    mockSubscribeToPremiumStatusUpdates.mockResolvedValue(jest.fn());
    mockSyncUserPremiumEntitlement.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
    (AppState.addEventListener as jest.Mock).mockRestore?.();
  });

  it('loads premium state for signed-in users', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-1' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockSyncUserPremiumEntitlement).toHaveBeenCalled();
    });
    expect(mockSyncRevenueCatIdentity).toHaveBeenCalledWith('user-1');
    expect(mockSetAnalyticsPremium).toHaveBeenCalledWith(true);
  });

  it('forces free state for guests', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: null,
        isGuest: true,
      })
    );

    const { getByText } = render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(getByText('premium:false loading:false')).toBeTruthy();
    });
    expect(mockSyncRevenueCatIdentity).toHaveBeenCalledWith(null);
    expect(mockFetchUserPremiumStatus).not.toHaveBeenCalled();
  });

  it('restore returns error and prompts sign-in when user is missing', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: null,
        isGuest: false,
      })
    );

    const onDone = jest.fn();
    render(
      <PremiumProvider>
        <RestoreProbe source="settings" onDone={onDone} />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith('error');
    });
    expect(Alert.alert).toHaveBeenCalled();
    expect(mockRestorePremiumPurchases).not.toHaveBeenCalled();
  });

  it('restore success updates in-memory entitlement and returns success', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-2' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: false,
      premium_plan: null,
    });
    mockRestorePremiumPurchases.mockResolvedValue({
      ok: true,
      isPremium: true,
      premiumPlan: 'yearly',
    });

    const onDone = jest.fn();
    render(
      <PremiumProvider>
        <RestoreProbe source="profile" onDone={onDone} />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith('success');
    });
    expect(mockSetAnalyticsPremium).toHaveBeenLastCalledWith(true);
  });

  it('restore with no entitlement returns none and updates the free state', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-3' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });
    mockRestorePremiumPurchases.mockResolvedValue({
      ok: true,
      isPremium: false,
    });

    const onDone = jest.fn();
    render(
      <PremiumProvider>
        <RestoreProbe source="paywall" onDone={onDone} />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith('none');
    });
    expect(mockSetAnalyticsPremium).toHaveBeenLastCalledWith(false);
  });

  it('overrides stale cached premium state with the live entitlement result', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-4' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });
    mockFetchCurrentPremiumStatus.mockResolvedValue({
      ok: true,
      isPremium: false,
      premiumPlan: null,
    });
    mockSyncUserPremiumEntitlement.mockRejectedValue(new Error('backend unavailable'));

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockFetchCurrentPremiumStatus).toHaveBeenCalledWith('user-4', { forceRefresh: false });
    });
    expect(mockSetAnalyticsPremium).toHaveBeenLastCalledWith(false);
  });

  it('keeps DB premium state when RevenueCat identity sync is unavailable', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-5' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });
    mockSyncRevenueCatIdentity.mockResolvedValue(false);
    mockSyncUserPremiumEntitlement.mockRejectedValue(new Error('sync failed'));

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockFetchUserPremiumStatus).toHaveBeenCalledWith('user-5');
    });
    expect(mockFetchCurrentPremiumStatus).not.toHaveBeenCalledWith('user-5');
    expect(mockSetAnalyticsPremium).toHaveBeenLastCalledWith(true);
  });

  it('updates local entitlement state when RevenueCat publishes customer info changes', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-7' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'yearly',
    });
    mockSubscribeToPremiumStatusUpdates.mockImplementation(
      async (_userId: string, onUpdate: (result: { ok: boolean; isPremium: boolean; premiumPlan?: string | null }) => void) => {
        onUpdate({ ok: true, isPremium: false, premiumPlan: null });
        return jest.fn();
      }
    );

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockSetAnalyticsPremium).toHaveBeenLastCalledWith(false);
    });
  });

  it('does not attempt to persist entitlement changes from the client', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-6' },
        isGuest: false,
      })
    );
    mockFetchUserPremiumStatus.mockResolvedValue({
      is_premium: true,
      premium_plan: 'monthly',
    });
    mockFetchCurrentPremiumStatus.mockResolvedValue({
      ok: true,
      isPremium: true,
      premiumPlan: 'yearly',
    });

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockSyncUserPremiumEntitlement).toHaveBeenCalled();
    });
  });

  it('reconciles with backend entitlement status after a successful purchase', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-8' },
        isGuest: false,
      })
    );
    mockStartPremiumPurchase.mockResolvedValue({
      ok: true,
      isPremium: true,
      premiumPlan: 'monthly',
    });

    function PurchaseProbe() {
      const { purchase } = usePremium();
      useEffect(() => {
        void purchase('monthly', 'paywall', 'profile_upgrade');
      }, [purchase]);
      return null;
    }

    render(
      <PremiumProvider>
        <PurchaseProbe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockSyncUserPremiumEntitlement).toHaveBeenCalled();
    });
    expect(mockSetAnalyticsPremium).toHaveBeenCalledWith(true);
  });

  it('reconciles with backend entitlement status after a successful restore', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-9' },
        isGuest: false,
      })
    );
    mockRestorePremiumPurchases.mockResolvedValue({
      ok: true,
      isPremium: true,
      premiumPlan: 'lifetime',
    });

    const onDone = jest.fn();
    render(
      <PremiumProvider>
        <RestoreProbe source="settings" onDone={onDone} />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith('success');
    });
    expect(mockSyncUserPremiumEntitlement).toHaveBeenCalled();
  });

  it('refreshes from backend when the app returns to the foreground', async () => {
    const listeners: Array<(state: string) => void> = [];
    (AppState.addEventListener as jest.Mock).mockImplementation((_type: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    });
    mockUseAuthStore.mockImplementation((selector: (state: { user: { id: string } | null; isGuest: boolean }) => unknown) =>
      selector({
        user: { id: 'user-10' },
        isGuest: false,
      })
    );

    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>
    );

    await waitFor(() => {
      expect(mockSyncUserPremiumEntitlement).toHaveBeenCalledTimes(1);
    });

    act(() => {
      listeners[0]?.('background');
      listeners[0]?.('active');
    });

    await waitFor(() => {
      expect(mockSyncUserPremiumEntitlement).toHaveBeenCalledTimes(2);
    });
  });
});
