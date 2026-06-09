/**
 * Premium entitlement provider and hook.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { setPremium as setAnalyticsPremium, track } from '@/analytics/client';
import { useAuthStore } from '@/state/useAuthStore';
import { fetchUserPremiumStatus, syncUserPremiumEntitlement } from '@/supabase/queries';
import { logger } from '@/utils/logger';
import { useTranslation } from '@/i18n/useTranslation';
import { getPremiumSku, type PremiumPlan } from './config';
import {
  fetchCurrentPremiumStatus,
  restorePremiumPurchases,
  startPremiumPurchase,
  subscribeToPremiumStatusUpdates,
  syncRevenueCatIdentity,
} from './purchases';

interface PremiumContextValue {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  purchase: (plan: PremiumPlan, source: string, placement: string) => Promise<'success' | 'cancel' | 'error'>;
  restore: (source: string) => Promise<'success' | 'none' | 'error'>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

interface Props {
  children: React.ReactNode;
}

export function PremiumProvider({ children }: Props) {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const t = useTranslation();

  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const lastTrackedPremiumRef = useRef<boolean | null>(null);

  const applyPremium = useCallback((next: boolean, source: string) => {
    setIsPremium(next);
    setAnalyticsPremium(next);

    if (lastTrackedPremiumRef.current === next) return;
    lastTrackedPremiumRef.current = next;

    track('premium_status_changed', { is_premium: next, source });
  }, []);

  const reconcileBackendPremium = useCallback(async (
    source: string,
    options: {
      fallbackToDb?: boolean;
      allowLiveBridge?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<boolean> => {
    if (!user?.id || isGuest) return false;

    const {
      fallbackToDb = true,
      allowLiveBridge = false,
      forceRefresh = false,
    } = options;

    try {
      const status = await syncUserPremiumEntitlement();
      applyPremium(status.is_premium, source);
      return true;
    } catch (error) {
      logger.warn('Backend premium entitlement sync failed', {
        source,
        userId: user.id,
        error,
      });
    }

    if (fallbackToDb) {
      try {
        const status = await fetchUserPremiumStatus(user.id);
        applyPremium(status.is_premium, `${source}_db_fallback`);
      } catch (error) {
        logger.warn('Premium DB fallback read failed', {
          source,
          userId: user.id,
          error,
        });
      }
    }

    if (allowLiveBridge) {
      try {
        const liveStatus = await fetchCurrentPremiumStatus(user.id, { forceRefresh });
        if (liveStatus.ok) {
          applyPremium(liveStatus.isPremium, `${source}_live_bridge`);
          return false;
        }
      } catch (error) {
        logger.warn('RevenueCat live entitlement bridge failed', {
          source,
          userId: user.id,
          error,
        });
      }
    }

    return false;
  }, [applyPremium, isGuest, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id || isGuest) {
      void syncRevenueCatIdentity(null);
      applyPremium(false, 'auth_change');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const identityReady = await syncRevenueCatIdentity(user.id);
      const reconciled = await reconcileBackendPremium('refresh', {
        fallbackToDb: true,
        allowLiveBridge: identityReady,
      });

      if (!reconciled && identityReady) {
        logger.warn('Premium refresh completed without backend confirmation', { userId: user.id });
      }
    } catch (error) {
      logger.error('Failed to refresh premium status', error);
      applyPremium(false, 'refresh_error');
    } finally {
      setLoading(false);
    }
  }, [applyPremium, isGuest, reconcileBackendPremium, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void syncRevenueCatIdentity(user?.id && !isGuest ? user.id : null);
  }, [isGuest, user?.id]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let disposed = false;

    if (!user?.id || isGuest) return;

    void (async () => {
      try {
        const nextUnsubscribe = await subscribeToPremiumStatusUpdates(user.id, (result) => {
          if (!result.ok) return;
          applyPremium(result.isPremium, 'customer_info_listener');
          void reconcileBackendPremium('customer_info_listener', {
            fallbackToDb: true,
          });
        });

        if (disposed) {
          nextUnsubscribe?.();
          return;
        }

        unsubscribe = nextUnsubscribe;
      } catch (error) {
        logger.warn('RevenueCat customer info listener setup failed', error);
      }
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [applyPremium, isGuest, user?.id]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = previousState === 'background' || previousState === 'inactive';
      previousState = nextState;
      if (wasBackgrounded && nextState === 'active') {
        void refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  const purchase = useCallback(async (
    plan: PremiumPlan,
    source: string,
    placement: string
  ): Promise<'success' | 'cancel' | 'error'> => {
    if (!user?.id) {
      Alert.alert(t('paywall.signInRequiredTitle'), t('paywall.signInRequiredPurchaseBody'));
      return 'error';
    }

    track('purchase_started', {
      plan,
      source,
      placement,
      price: undefined,
      currency: undefined,
    });
    track('purchase_started', {
      sku: getPremiumSku(plan),
      placement,
      source,
    });

    const result = await startPremiumPurchase(plan, user.id);

    if (!result.ok) {
      track('purchase_failed', {
        plan,
        source,
        placement,
        error_code: result.errorCode,
        severity: 'critical',
        stage: 'purchase',
      });
      track('purchase_success', {
        plan,
        source,
        result: 'error',
        error_code: result.errorCode,
      });
      return 'error';
    }

    if (!result.isPremium) {
      track('purchase_success', {
        plan,
        source,
        result: 'cancel',
      });
      return 'cancel';
    }

    applyPremium(true, 'purchase');
    void reconcileBackendPremium('purchase', {
      fallbackToDb: false,
    });

    track('purchase_success', {
      plan,
      source,
      result: 'success',
    });
    track('purchase_completed', {
      sku: getPremiumSku(plan),
      placement,
      source,
    });

    return 'success';
  }, [applyPremium, t, user?.id]);

  const restore = useCallback(async (source: string): Promise<'success' | 'none' | 'error'> => {
    if (!user?.id) {
      Alert.alert(t('paywall.signInRequiredTitle'), t('paywall.signInRequiredRestoreBody'));
      return 'error';
    }

    const result = await restorePremiumPurchases(user.id);
    if (!result.ok) {
      track('purchase_restore', {
        plan: 'lifetime',
        source,
        result: 'error',
        error_code: result.errorCode,
      });
      return 'error';
    }

    applyPremium(result.isPremium, 'restore');
    if (result.isPremium) {
      void reconcileBackendPremium('restore', {
        fallbackToDb: false,
      });
    }

    track('purchase_restore', {
      plan: 'lifetime',
      source,
      result: result.isPremium ? 'success' : 'cancel',
    });
    track('purchase_restored', { source });

    return result.isPremium ? 'success' : 'none';
  }, [applyPremium, reconcileBackendPremium, t, user?.id]);

  const value = useMemo<PremiumContextValue>(() => ({
    isPremium,
    loading,
    refresh,
    purchase,
    restore,
  }), [isPremium, loading, refresh, purchase, restore]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within PremiumProvider');
  }
  return context;
}
