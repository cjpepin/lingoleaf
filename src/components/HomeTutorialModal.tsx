/**
 * HomeTutorialModal
 *
 * Walkthrough for Home: progress garden card, jump-back-in books, and study lists.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import { TutorialTooltip } from './TutorialTooltip';
import { TutorialShell } from './TutorialShell';
import { useTutorialViewport } from './tutorialLayout';
import { GardenStageVisual } from '@/components/progress/GardenStageVisual';

const TOTAL_STEPS = 3;

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface MockCoverProps {
  title: string;
  author: string;
  backgroundColor: string;
}

function MockCover({ title, author, backgroundColor }: MockCoverProps) {
  return (
    <View style={styles.mockBookTile}>
      <View style={[styles.mockCover, { backgroundColor }]}>
        <Text style={styles.mockCoverTitle} numberOfLines={3}>{title}</Text>
        <Text style={styles.mockCoverAuthor} numberOfLines={1}>{author}</Text>
      </View>
      <Text style={styles.mockBookTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.mockBookAuthor} numberOfLines={1}>{author}</Text>
    </View>
  );
}

export function HomeTutorialModal({ visible, onComplete, onSkip }: Props) {
  const t = useTranslation();
  const { compact, s } = useTutorialViewport();
  const [step, setStep] = useState(0);
  const previewScrollRef = useRef<ScrollView | null>(null);
  const cardOffsetsRef = useRef<number[]>([]);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const handleCardLayout = useCallback((index: number, y: number) => {
    cardOffsetsRef.current[index] = y;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const targetOffset = cardOffsetsRef.current[step];
    if (typeof targetOffset !== 'number' || !Number.isFinite(targetOffset)) return;

    const timeout = setTimeout(() => {
      previewScrollRef.current?.scrollTo({
        y: Math.max(0, targetOffset - spacing.sm),
        animated: true,
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [step, visible]);

  const steps = [
    {
      title: t('tutorial.homeOverviewTitle'),
      desc: t('tutorial.homeOverviewDesc'),
    },
    {
      title: t('tutorial.homeJumpBackInTitle'),
      desc: t('tutorial.homeJumpBackInDesc'),
    },
    {
      title: t('tutorial.homeStudyListsTitle'),
      desc: t('tutorial.homeStudyListsDesc'),
    },
  ];

  const cur = steps[step];

  const overviewHighlighted = step === 0;
  const jumpHighlighted = step === 1;
  const studyHighlighted = step === 2;
  const sampleCovers: Array<{ title: string; author: string; backgroundColor: string }> = [
    {
      title: t('tutorial.homeMockBook1Title'),
      author: t('tutorial.homeMockBook1Author'),
      backgroundColor: '#F4E7D3',
    },
    {
      title: t('tutorial.homeMockBook2Title'),
      author: t('tutorial.homeMockBook2Author'),
      backgroundColor: '#E3ECD7',
    },
    {
      title: t('tutorial.homeMockBook3Title'),
      author: t('tutorial.homeMockBook3Author'),
      backgroundColor: '#DFE7F7',
    },
  ];

  return (
    <TutorialShell visible={visible}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: s(compact ? 44 : 56) }]}>
          <Text style={[styles.headerTitle, compact && styles.headerTitleCompact]}>{t('nav.home')}</Text>
        </View>
        <View style={styles.previewWrap}>
          <ScrollView
            ref={previewScrollRef}
            style={styles.previewScroll}
            contentContainerStyle={[styles.previewContent, compact && styles.previewContentCompact]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[styles.card, overviewHighlighted && styles.highlight]}
              onLayout={(event) => handleCardLayout(0, event.nativeEvent.layout.y)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t('garden.title')}</Text>
                <Text style={styles.stagePill}>{t('garden.stage.young_tree')}</Text>
              </View>
              <GardenStageVisual stage="young_tree" freshness="fresh" compact />
              <Text style={styles.cardBody}>{t('garden.growthHint')}</Text>
              <Text style={styles.inlineHintText}>{t('garden.todaySummary', { minutes: 16, saved: 4, studied: 6 })}</Text>
              <Text style={styles.inlineHintText}>{t('progress.streakDays')}: 4</Text>
              <Text style={styles.cardBody}>{t('home.dailyGoal')}</Text>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>{t('home.today')}</Text>
                <View style={styles.progressTrack}>
                  <View style={styles.progressFill} />
                </View>
                <Text style={styles.goalPercent}>{t('tutorial.homeMockGoalPercent')}</Text>
              </View>
              <View style={styles.progressCta}>
                <Text style={styles.progressCtaText}>{t('home.viewProgress')}</Text>
              </View>
            </View>

            <View
              style={[styles.card, jumpHighlighted && styles.highlight]}
              onLayout={(event) => handleCardLayout(1, event.nativeEvent.layout.y)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t('home.jumpBackIn')}</Text>
                <View style={styles.inlineHint}>
                  <Text style={styles.inlineHintText}>{t('home.seeMore')}</Text>
                  <Feather name="chevron-right" size={14} color={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.bookRow}>
                {sampleCovers.map((cover) => (
                  <MockCover
                    key={`${cover.title}-${cover.author}`}
                    title={cover.title}
                    author={cover.author}
                    backgroundColor={cover.backgroundColor}
                  />
                ))}
              </View>
            </View>

            <View
              style={[styles.card, studyHighlighted && styles.highlight]}
              onLayout={(event) => handleCardLayout(2, event.nativeEvent.layout.y)}
            >
              <Text style={styles.cardTitle}>{t('home.readyToStudyTitle')}</Text>
              <View style={styles.listRow}>
                <View style={styles.listRowLeft}>
                  <Text style={styles.listName}>{t('tutorial.homeMockList1Name')}</Text>
                  <Text style={styles.listMeta}>8 {t('home.cardsReady')}</Text>
                </View>
                <View style={styles.studyNowChip}>
                  <Text style={styles.studyNowChipText}>{t('home.studyNow')}</Text>
                </View>
              </View>
              <View style={styles.listRow}>
                <View style={styles.listRowLeft}>
                  <Text style={styles.listName}>{t('tutorial.homeMockList2Name')}</Text>
                  <Text style={styles.listMeta}>4 {t('home.cardsReady')}</Text>
                </View>
                <View style={styles.studyNowChip}>
                  <Text style={styles.studyNowChipText}>{t('home.studyNow')}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.tooltipWrap}>
          <TutorialTooltip
            title={cur.title}
            description={cur.desc}
            currentStep={step}
            totalSteps={TOTAL_STEPS}
            onNext={() => {
              if (step < TOTAL_STEPS - 1) {
                setStep((prev) => prev + 1);
                return;
              }
              onComplete();
            }}
            onSkip={onSkip}
            onBack={step > 0 ? () => setStep((prev) => Math.max(0, prev - 1)) : undefined}
            isLast={step === TOTAL_STEPS - 1}
            skipLabel={t('tutorial.skip')}
            nextLabel={t('tutorial.next')}
            doneLabel={t('tutorial.done')}
            backLabel={t('tutorial.back')}
            compact
          />
        </View>
      </View>
    </TutorialShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerTitleCompact: {
    fontSize: 20,
  },
  previewWrap: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 140,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  previewContentCompact: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  highlight: { borderColor: colors.primary, borderWidth: 2 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  stagePill: {
    ...typography.caption,
    color: colors.primary,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    textTransform: 'capitalize',
  },
  inlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineHintText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    width: '55%',
    backgroundColor: colors.primary,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  goalPercent: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  progressCta: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  progressCtaText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mockBookTile: {
    flex: 1,
    gap: spacing.xs,
  },
  mockCover: {
    width: '100%',
    aspectRatio: 0.66,
    borderRadius: 10,
    padding: spacing.xs,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mockCoverTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 13,
  },
  mockCoverAuthor: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  mockBookTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  mockBookAuthor: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listRowLeft: {
    flex: 1,
    gap: 2,
  },
  listName: {
    ...typography.body,
    color: colors.text,
  },
  listMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  studyNowChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  studyNowChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  tooltipWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.sm,
    zIndex: 10,
  },
});
