/**
 * VocabListPickerModal
 *
 * Simple modal for selecting a vocab list.
 */

import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { VocabList } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  visible: boolean;
  title: string;
  lists: VocabList[];
  selectedListId: string | null;
  onSelect: (listId: string) => void;
  onClose: () => void;
}

export function VocabListPickerModal({ visible, title, lists, selectedListId, onSelect, onClose }: Props) {
  const t = useTranslation();

  return (
    <OverlayModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {lists.map((l) => {
          const selected = l.id === selectedListId;
          return (
            <TouchableOpacity key={l.id} style={[styles.row, selected && styles.rowSelected]} onPress={() => onSelect(l.id)}>
              <Text style={[styles.rowText, selected && styles.rowTextSelected]} numberOfLines={1}>
                {l.name}
              </Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Button label={t('translate.close')} onPress={onClose} variant="surface" />
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
  },
  listContent: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  rowText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  rowTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  check: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
});
