import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { GardenSnapshot } from '@/supabase/queries';
import { GardenStageVisual } from '@/components/progress/GardenStageVisual';
import { GoalProgressBar } from './GoalProgressBar';
import { resolveGardenMomentum } from './gardenMomentum';

interface Props {
  snapshot: GardenSnapshot;
  showProgressHint?: boolean;
}

function stageKey(stage: string): string {
  return `garden.stage.${stage}`;
}

export function GardenSummaryCard({ snapshot, showProgressHint = true }: Props) {
  const t = useTranslation();
  const momentum = resolveGardenMomentum(snapshot);
  const goalMinutes = snapshot.goalMinutes;
  const minutesToday = snapshot.daily.reading_minutes;
  const goalsMetToday =
    (snapshot.daily.reading_minutes >= snapshot.goalMinutes ? 1 : 0) +
    (snapshot.daily.saved_count >= snapshot.savedGoal ? 1 : 0) +
    (snapshot.daily.learned_count >= snapshot.learnedGoal ? 1 : 0);
  const todaySummary = t('garden.todaySummary', {
    minutes: minutesToday,
    saved: snapshot.daily.saved_count,
    studied: snapshot.daily.learned_count,
  });
  const goalsCounter = t('garden.dailyGoalCounter', {
    met: goalsMetToday,
    total: 3,
  });
  const statusText = t(momentum.inlineKey);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('garden.title')}</Text>
        <Text style={styles.stage}>{t(stageKey(snapshot.state.stage))}</Text>
      </View>

      <GardenStageVisual
        stage={snapshot.state.stage}
        freshness={snapshot.state.freshness}
      />

      <View style={styles.contentBlock}>
        <Text
          style={[
            styles.metaStrong,
            momentum.tone === 'success' ? styles.metaStrongSuccess : null,
            momentum.tone === 'warning' ? styles.metaStrongWarning : null,
            momentum.tone === 'danger' ? styles.metaStrongDanger : null,
          ]}
        >
          {statusText}
        </Text>
        <View style={styles.dailyBlock}>
          <Text style={styles.gardenProgressTitle}>{t('home.dailyGoal')}</Text>
          <GoalProgressBar minutesDone={minutesToday} goalMinutes={goalMinutes} />
        </View>
        <Text style={styles.meta}>{todaySummary}</Text>
        <Text style={styles.meta}>{goalsCounter}</Text>
        <Text style={styles.meta}>{t('garden.streak')}: {snapshot.state.streak_days}</Text>
        {showProgressHint ? <Text style={styles.progressTapHint}>{t('home.viewProgress')} {'>'}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  stage: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  contentBlock: {
    gap: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  metaStrong: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  metaStrongSuccess: {
    color: colors.primaryDark,
  },
  metaStrongWarning: {
    color: '#8A6D1C',
  },
  metaStrongDanger: {
    color: colors.error,
  },
  dailyBlock: {
    gap: spacing.xs,
  },
  gardenProgressTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  progressTapHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
