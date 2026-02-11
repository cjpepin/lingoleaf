/**
 * LibraryHeader
 *
 * Title/author search in main window; filters modal for language and subject/genre.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { LANGUAGES } from '@/constants/languages';
import { fetchBookSubjects, fetchBookLanguages } from '@/supabase/queries';
import { useTranslation } from '@/i18n/useTranslation';
import { translateLanguageCodeToName, translateLanguageNameToCode } from '@/i18n/translations';

export interface LibraryFilters {
  languages: string[];
  subjects: string[];
}

interface Props {
  title: string;
  /** Title/author search - always shown in main window */
  search: string;
  onChangeSearch: (next: string) => void;
  languages: string[];
  subjects: string[];
  onApplyFilters: (filters: LibraryFilters) => void;
  onResetFilters: () => void;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function LibraryHeader({
  title,
  search,
  onChangeSearch,
  languages,
  subjects,
  onApplyFilters,
  onResetFilters,
  ctaLabel,
  onPressCta,
}: Props) {
  const t = useTranslation();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [subjectPickerVisible, setSubjectPickerVisible] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableLanguageCodes, setAvailableLanguageCodes] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>(languages);
  const [draftSubjects, setDraftSubjects] = useState<string[]>(subjects);
  const [languageSearch, setLanguageSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const handleReset = useCallback(() => {
    setDraftLanguages([]);
    setDraftSubjects([]);
    onResetFilters();
  }, [onResetFilters]);

  const activeFilterCount = useMemo(() => {
    return (languages.length > 0 ? 1 : 0) + (subjects.length > 0 ? 1 : 0);
  }, [languages, subjects]);

  useEffect(() => {
    if (!filtersVisible) return;
    setDraftLanguages(languages);
    setDraftSubjects(subjects);
  }, [filtersVisible, languages, subjects]);

  useEffect(() => {
    if (!subjectPickerVisible) return;
    setSubjectsLoading(true);
    fetchBookSubjects(draftLanguages[0]?.trim() || undefined)
      .then(setAvailableSubjects)
      .finally(() => setSubjectsLoading(false));
  }, [subjectPickerVisible, draftLanguages]);

  useEffect(() => {
    if (!languagePickerVisible) return;
    setLanguagesLoading(true);
    const subs = draftSubjects.length > 0 ? draftSubjects : undefined;
    fetchBookLanguages(subs)
      .then(setAvailableLanguageCodes)
      .finally(() => setLanguagesLoading(false));
  }, [languagePickerVisible, draftSubjects]);

  const handleApply = useCallback(() => {
    onApplyFilters({ languages: draftLanguages, subjects: draftSubjects });
    setFiltersVisible(false);
    setLanguagePickerVisible(false);
    setSubjectPickerVisible(false);
    setLanguageSearch('');
    setSubjectSearch('');
  }, [draftLanguages, draftSubjects, onApplyFilters]);

  const hasDraftChanges = useMemo(() => {
    const a = [...draftLanguages].sort();
    const b = [...languages].sort();
    const langEq = a.length === b.length && a.every((c, i) => b[i] === c);
    const c = [...draftSubjects].sort();
    const d = [...subjects].sort();
    const subjEq = c.length === d.length && c.every((s, i) => d[i] === s);
    return !langEq || !subjEq;
  }, [draftLanguages, draftSubjects, languages, subjects]);

  const toggleLanguage = useCallback((code: string) => {
    setDraftLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort()
    );
  }, []);

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return availableSubjects;
    const s = subjectSearch.toLowerCase();
    return availableSubjects.filter((subj) => subj.toLowerCase().includes(s));
  }, [availableSubjects, subjectSearch]);

  const selectedSubjectNames = useMemo(() => {
    if (draftSubjects.length === 0) return t('library.subjectFiltersPlaceholder');
    if (draftSubjects.length === 1) return draftSubjects[0];
    return `${draftSubjects.length} ${t('library.selected')}`;
  }, [draftSubjects]);

  const toggleSubject = useCallback((subject: string) => {
    setDraftSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject].sort()
    );
  }, []);

  const languageOptions = useMemo(() => {
    if (availableLanguageCodes.length === 0) return LANGUAGES;
    const set = new Set(availableLanguageCodes);
    return LANGUAGES.filter((lang) => set.has(lang.code));
  }, [availableLanguageCodes]);

  const filteredLanguages = useMemo(() => {
    if (!languageSearch.trim()) return languageOptions;
    const search = languageSearch.toLowerCase();
    return languageOptions.filter(
      (lang) =>
        lang.name.toLowerCase().includes(search) || lang.code.toLowerCase().includes(search)
    );
  }, [languageOptions, languageSearch]);

  const selectedLanguageNames = useMemo(() => {
    if (draftLanguages.length === 0) return t('library.languageFiltersPlaceholder');
    if (draftLanguages.length === 1) {
      const lang = LANGUAGES.find((l) => l.code === draftLanguages[0]);
      return lang ? t('language.' + translateLanguageCodeToName(lang.code)) : draftLanguages[0];
    }
    return `${draftLanguages.length} ${t('library.selected')}`;
  }, [draftLanguages, t]);

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
            placeholder={t('library.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Pressable style={styles.filtersButton} onPress={() => setFiltersVisible(true)}>
          <Text style={styles.filtersText}>{activeFilterCount > 0 ? `${t('library.filters')} (${activeFilterCount})` : t('library.filters')}</Text>
        </Pressable>
      </View>

      <OverlayModal
        visible={filtersVisible || languagePickerVisible || subjectPickerVisible}
        onClose={() => {
          setFiltersVisible(false);
          setLanguagePickerVisible(false);
          setSubjectPickerVisible(false);
          setLanguageSearch('');
          setSubjectSearch('');
        }}
        cardStyle={
          languagePickerVisible || subjectPickerVisible ? styles.languagePickerCard : styles.modalCard
        }
      >
        {subjectPickerVisible ? (
          <>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('library.subjectFilters')}</Text>
              {hasDraftChanges ? (
                <Pressable onPress={handleApply} style={styles.modalDoneButton}>
                  <Text style={styles.modalDoneText}>{t('library.done')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setSubjectPickerVisible(false);
                    setSubjectSearch('');
                  }}
                >
                  <Text style={styles.modalClose}>{t('library.back')}</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              value={subjectSearch}
              onChangeText={setSubjectSearch}
              placeholder={t('library.subjectFiltersPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {subjectsLoading ? (
              <View style={styles.subjectLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.languageList} contentContainerStyle={styles.languageListContent}>
                {filteredSubjects.map((subj) => {
                  const selected = draftSubjects.includes(subj);
                  return (
                    <TouchableOpacity
                      key={subj}
                      style={[styles.languageOption, selected && styles.languageOptionSelected]}
                      onPress={() => toggleSubject(subj)}
                    >
                      <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                        {subj}
                      </Text>
                      {selected && <Text style={styles.languageCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </>
        ) : languagePickerVisible ? (
          <>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('library.languageFilters')}</Text>
              {hasDraftChanges ? (
                <Pressable onPress={handleApply} style={styles.modalDoneButton}>
                  <Text style={styles.modalDoneText}>{t('library.done')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setLanguagePickerVisible(false);
                    setLanguageSearch('');
                  }}
                >
                  <Text style={styles.modalClose}>{t('library.back')}</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder={t('library.languageFiltersPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {languagesLoading ? (
              <View style={styles.subjectLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
            <ScrollView style={styles.languageList} contentContainerStyle={styles.languageListContent}>
              <TouchableOpacity
                style={[styles.languageOption, draftLanguages.length === 0 && styles.languageOptionSelected]}
                onPress={() => setDraftLanguages([])}
              >
                <Text style={[styles.languageOptionText, draftLanguages.length === 0 && styles.languageOptionTextSelected]}>
                  {t('library.allLanguages')}
                </Text>
                {draftLanguages.length === 0 && <Text style={styles.languageCheck}>✓</Text>}
              </TouchableOpacity>

              {filteredLanguages.map((lang) => {
                const selected = draftLanguages.includes(lang.code);
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageOption, selected && styles.languageOptionSelected]}
                    onPress={() => toggleLanguage(lang.code)}
                  >
                    <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                      {t('language.' + lang.code)}
                    </Text>
                    {selected && <Text style={styles.languageCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            )}
          </>
        ) : (
          <>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('library.filters')}</Text>
              {hasDraftChanges ? (
                <Pressable onPress={handleApply} style={styles.modalDoneButton}>
                  <Text style={styles.modalDoneText}>{t('library.done')}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setFiltersVisible(false)}>
                  <Text style={styles.modalClose}>{t('library.cancel')}</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.label}>{t('library.languageFilters')}</Text>
            <TouchableOpacity
              style={styles.languagePickerButton}
              onPress={() => setLanguagePickerVisible(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.languagePickerText, draftLanguages.length === 0 && styles.languagePickerPlaceholder]}>
                {selectedLanguageNames}
              </Text>
              <Text style={styles.languagePickerChevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('library.subjectFilters')}</Text>
            <TouchableOpacity
              style={styles.languagePickerButton}
              onPress={() => setSubjectPickerVisible(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.languagePickerText,
                  draftSubjects.length === 0 && styles.languagePickerPlaceholder,
                ]}
              >
                {selectedSubjectNames}
              </Text>
              <Text style={styles.languagePickerChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <Button label={t('library.reset')} onPress={handleReset} variant="surface" size="sm" />
              <Button label={t('library.done')} onPress={handleApply} variant="primary" size="sm" />
            </View>
          </>
        )}
      </OverlayModal>
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
  modalDoneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  modalDoneText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '600',
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
    minHeight: 44,
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
  subjectLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});


