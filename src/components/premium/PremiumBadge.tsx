/**
 * Small premium status chip for headers.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

export function PremiumBadge() {
  const t = useTranslation();

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{t('premium.badge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.highlightMint,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
});
