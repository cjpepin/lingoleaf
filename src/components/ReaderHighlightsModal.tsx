/**
 * ReaderHighlightsModal
 *
 * Modal listing highlights for the current book.
 * - Tap highlight to jump
 * - Delete highlight
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { UserBookHighlight } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  visible: boolean;
  highlights: UserBookHighlight[];
  onClose: () => void;
  onJumpToCfiRange: (cfiRange: string) => void;
  onDelete: (highlight: UserBookHighlight) => void;
}

export function ReaderHighlightsModal({ visible, highlights, onClose, onJumpToCfiRange, onDelete }: Props) {
  const t = useTranslation();
  const sorted = useMemo(() => {
    return highlights.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [highlights]);

  return (
    <OverlayModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('readerHighlights.title')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>{t('translate.close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>{t('readerHighlights.empty')}</Text>
        ) : (
          sorted.map((h) => (
            <View key={h.id} style={styles.row}>
              <TouchableOpacity style={styles.main} onPress={() => onJumpToCfiRange(h.cfi_range)}>
                <Text style={styles.text} numberOfLines={2}>
                  {h.selected_text}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.delete} onPress={() => onDelete(h)}>
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  close: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
  },
  main: {
    flex: 1,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  delete: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
});

