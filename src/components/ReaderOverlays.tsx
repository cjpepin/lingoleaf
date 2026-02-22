/**
 * ReaderOverlays
 *
 * Floating page indicator (top-left) and chapter progress indicator (top-right).
 * The right-side indicator cycles through pages/percent/time on tap.
 * Uses pointerEvents="box-none" so the wrapper passes touches through to the reader.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { colors, spacing } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

const PAGE_INDICATOR_GREY = '#555555';

type ChapterMode = 'pages' | 'percent' | 'time';

interface Props {
  currentPage: number;
  totalPages: number;
  pageLoading?: boolean;
  chapterPage?: number | null;
  chapterTotal?: number | null;
  getSecondsPerPage?: () => number | null;
}

export function ReaderOverlays({
  currentPage,
  totalPages,
  pageLoading = false,
  chapterPage,
  chapterTotal,
  getSecondsPerPage,
}: Props) {
  const t = useTranslation();
  const [chapterMode, setChapterMode] = useState<ChapterMode>('pages');

  const cycleMode = useCallback(() => {
    setChapterMode((prev) =>
      prev === 'pages' ? 'percent' : prev === 'percent' ? 'time' : 'pages'
    );
  }, []);

  const pagesLeft = chapterPage != null && chapterTotal != null ? chapterTotal - chapterPage : null;
  const chapterPct = chapterPage != null && chapterTotal != null && chapterTotal > 0
    ? Math.round((chapterPage / chapterTotal) * 100)
    : null;

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
        {currentPage <= 0 ? (
          <View style={styles.pageLoadingRow}>
            <ActivityIndicator size="small" color={PAGE_INDICATOR_GREY} />
            <Text style={styles.pageText}>Loading…</Text>
          </View>
        ) : totalPages <= 0 ? (
          <View style={styles.pageLoadingRow}>
            {pageLoading ? <ActivityIndicator size="small" color={PAGE_INDICATOR_GREY} /> : null}
            <Text style={styles.pageText}>Page {currentPage}</Text>
          </View>
        ) : (
          <View style={styles.pageRow}>
            {pageLoading ? <ActivityIndicator size="small" color={PAGE_INDICATOR_GREY} /> : null}
            <Text style={styles.pageText}>
              {currentPage} / {totalPages}
            </Text>
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
});
