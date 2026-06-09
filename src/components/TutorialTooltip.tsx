/**
 * TutorialTooltip
 *
 * Shared presentational tooltip card for mock tutorial walkthroughs.
 * Renders title, description, dot indicator, and Skip/Next actions.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface Props {
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
  isLast: boolean;
  skipLabel: string;
  nextLabel: string;
  doneLabel: string;
  backLabel?: string;
  /** When true, use smaller padding and font so more of the screen content is visible */
  compact?: boolean;
}

export function TutorialTooltip({
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  onBack,
  isLast,
  skipLabel,
  nextLabel,
  doneLabel,
  backLabel = 'Back',
  compact = false,
}: Props) {
  const showBack = currentStep > 0 && onBack != null;
  const tooltipStyle = compact ? [styles.tooltip, styles.tooltipCompact] : styles.tooltip;
  const titleStyle = compact ? [styles.title, styles.titleCompact] : styles.title;
  const descStyle = compact ? [styles.desc, styles.descCompact] : styles.desc;
  const dotsRowStyle = compact ? [styles.dotsRow, styles.dotsRowCompact] : styles.dotsRow;

  return (
    <View style={tooltipStyle}>
      <Text style={titleStyle}>{title}</Text>
      <Text style={descStyle}>{description}</Text>

      {totalSteps > 1 && (
        <View style={dotsRowStyle}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
            <Text style={styles.backText}>{backLabel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        )}
        <Pressable onPress={onNext} style={styles.nextButton} hitSlop={8}>
          <Text style={styles.nextText}>{isLast ? doneLabel : nextLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipCompact: {
    padding: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  titleCompact: {
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  desc: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  descCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  dotsRowCompact: {
    marginBottom: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
  nextText: {
    ...typography.button,
    color: colors.surface,
    fontSize: 14,
  },
});
