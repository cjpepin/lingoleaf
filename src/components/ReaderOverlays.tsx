/**
 * ReaderOverlays
 *
 * Small floating page indicator for the reader (top-left).
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '@/theme';

const PAGE_INDICATOR_GREY = '#555555';

interface Props {
  currentPage: number;
  totalPages: number;
  pageLoading?: boolean;
  chapterLeftPct?: number | null;
}

export function ReaderOverlays({
  currentPage,
  totalPages,
  pageLoading = false,
  chapterLeftPct = null,
}: Props) {
  return (
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
        <>
          <View style={styles.pageRow}>
            {pageLoading ? <ActivityIndicator size="small" color={PAGE_INDICATOR_GREY} /> : null}
            <Text style={styles.pageText}>
              {currentPage} / {totalPages}
            </Text>
          </View>
          {typeof chapterLeftPct === 'number' ? (
            <Text style={styles.chapterText}>{Math.max(0, Math.min(100, chapterLeftPct))}% left in this chapter</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  chapterText: {
    color: PAGE_INDICATOR_GREY,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
  pageLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
