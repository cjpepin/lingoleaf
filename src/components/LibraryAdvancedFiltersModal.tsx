import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { BookDifficulty, BookLengthBucket } from '@/supabase/queries';

export interface LibraryAdvancedFilters {
  difficulty?: BookDifficulty;
  lengthBucket?: BookLengthBucket;
  tags: string[];
  shortWins: boolean;
}

interface Props {
  visible: boolean;
  availableTags: string[];
  value: LibraryAdvancedFilters;
  onClose: () => void;
  onApply: (next: LibraryAdvancedFilters) => void;
  onClear: () => void;
}

const LENGTH_OPTIONS: Array<{ key: BookLengthBucket; labelKey: string }> = [
  { key: 'short', labelKey: 'library.lengthShort' },
  { key: 'medium', labelKey: 'library.lengthMedium' },
  { key: 'long', labelKey: 'library.lengthLong' },
];

export function LibraryAdvancedFiltersModal({
  visible,
  availableTags,
  value,
  onClose,
  onApply,
  onClear,
}: Props) {
  const t = useTranslation();
  const [draft, setDraft] = useState<LibraryAdvancedFilters>(value);

  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  const tags = useMemo(() => availableTags.slice(0, 80), [availableTags]);

  const toggleTag = (tag: string) => {
    setDraft((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  return (
    <OverlayModal visible={visible} onClose={onClose} cardStyle={styles.sheet}>
      <Text style={styles.title}>{t('library.filters')}</Text>

      <Text style={styles.label}>{t('library.difficulty')}</Text>
      <View style={styles.row}>
        {([
          { value: 'Easy', labelKey: 'library.difficultyEasy' },
          { value: 'Med', labelKey: 'library.difficultyMedium' },
          { value: 'Hard', labelKey: 'library.difficultyHard' },
        ] as const).map((option) => {
          const selected = draft.difficulty === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionChip, selected && styles.optionChipSelected]}
              onPress={() => setDraft((prev) => ({ ...prev, difficulty: selected ? undefined : option.value }))}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{t(option.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('library.length')}</Text>
      <View style={styles.row}>
        {LENGTH_OPTIONS.map((opt) => {
          const selected = draft.lengthBucket === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.optionChip, selected && styles.optionChipSelected]}
              onPress={() => setDraft((prev) => ({ ...prev, lengthBucket: selected ? undefined : opt.key }))}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('library.quickPicks')}</Text>
      <Pressable
        style={[styles.toggleRow, draft.shortWins && styles.toggleRowSelected]}
        onPress={() => setDraft((prev) => ({ ...prev, shortWins: !prev.shortWins }))}
      >
        <Text style={[styles.toggleText, draft.shortWins && styles.toggleTextSelected]}>
          {t('library.shortWinsOnly')}
        </Text>
      </Pressable>

      <Text style={styles.label}>{t('library.genreTags')}</Text>
      <ScrollView style={styles.tagsList} contentContainerStyle={styles.tagsWrap}>
        {tags.map((tag) => {
          const selected = draft.tags.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[styles.tagChip, selected && styles.tagChipSelected]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clearText}>{t('library.reset')}</Text>
        </TouchableOpacity>
        <Button
          label={t('library.done')}
          variant="primary"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      </View>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '86%',
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  optionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  toggleRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  toggleTextSelected: {
    color: colors.primary,
  },
  tagsList: {
    maxHeight: 180,
    marginTop: spacing.xs,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  tagChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  tagText: {
    ...typography.caption,
    color: colors.text,
  },
  tagTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
});
