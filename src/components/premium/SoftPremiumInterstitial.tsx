/**
 * Non-blocking upsell banner shown after enough ad impressions.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import { track } from '@/analytics/client';
import { useAdUpsellStore } from '@/state/useAdUpsellStore';
import { useTranslation } from '@/i18n/useTranslation';
import { usePremiumGate } from '@/premium/usePremiumGate';

export function SoftPremiumInterstitial() {
  const { openPaywallOrAuth } = usePremiumGate();
  const visible = useAdUpsellStore((s) => s.visible);
  const dismiss = useAdUpsellStore((s) => s.dismiss);
  const t = useTranslation();

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.portal}>
      <View style={styles.card}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('softUpsell.title')}</Text>
          <Text style={styles.body}>{t('softUpsell.body')}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={t('softUpsell.viewPlans')}
            variant="primary"
            size="sm"
            onPress={() => {
              track('paywall_viewed', {
                source: 'soft_interstitial',
                placement: 'soft_upsell_banner',
              });
              if (!openPaywallOrAuth('soft_interstitial', 'soft_upsell_banner')) {
                return;
              }
            }}
          />
          <TouchableOpacity
            onPress={() => {
              track('paywall_dismissed', {
                source: 'soft_interstitial',
                placement: 'soft_upsell_banner',
              });
              dismiss();
            }}
          >
            <Text style={styles.dismissText}>{t('softUpsell.notNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  textWrap: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
