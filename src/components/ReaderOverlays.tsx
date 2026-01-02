/**
 * ReaderOverlays
 *
 * Small floating UI overlays for the reader:
 * - Page counter (top right)
 * - Highlights button (top left)
 * - Navigate button (bottom center)
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface Props {
  currentPage: number;
  totalPages: number;
  highlightsCount: number;
  onPressHighlights: () => void;
  onPressNavigate: () => void;
}

export function ReaderOverlays({ currentPage, totalPages, highlightsCount, onPressHighlights, onPressNavigate }: Props) {
  return (
    <>
      {totalPages > 0 ? (
        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            {currentPage} / {totalPages}
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.highlightsButton} onPress={onPressHighlights}>
        <Text style={styles.highlightsButtonText}>Highlights ({highlightsCount})</Text>
      </Pressable>

      <Pressable style={styles.navButton} onPress={onPressNavigate}>
        <Text style={styles.navButtonText}>Navigate</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  pageIndicator: {
    position: 'absolute',
    top: 12,
    right: 16,
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
  highlightsButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
  },
  highlightsButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
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


