/**
 * LibraryHeader
 *
 * Lightweight search + filter inputs for the Library screen.
 * Filters are applied by the parent (server-side via Supabase query).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';

interface Props {
  title: string;
  search: string;
  onChangeSearch: (next: string) => void;
  language: string;
  onChangeLanguage: (next: string) => void;
  author: string;
  onChangeAuthor: (next: string) => void;
  subject: string;
  onChangeSubject: (next: string) => void;
  onReset: () => void;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function LibraryHeader({
  title,
  search,
  onChangeSearch,
  language,
  onChangeLanguage,
  author,
  onChangeAuthor,
  subject,
  onChangeSubject,
  onReset,
  ctaLabel,
  onPressCta,
}: Props) {
  const [filtersVisible, setFiltersVisible] = React.useState(false);

  const handleReset = useCallback(() => {
    onReset();
  }, [onReset]);

  const activeFilterCount =
    (language.trim().length > 0 ? 1 : 0) + (author.trim().length > 0 ? 1 : 0) + (subject.trim().length > 0 ? 1 : 0);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {ctaLabel && onPressCta ? (
          <Pressable style={styles.ctaButton} onPress={onPressCta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchCol}>
          <Text style={styles.label}>Search</Text>
          <TextInput
            value={search}
            onChangeText={onChangeSearch}
            placeholder="Title or Author"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <Pressable style={styles.filtersButton} onPress={() => setFiltersVisible(true)}>
          <Text style={styles.filtersText}>{activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}</Text>
        </Pressable>
      </View>

      <OverlayModal visible={filtersVisible} onClose={() => setFiltersVisible(false)} cardStyle={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters</Text>
          <Pressable onPress={() => setFiltersVisible(false)}>
            <Text style={styles.modalClose}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Language</Text>
        <TextInput
          value={language}
          onChangeText={onChangeLanguage}
          placeholder="e.g., en, es"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={8}
        />

        <Text style={styles.label}>Author</Text>
        <TextInput
          value={author}
          onChangeText={onChangeAuthor}
          placeholder="e.g., Tolstoy"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>Subject / genre</Text>
        <TextInput
          value={subject}
          onChangeText={onChangeSubject}
          placeholder="e.g., Fiction, Poetry"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <View style={styles.modalActions}>
          <Button label="Reset" onPress={handleReset} variant="surface" size="sm" />
          <Button label="Done" onPress={() => setFiltersVisible(false)} variant="primary" size="sm" />
        </View>
      </OverlayModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  searchCol: {
    flex: 1,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filtersButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 1, // visually align with input border
  },
  filtersText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalClose: {
    ...typography.body,
    color: colors.primary,
  },
  modalActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});


