/**
 * AdBanner
 *
 * Lightweight banner ad container with safe styling.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { bannerUnitId } from '@/ads/adIds';
import { colors, spacing } from '@/theme';

interface Props {
  enabled?: boolean;
}

export function AdBanner({ enabled = true }: Props) {
  if (!enabled) return null;
  return (
    <View style={styles.wrap}>
      <BannerAd unitId={bannerUnitId()} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
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
});


