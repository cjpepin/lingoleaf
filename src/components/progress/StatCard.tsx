import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import type { MetricTrend } from '@/screens/progress/trend';

interface Props {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof Feather>['name'];
  trend?: MetricTrend | null;
  trendLabel?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'info';
  containerStyle?: StyleProp<ViewStyle>;
}

function trendColor(direction: MetricTrend['direction']): string {
  if (direction === 'up') return colors.success;
  if (direction === 'down') return colors.error;
  return colors.textSecondary;
}

function trendIcon(direction: MetricTrend['direction']): React.ComponentProps<typeof Feather>['name'] {
  if (direction === 'up') return 'arrow-up-right';
  if (direction === 'down') return 'arrow-down-right';
  return 'minus';
}

function toneStyle(tone: NonNullable<Props['tone']>) {
  if (tone === 'positive') {
    return { backgroundColor: colors.highlightMint, borderColor: colors.primaryLight };
  }
  if (tone === 'warning') {
    return { backgroundColor: colors.highlightYellow, borderColor: '#F0D67A' };
  }
  if (tone === 'info') {
    return { backgroundColor: '#E8F6FA', borderColor: '#AADDE8' };
  }
  return { backgroundColor: colors.surface, borderColor: colors.border };
}

function trendValueText(trend: MetricTrend): string {
  if (trend.percentChange != null) {
    if (trend.direction === 'flat') return '0%';
    return `${trend.percentChange > 0 ? '+' : ''}${trend.percentChange}%`;
  }
  if (trend.direction === 'flat') return '0';
  return `${trend.delta > 0 ? '+' : ''}${trend.delta}`;
}

export function StatCard({ label, value, icon, trend, trendLabel, tone = 'neutral', containerStyle }: Props) {
  const resolvedTone = toneStyle(tone);
  return (
    <View style={[styles.card, resolvedTone, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
        {icon ? <Feather name={icon} size={14} color={colors.textSecondary} style={styles.icon} /> : null}
      </View>
      <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
      {trend ? (
        <View style={styles.trendRow}>
          <View style={styles.trendInline}>
            <Feather name={trendIcon(trend.direction)} size={12} color={trendColor(trend.direction)} />
            <Text style={[styles.trendValue, { color: trendColor(trend.direction) }]}>{trendValueText(trend)}</Text>
          </View>
          {trendLabel ? <Text style={styles.trendLabel}>{trendLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    flex: 1,
    minWidth: '47%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    flexShrink: 1,
  },
  icon: {
    flexShrink: 0,
  },
  value: {
    ...typography.h2,
    color: colors.text,
  },
  trendRow: {
    marginTop: spacing.xs,
    gap: 2,
  },
  trendInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendValue: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  trendLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
