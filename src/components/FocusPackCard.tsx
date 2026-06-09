/**
 * FocusPackCard
 *
 * Compact entrypoint for the daily focus pack.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StudyPack } from '@/study/focusPack';
import { colors, spacing, typography } from '@/theme';

interface Props {
  pack: StudyPack;
  buttonLabel: string;
  caption: string;
  metaText: string;
  onPress: () => void;
}

export function FocusPackCard({ pack, buttonLabel, caption, metaText, onPress }: Props) {
  const showCoachLine = pack.metadataSource !== 'fallback';

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{caption}</Text>
        </View>
        <Text style={styles.total}>{pack.targetCount}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{pack.title}</Text>
        {showCoachLine ? <Text style={styles.coachLine}>{pack.coachLine}</Text> : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.meta}>{metaText}</Text>
        <View style={styles.ctaChip}>
          <Text style={styles.ctaText}>{buttonLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  total: {
    ...typography.h2,
    color: colors.primary,
  },
  body: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  coachLine: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ctaChip: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '700',
  },
});
