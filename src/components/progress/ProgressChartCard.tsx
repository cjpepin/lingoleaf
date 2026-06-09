import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { ProgressTimeline } from '@/supabase/queries';
import { averagePerDay, bestDay, buildChartBars } from '@/screens/progress/chart';

interface Props {
  timeline: ProgressTimeline | null;
}

function barsForWindowDays(windowDays: number): number {
  if (windowDays <= 1) return 1;
  if (windowDays <= 7) return 7;
  if (windowDays <= 30) return 15;
  if (windowDays <= 90) return 20;
  return 24;
}

export function ProgressChartCard({ timeline }: Props) {
  const t = useTranslation();
  const bars = useMemo(() => {
    if (!timeline) return [];
    return buildChartBars(
      timeline.points.map((point) => ({ day: point.day, value: point.minutesRead })),
      barsForWindowDays(timeline.windowDays)
    );
  }, [timeline]);

  const maxValue = useMemo(() => {
    if (bars.length === 0) return 1;
    return Math.max(1, ...bars.map((bar) => bar.value));
  }, [bars]);

  const avg = useMemo(() => {
    if (!timeline) return 0;
    return averagePerDay(timeline.points.map((point) => ({ day: point.day, value: point.minutesRead })));
  }, [timeline]);

  const best = useMemo(() => {
    if (!timeline) return 0;
    return bestDay(timeline.points.map((point) => ({ day: point.day, value: point.minutesRead })));
  }, [timeline]);

  const hasData = bars.some((bar) => bar.value > 0);
  const firstLabel = bars[0]?.label ?? '';
  const midLabel = bars[Math.floor(bars.length / 2)]?.label ?? '';
  const lastLabel = bars[bars.length - 1]?.label ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('progress.chartTitle')}</Text>
        {timeline ? <Text style={styles.subtitle}>{t('progress.trendSummary', { days: timeline.windowDays })}</Text> : null}
      </View>
      {bars.length > 0 ? (
        <>
          <View style={styles.barsRow}>
            {bars.map((bar, index) => {
              const normalized = Math.max(0.08, bar.value / maxValue);
              return (
                <View key={`${bar.label}-${index}`} style={styles.barContainer} testID="progress-chart-bar">
                  <View style={[styles.bar, { height: `${normalized * 100}%` }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>{firstLabel}</Text>
            <Text style={styles.axisLabel}>{midLabel}</Text>
            <Text style={styles.axisLabel}>{lastLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{t('progress.chartAvgPerDay')}: {avg}</Text>
            <Text style={styles.summaryText}>{t('progress.chartBestDay')}: {best}</Text>
          </View>
          {!hasData ? <Text testID="progress-chart-empty" style={styles.emptyText}>{t('progress.chartNoData')}</Text> : null}
        </>
      ) : (
        <Text testID="progress-chart-empty" style={styles.emptyText}>{t('progress.chartNoData')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  barsRow: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
    minHeight: 6,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  axisLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
