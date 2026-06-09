import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useTranslation } from '@/i18n/useTranslation';
import { promptAuthForPremium } from '@/premium/promptAuthForPremium';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PaywallSource = RootStackParamList['Paywall']['source'];

interface PremiumGate {
  openPaywallOrAuth: (source: PaywallSource, placement: string) => boolean;
}

export function usePremiumGate(): PremiumGate {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const t = useTranslation();

  const openPaywallOrAuth = useCallback((source: PaywallSource, placement: string): boolean => {
    if (!user || isGuest) {
      promptAuthForPremium(() => navigation.navigate('Auth', { mode: 'signin' }), t);
      return false;
    }
    navigation.navigate('Paywall', { source, placement });
    return true;
  }, [isGuest, navigation, t, user]);

  return { openPaywallOrAuth };
}
