/**
 * PaywallScreen
 * Premium plan selection and purchase flow.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui/Button';
import { LEGAL_URLS } from '@/constants/legal';
import { type PremiumPlan } from '@/premium/config';
import { usePremium } from '@/premium/PremiumProvider';
import { track } from '@/analytics/client';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

const VALUE_BULLETS = [
  'paywall.value.removeAds',
  'paywall.value.exportCsv',
  'paywall.value.unlimitedLists',
  'paywall.value.supportDevelopment',
] as const;

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PaywallRoute = RouteProp<RootStackParamList, 'Paywall'>;

const PRICE_USD = {
  monthly: 9.99,
  yearly: 69.99,
  lifetime: 119.99,
} as const;

const YEARLY_SAVINGS_PCT = Math.round((1 - (PRICE_USD.yearly / (PRICE_USD.monthly * 12))) * 100);
const LIFETIME_MONTH_BREAK_EVEN = Math.ceil(PRICE_USD.lifetime / PRICE_USD.monthly);

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PaywallRoute>();
  const { isPremium, purchase, restore } = usePremium();
  const t = useTranslation();

  const source = route.params?.source ?? 'settings';
  const placement = route.params?.placement ?? 'paywall_screen';

  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const dismissTrackedRef = useRef(false);
  const selectedPlanRef = useRef<PremiumPlan>('yearly');

  useEffect(() => {
    selectedPlanRef.current = selectedPlan;
  }, [selectedPlan]);

  useEffect(() => {
    track('paywall_viewed', {
      source,
      placement,
      plan_selected: selectedPlan,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when paywall opens
  }, [placement, source]);

  useEffect(() => {
    return () => {
      if (dismissTrackedRef.current) return;
      track('paywall_dismissed', {
        source,
        placement,
        plan_selected: selectedPlanRef.current,
      });
    };
  }, [placement, source]);

  const planCards = useMemo<Array<{
    id: PremiumPlan;
    title: string;
    priceLabel: string;
    billingLabel: string;
    savingsLabel?: string;
    badge?: string;
  }>>(() => ([
    {
      id: 'monthly',
      title: t('paywall.plan.monthly'),
      priceLabel: `$${PRICE_USD.monthly.toFixed(2)}`,
      billingLabel: t('paywall.plan.monthlyBilling'),
    },
    {
      id: 'yearly',
      title: t('paywall.plan.yearly'),
      priceLabel: `$${PRICE_USD.yearly.toFixed(2)}`,
      billingLabel: t('paywall.plan.yearlyBilling', { monthly_equivalent: (PRICE_USD.yearly / 12).toFixed(2) }),
      savingsLabel: t('paywall.plan.yearlySavings', { percent: YEARLY_SAVINGS_PCT }),
      badge: t('paywall.badge.popular'),
    },
    {
      id: 'lifetime',
      title: t('paywall.plan.lifetime'),
      priceLabel: `$${PRICE_USD.lifetime.toFixed(2)}`,
      billingLabel: t('paywall.plan.lifetimeSavings'),
      badge: t('paywall.badge.bestValue'),
    },
  ]), [t]);

  const selectedPlanPrice = PRICE_USD[selectedPlan];

  const dismiss = () => {
    dismissTrackedRef.current = true;
    track('paywall_dismissed', {
      source,
      placement,
      plan_selected: selectedPlan,
    });
    navigation.goBack();
  };

  const handleStartPremium = async () => {
    setPurchasing(true);
    try {
      const outcome = await purchase(selectedPlan, source, placement);
      if (outcome === 'success') {
        Alert.alert(t('paywall.alert.activatedTitle'), t('paywall.alert.activatedBody'));
        dismissTrackedRef.current = true;
        navigation.goBack();
        return;
      }
      if (outcome === 'error') {
        Alert.alert(t('paywall.alert.unavailableTitle'), t('paywall.alert.unavailableBody'));
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const outcome = await restore(source);
    if (outcome === 'success') {
      Alert.alert(t('paywall.alert.restoredTitle'), t('paywall.alert.restoredBody'));
      return;
    }
    if (outcome === 'error') {
      Alert.alert(t('paywall.alert.unavailableTitle'), t('paywall.alert.unavailableBody'));
      return;
    }
    Alert.alert(t('paywall.alert.nothingToRestoreTitle'), t('paywall.alert.nothingToRestoreBody'));
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(t('paywall.alert.unableOpenLink'));
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('paywall.title')}</Text>
      <Text style={styles.subtitle}>{isPremium ? t('paywall.subtitleActive') : t('paywall.subtitleInactive')}</Text>

      <View style={styles.valueWrap}>
        {VALUE_BULLETS.map((key) => (
          <Text key={key} style={styles.bullet}>• {t(key)}</Text>
        ))}
      </View>

      <View style={styles.plansWrap}>
        {planCards.map((plan) => {
          const selected = selectedPlan === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, selected && styles.planCardSelected]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <View style={styles.planHeaderRow}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                {plan.badge ? <Text style={styles.planBadge}>{plan.badge}</Text> : null}
              </View>
              <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              <Text style={styles.planSubtitle}>{plan.billingLabel}</Text>
              {plan.savingsLabel ? <Text style={styles.planSavings}>{plan.savingsLabel}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          label={purchasing ? t('paywall.starting') : t('paywall.startPremiumPrice', { price: selectedPlanPrice.toFixed(2) })}
          variant="primary"
          onPress={() => void handleStartPremium()}
          disabled={purchasing}
        />
        <Button label={t('paywall.restore')} variant="surface" onPress={() => void handleRestore()} />
        <Button label={t('paywall.continueFree')} variant="outline" onPress={dismiss} />
      </View>

      <View style={styles.links}>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.terms)}>
          <Text style={styles.linkText}>{t('paywall.terms')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.privacy)}>
          <Text style={styles.linkText}>{t('paywall.privacy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.iosManageSubscriptions)}>
          <Text style={styles.linkText}>{t('paywall.cancelSubscription')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.iosRefunds)}>
          <Text style={styles.linkText}>{t('paywall.requestRefundApple')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  valueWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bullet: {
    ...typography.body,
    color: colors.text,
  },
  plansWrap: {
    gap: spacing.sm,
  },
  planCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  planBadge: {
    ...typography.caption,
    color: colors.background,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    overflow: 'hidden',
    fontWeight: '700',
  },
  planPrice: {
    ...typography.h2,
    color: colors.text,
  },
  planSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  planSavings: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  planSku: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
  links: {
    marginTop: spacing.sm,
    flexDirection: 'column',
    gap: spacing.sm,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
});
