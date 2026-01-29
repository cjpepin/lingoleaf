/**
 * LibraryHeader
 *
 * Lightweight search + filter inputs for the Library screen.
 * Filters are applied by the parent (server-side via Supabase query).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { LANGUAGES } from '@/constants/languages';

interface Filters {
  language: string;
  author: string;
  subject: string;
}

interface Props {
  title: string;
  search: string;
  onChangeSearch: (next: string) => void;
  language: string;
  author: string;
  subject: string;
  onApplyFilters: (filters: Filters) => void;
  onResetFilters: () => void;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function LibraryHeader({
  title,
  search,
  onChangeSearch,
  language,
  author,
  subject,
  onApplyFilters,
  onResetFilters,
  ctaLabel,
  onPressCta,
}: Props) {
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(language);
  const [draftAuthor, setDraftAuthor] = useState(author);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [languageSearch, setLanguageSearch] = useState('');

  const handleReset = useCallback(() => {
    setDraftLanguage('');
    setDraftAuthor('');
    setDraftSubject('');
    onResetFilters();
  }, [onResetFilters]);

  const activeFilterCount = useMemo(() => {
    return (
      (language.trim().length > 0 ? 1 : 0) +
      (author.trim().length > 0 ? 1 : 0) +
      (subject.trim().length > 0 ? 1 : 0)
    );
  }, [author, language, subject]);

  useEffect(() => {
    if (!filtersVisible) return;
    setDraftLanguage(language);
    setDraftAuthor(author);
    setDraftSubject(subject);
  }, [author, filtersVisible, language, subject]);

  const handleApply = useCallback(() => {
    onApplyFilters({ language: draftLanguage, author: draftAuthor, subject: draftSubject });
    setFiltersVisible(false);
  }, [draftAuthor, draftLanguage, draftSubject, onApplyFilters]);

  const filteredLanguages = useMemo(() => {
    if (!languageSearch.trim()) return LANGUAGES;
    const search = languageSearch.toLowerCase();
    return LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(search) || lang.code.toLowerCase().includes(search)
    );
  }, [languageSearch]);

  const selectedLanguageName = useMemo(() => {
    if (!draftLanguage) return 'Select language';
    const lang = LANGUAGES.find((l) => l.code === draftLanguage);
    return lang ? lang.name : draftLanguage;
  }, [draftLanguage]);

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

      <OverlayModal 
        visible={filtersVisible} 
        onClose={() => {
          setFiltersVisible(false);
          setLanguagePickerVisible(false);
          setLanguageSearch('');
        }} 
        cardStyle={styles.modalCard}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters</Text>
          <Pressable onPress={() => setFiltersVisible(false)}>
            <Text style={styles.modalClose}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Language</Text>
        <Pressable
          style={styles.languagePickerButton}
          onPress={() => setLanguagePickerVisible(true)}
        >
          <Text style={[styles.languagePickerText, !draftLanguage && styles.languagePickerPlaceholder]}>
            {selectedLanguageName}
          </Text>
          <Text style={styles.languagePickerChevron}>›</Text>
        </Pressable>

        <Text style={styles.label}>Author</Text>
        <TextInput
          value={draftAuthor}
          onChangeText={setDraftAuthor}
          placeholder="e.g., Tolstoy"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>Subject / genre</Text>
        <TextInput
          value={draftSubject}
          onChangeText={setDraftSubject}
          placeholder="e.g., Fiction, Poetry"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <View style={styles.modalActions}>
          <Button label="Reset" onPress={handleReset} variant="surface" size="sm" />
          <Button label="Done" onPress={handleApply} variant="primary" size="sm" />
        </View>
      </OverlayModal>

      {/* Language Picker Modal - Separate from filters modal */}
      {languagePickerVisible && (
        <OverlayModal
          visible={languagePickerVisible}
          onClose={() => {
            setLanguagePickerVisible(false);
            setLanguageSearch('');
          }}
          cardStyle={styles.languagePickerCard}
        >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Language</Text>
          <Pressable
            onPress={() => {
              setLanguagePickerVisible(false);
              setLanguageSearch('');
            }}
          >
            <Text style={styles.modalClose}>Cancel</Text>
          </Pressable>
        </View>

        <TextInput
          value={languageSearch}
          onChangeText={setLanguageSearch}
          placeholder="Search languages..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView style={styles.languageList} contentContainerStyle={styles.languageListContent}>
          {/* Clear selection option */}
          <TouchableOpacity
            style={[styles.languageOption, !draftLanguage && styles.languageOptionSelected]}
            onPress={() => {
              setDraftLanguage('');
              setLanguagePickerVisible(false);
              setLanguageSearch('');
            }}
          >
            <Text style={[styles.languageOptionText, !draftLanguage && styles.languageOptionTextSelected]}>
              All Languages
            </Text>
            {!draftLanguage && <Text style={styles.languageCheck}>✓</Text>}
          </TouchableOpacity>

          {filteredLanguages.map((lang) => {
            const selected = draftLanguage === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.languageOption, selected && styles.languageOptionSelected]}
                onPress={() => {
                  setDraftLanguage(lang.code);
                  setLanguagePickerVisible(false);
                  setLanguageSearch('');
                }}
              >
                <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                  {lang.name}
                </Text>
                {selected && <Text style={styles.languageCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </OverlayModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
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
  languagePickerButton: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languagePickerText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  languagePickerPlaceholder: {
    color: colors.textSecondary,
  },
  languagePickerChevron: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: -2,
  },
  languagePickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
  },
  languageList: {
    marginTop: spacing.md,
  },
  languageListContent: {
    gap: spacing.sm,
  },
  languageOption: {
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
  languageOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  languageOptionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  languageOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  languageCheck: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
});


