/**
 * ReaderOverlays
 *
 * Floating page indicator (top-left), chapter progress indicator (top-right),
 * and daily goal loop indicator (bottom-right).
 * The chapter indicator cycles pages/percent/time on tap.
 * The daily goal loop opens a compact tooltip on tap.
 * Uses pointerEvents="box-none" so the wrapper passes touches through to the reader.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { colors, spacing } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

const PAGE_INDICATOR_GREY = '#555555';
const GOAL_RING_SIZE = 36;
const GOAL_INNER_SIZE = 26;
const GOAL_SEGMENT_COUNT = 50;
const GOAL_SEGMENT_WIDTH = 3;
const GOAL_SEGMENT_HEIGHT = 6;
const GOAL_DISTANCE_FROM_EDGE = 15;
const GOAL_SEGMENT_OFFSET = GOAL_RING_SIZE / 2 - 4;
const MS_TOOLTIP_TIMEOUT = 2000;
const GOAL_SEGMENTS = Array.from({ length: GOAL_SEGMENT_COUNT }, (_, i) => i);

type ChapterMode = 'pages' | 'percent' | 'time';

interface Props {
  currentPage: number;
  totalPages: number;
  pageLoading?: boolean;
  chapterPage?: number | null;
  chapterTotal?: number | null;
  getSecondsPerPage?: () => number | null;
  dailyMinutesRead?: number;
  dailyGoalMinutes?: number;
}

export function ReaderOverlays({
  currentPage,
  totalPages,
  pageLoading = false,
  chapterPage,
  chapterTotal,
  getSecondsPerPage,
  dailyMinutesRead = 0,
  dailyGoalMinutes = 0,
}: Props) {
  const t = useTranslation();
  const [chapterMode, setChapterMode] = useState<ChapterMode>('pages');
  const [goalTooltipVisible, setGoalTooltipVisible] = useState(false);
  const showPageCounter = !pageLoading && currentPage > 0 && totalPages > 0;

  const cycleMode = useCallback(() => {
    setChapterMode((prev) =>
      prev === 'pages' ? 'percent' : prev === 'percent' ? 'time' : 'pages'
    );
  }, []);

  const pagesLeft = chapterPage != null && chapterTotal != null ? chapterTotal - chapterPage : null;
  const chapterPct = chapterPage != null && chapterTotal != null && chapterTotal > 0
    ? Math.round((chapterPage / chapterTotal) * 100)
    : null;

  const safeGoalMinutes = Math.max(0, Math.floor(dailyGoalMinutes));
  const safeMinutesRead = Math.max(0, Math.floor(dailyMinutesRead));
  const hasDailyGoal = safeGoalMinutes > 0;
  const goalRatioRaw = hasDailyGoal ? safeMinutesRead / safeGoalMinutes : 0;
  const goalRatioClamped = Math.max(0, Math.min(goalRatioRaw, 1));
  const goalPercentDisplay = hasDailyGoal ? Math.round(goalRatioClamped * 100) : 0;
  const filledSegments = Math.round(goalRatioClamped * GOAL_SEGMENT_COUNT);
  const goalColor =
    goalPercentDisplay >= 100 ? colors.success : goalPercentDisplay > 0 ? colors.primary : colors.textTertiary;
  const goalTooltipText = t('reader.dailyGoalTooltip', {
    minutes: safeMinutesRead,
    goal: safeGoalMinutes,
    percent: goalPercentDisplay,
  });

  useEffect(() => {
    if (!goalTooltipVisible) return;
    const timeout = setTimeout(() => setGoalTooltipVisible(false), MS_TOOLTIP_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [goalTooltipVisible]);

  let chapterLabel: string | null = null;
  if (pagesLeft != null && chapterPct != null) {
    if (chapterMode === 'pages') {
      chapterLabel = t('reader.pagesLeft', { n: pagesLeft });
    } else if (chapterMode === 'percent') {
      chapterLabel = t('reader.percentChapter', { n: chapterPct });
    } else {
      const spp = getSecondsPerPage?.();
      if (spp != null && pagesLeft != null) {
        const mins = Math.ceil((pagesLeft * spp) / 60);
        chapterLabel = mins < 1
          ? t('reader.timeLeftUnder')
          : t('reader.timeLeft', { n: mins });
      } else {
        chapterLabel = t('reader.pagesLeft', { n: pagesLeft });
      }
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left: page counter */}
      <View style={styles.pageIndicator}>
        {showPageCounter ? (
          <View style={styles.pageRow}>
            <Text style={styles.pageText}>
              {currentPage} / {totalPages}
            </Text>
          </View>
        ) : (
          <View style={styles.pageLoadingRow}>
            <ActivityIndicator size="small" color={PAGE_INDICATOR_GREY} />
            <Text style={styles.pageText}>{t('reader.loading')}</Text>
          </View>
        )}
      </View>

      {/* Right: chapter progress (tappable, cycles modes) */}
      {chapterLabel != null && (
        <Pressable
          style={styles.chapterIndicator}
          onPress={cycleMode}
          hitSlop={12}
        >
          <Text style={styles.chapterText}>{chapterLabel}</Text>
        </Pressable>
      )}

      {/* Bottom-right: daily reading goal loop */}
      {hasDailyGoal && (
        <View style={styles.goalContainer} pointerEvents="box-none">
          {goalTooltipVisible ? (
            <View style={styles.goalTooltip}>
              <Text style={styles.goalTooltipText}>{goalTooltipText}</Text>
            </View>
          ) : null}
          <Pressable
            testID="reader-daily-goal-ring"
            style={styles.goalRingPressable}
            onPress={() => setGoalTooltipVisible((prev) => !prev)}
            hitSlop={12}
          >
            <View style={styles.goalRingShell}>
              {GOAL_SEGMENTS.map((segment) => (
                <View
                  key={segment}
                  style={[
                    styles.goalSegment,
                    {
                      backgroundColor: segment < filledSegments ? goalColor : colors.border,
                      transform: [
                        { rotate: `${(segment / GOAL_SEGMENT_COUNT) * 360}deg` },
                        { translateY: -GOAL_SEGMENT_OFFSET },
                      ],
                    },
                  ]}
                />
              ))}
              <View style={styles.goalRingInner} />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  pageIndicator: {
    position: 'absolute',
    top: 6,
    left: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  pageText: {
    color: PAGE_INDICATOR_GREY,
    fontSize: 13,
    fontWeight: '500',
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chapterIndicator: {
    position: 'absolute',
    top: 6,
    right: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  chapterText: {
    color: PAGE_INDICATOR_GREY,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  goalContainer: {
    position: 'absolute',
    right: GOAL_DISTANCE_FROM_EDGE,
    bottom: GOAL_DISTANCE_FROM_EDGE,
    alignItems: 'flex-end',
  },
  goalRingPressable: {
    padding: 4,
  },
  goalRingShell: {
    width: GOAL_RING_SIZE,
    height: GOAL_RING_SIZE,
    borderRadius: GOAL_RING_SIZE / 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalSegment: {
    position: 'absolute',
    left: GOAL_RING_SIZE / 2 - GOAL_SEGMENT_WIDTH / 2,
    top: GOAL_RING_SIZE / 2 - GOAL_SEGMENT_HEIGHT / 2,
    width: GOAL_SEGMENT_WIDTH,
    height: GOAL_SEGMENT_HEIGHT,
    borderRadius: 2,
  },
  goalRingInner: {
    width: GOAL_INNER_SIZE,
    height: GOAL_INNER_SIZE,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  goalTooltip: {
    marginBottom: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
  },
  goalTooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
