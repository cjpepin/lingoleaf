/**
 * ReaderOverlays
 *
 * Small floating UI overlay for the reader:
 * - Navigate button (bottom center)
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  currentPage: number;
  totalPages: number;
  pageLoading?: boolean;
  chapterLeftPct?: number | null;
  onPressNavigate: () => void;
}

export function ReaderOverlays({
  currentPage,
  totalPages,
  pageLoading = false,
  chapterLeftPct = null,
  onPressNavigate,
}: Props) {
  const t = useTranslation();
  return (
    <>
      <View style={styles.pageIndicator}>
        {currentPage <= 0 ? (
          <View style={styles.pageLoadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.pageText}>Loading…</Text>
          </View>
        ) : totalPages <= 0 ? (
          <View style={styles.pageLoadingRow}>
            {pageLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.pageText}>Page {currentPage}</Text>
          </View>
        ) : (
          <>
            <View style={styles.pageRow}>
              {pageLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
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

      <Pressable style={styles.navButton} onPress={onPressNavigate}>
        <Text style={styles.navButtonText}>{t('reader.navigate')}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  pageIndicator: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pageText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chapterText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  pageLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navButton: {
    position: 'absolute',
    bottom: spacing.lg,
    left: '50%',
    transform: [{ translateX: -50 }],
    width: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
    zIndex: 6,
  },
  navButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
});


