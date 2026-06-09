/**
 * AdBanner
 *
 * Lightweight banner ad container with safe styling.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { bannerUnitId } from '@/ads/adIds';
import { colors, spacing } from '@/theme';
import { track } from '@/analytics/client';
import { usePremium } from '@/premium/PremiumProvider';
import { useAdUpsellStore } from '@/state/useAdUpsellStore';
import { useTranslation } from '@/i18n/useTranslation';
import { usePremiumGate } from '@/premium/usePremiumGate';
import { INLINE_CTA_COOLDOWN_IMPRESSIONS, shouldShowInlineCta } from '@/components/ads/inlineCtaPolicy';

interface Props {
  enabled?: boolean;
  placement?: string;
}

let sessionInlineCtaShownCount = 0;
let sessionNextInlineCtaEligibleImpression = 0;

export function AdBanner({ enabled = true, placement = 'unknown' }: Props) {
  const { isPremium } = usePremium();
  const { openPaywallOrAuth } = usePremiumGate();
  const t = useTranslation();
  const hydrate = useAdUpsellStore((s) => s.hydrate);
  const hydrated = useAdUpsellStore((s) => s.hydrated);
  const impressionCount = useAdUpsellStore((s) => s.impressionCount);
  const recordImpression = useAdUpsellStore((s) => s.recordImpression);
  const ctaDecisionMadeRef = useRef(false);
  const [showInlineCta, setShowInlineCta] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (ctaDecisionMadeRef.current) return;
    if (!enabled || isPremium || !hydrated) return;

    ctaDecisionMadeRef.current = true;
    const shouldShow = shouldShowInlineCta(
      {
        enabled,
        isPremium,
        hydrated,
        impressionCount,
        sessionShownCount: sessionInlineCtaShownCount,
        nextEligibleImpression: sessionNextInlineCtaEligibleImpression,
      },
      Math.random()
    );

    if (!shouldShow) return;

    setShowInlineCta(true);
    sessionInlineCtaShownCount += 1;
    sessionNextInlineCtaEligibleImpression = impressionCount + INLINE_CTA_COOLDOWN_IMPRESSIONS;
  }, [enabled, hydrated, impressionCount, isPremium]);

  if (!enabled || isPremium) return null;

  if (showInlineCta) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => {
            openPaywallOrAuth('remove_ads', `${placement}_ad_slot_cta`);
          }}
        >
          <Text style={styles.ctaTitle}>{t('adCta.title')}</Text>
          <Text style={styles.ctaBody}>{t('adCta.body')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={bannerUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdImpression={() => {
          void recordImpression(isPremium);
          track('ad_impression', {
            network: 'admob',
            placement,
            source: 'ad_banner',
          });
        }}
        onAdClicked={() => {
          track('ad_clicked', {
            placement,
            source: 'ad_banner',
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  ctaCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.highlightMint,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ctaTitle: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  ctaBody: {
    color: colors.text,
    fontWeight: '600',
  },
});
