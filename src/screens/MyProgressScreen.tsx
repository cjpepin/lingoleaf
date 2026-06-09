import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { usePremium } from '@/premium/PremiumProvider';
import { track } from '@/analytics/client';
import { colors, spacing, typography } from '@/theme';
import { SegmentedTabs } from '@/components/progress/SegmentedTabs';
import { StatCard } from '@/components/progress/StatCard';
import { GardenSummaryCard } from '@/components/progress/GardenSummaryCard';
import { ProgressChartCard } from '@/components/progress/ProgressChartCard';
import { useProgressStats } from '@/hooks/useProgressStats';
import { useGardenState } from '@/hooks/useGardenState';
import type { ProgressRange } from '@/supabase/queries';
import { resolveGoalCardTone, resolveSupportCardTone } from '@/screens/progress/cardTone';
import { usePremiumGate } from '@/premium/usePremiumGate';
import { AdBanner } from '@/components/ads/AdBanner';

export default function MyProgressScreen() {
  const t = useTranslation();
  const { isPremium } = usePremium();
  const { openPaywallOrAuth } = usePremiumGate();
  const [range, setRange] = useState<ProgressRange>('week');
  const stats = useProgressStats(range);
  const garden = useGardenState({ placement: 'my_progress_screen' });
  const goalState = garden.snapshot
    ? {
        minutesGoalMet: garden.snapshot.daily.reading_minutes >= garden.snapshot.goalMinutes,
        savedGoalMet: garden.snapshot.daily.saved_count >= garden.snapshot.savedGoal,
        learnedGoalMet: garden.snapshot.daily.learned_count >= garden.snapshot.learnedGoal,
      }
    : {
        minutesGoalMet: false,
        savedGoalMet: false,
        learnedGoalMet: false,
      };

  const tabs = useMemo(() => ([
    { key: 'day', label: t('progress.day') },
    { key: 'week', label: t('progress.week') },
    { key: 'month', label: t('progress.month'), locked: !isPremium },
    { key: 'year', label: t('progress.year'), locked: !isPremium },
  ]), [isPremium, t]);

  const handleTabPress = (nextKey: string, locked: boolean) => {
    const nextRange = nextKey as ProgressRange;
    if (locked) {
      if (!openPaywallOrAuth('settings', 'my_progress_locked_tab')) {
        return;
      }
      track('progress_viewed', {
        range: nextRange,
        is_premium: isPremium,
        locked: true,
      });
      return;
    }

    setRange(nextRange);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {garden.snapshot ? <GardenSummaryCard snapshot={garden.snapshot} showProgressHint={false} /> : null}
      {!isPremium ? <AdBanner placement="my_progress_top" /> : null}

      <SegmentedTabs tabs={tabs} activeKey={range} onPress={handleTabPress} />

      {stats.loading ? <ActivityIndicator color={colors.primary} /> : null}
      {stats.trends ? (
        <Text style={styles.trendSummary}>
          {t('progress.trendSummary', { days: stats.trends.windowDays })}
        </Text>
      ) : null}

      <View style={styles.statsRows}>
        <View style={styles.rowThree} testID="stats-row-top">
          <StatCard
            label={t('progress.minutesRead')}
            value={stats.minutesRead}
            icon="clock"
            tone={resolveGoalCardTone({ goalMet: goalState.minutesGoalMet, trend: stats.trends?.minutesRead })}
            trend={stats.trends?.minutesRead}
            containerStyle={styles.rowThreeCard}
          />
          <StatCard
            label={t('progress.wordsSaved')}
            value={stats.wordsSaved}
            icon="bookmark"
            tone={resolveGoalCardTone({ goalMet: goalState.savedGoalMet, trend: stats.trends?.wordsSaved })}
            trend={stats.trends?.wordsSaved}
            containerStyle={styles.rowThreeCard}
          />
          <StatCard
            label={t('progress.wordsLearned')}
            value={stats.wordsLearned}
            icon="check-circle"
            tone={resolveGoalCardTone({ goalMet: goalState.learnedGoalMet })}
            containerStyle={styles.rowThreeCard}
          />
        </View>
        <View style={styles.rowTwo} testID="stats-row-bottom">
          <StatCard
            label={t('progress.streakDays')}
            value={stats.streakDays}
            icon="zap"
            tone={stats.streakDays >= 7 ? 'positive' : stats.streakDays >= 3 ? 'info' : 'neutral'}
            containerStyle={styles.rowTwoCard}
          />
          <StatCard
            label={t('progress.wordsReviewed')}
            value={stats.wordsReviewed}
            icon="repeat"
            tone={resolveSupportCardTone({ trend: stats.trends?.wordsReviewed })}
            trend={stats.trends?.wordsReviewed}
            containerStyle={styles.rowTwoCard}
          />
        </View>
      </View>
      {!isPremium ? <AdBanner placement="my_progress_mid" /> : null}

      <ProgressChartCard timeline={stats.timeline} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  statsRows: {
    gap: spacing.sm,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowThree: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowTwoCard: {
    flex: 1,
    minWidth: 0,
  },
  rowThreeCard: {
    flex: 1,
    minWidth: 0,
  },
  trendSummary: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
