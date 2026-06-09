import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  minutesDone: number;
  goalMinutes: number;
}

export function GoalProgressBar({ minutesDone, goalMinutes }: Props) {
  const safeGoal = Math.max(1, goalMinutes);
  const t = useTranslation();
  const pct = Math.max(0, Math.min(100, Math.round((minutesDone / safeGoal) * 100)));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('home.today')}</Text>
        <Text style={styles.value}>{minutesDone}/{goalMinutes} {t('profile.minutes')} • {pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
});
