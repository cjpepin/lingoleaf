/**
 * BookNavigationSheet
 *
 * Reader navigation UI:
 * - Jump to page number
 * - Jump to chapter (TOC)
 * - Go back to previous spot (after a jump)
 *
 * Hidden by default; parent controls visibility.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';
import type { UserBookHighlight } from '@/supabase/types';

interface TocItem {
  label: string;
  href: string;
}

type TabKey = 'navigate' | 'highlights';

interface Props {
  visible: boolean;
  initialTab?: TabKey;
  currentPage: number;
  totalPages: number;
  tocItems: TocItem[];
  highlights?: UserBookHighlight[];
  canGoBack?: boolean;
  onClose: () => void;
  onGoToHref: (href: string) => void;
  onGoToPage: (page: number) => void;
  onGoBack?: () => void;
  onJumpToHighlight?: (cfiRange: string) => void;
  onDeleteHighlight?: (highlight: UserBookHighlight) => void;
}

export function BookNavigationSheet({
  visible,
  initialTab = 'navigate',
  currentPage,
  totalPages,
  tocItems,
  highlights = [],
  canGoBack = false,
  onClose,
  onGoToHref,
  onGoToPage,
  onGoBack,
  onJumpToHighlight,
  onDeleteHighlight,
}: Props) {
  const t = useTranslation();
  const [tab, setTab] = useState<TabKey>('navigate');
  const [pageInput, setPageInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
  }, [initialTab, visible]);

  useEffect(() => {
    if (!visible) return;
    setPageInput('');
  }, [visible]);

  const handleGoToPage = useCallback(() => {
    const n = parseInt(pageInput.trim(), 10);
    if (!Number.isFinite(n)) return;
    if (totalPages > 0 && (n < 1 || n > totalPages)) return;
    onGoToPage(n);
    setPageInput('');
    onClose();
  }, [onClose, onGoToPage, pageInput, totalPages]);

  return (
    <OverlayModal visible={visible} onClose={onClose} cardStyle={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('navModal.title')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>{t('navModal.close')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'navigate' ? styles.tabActive : null]}
          onPress={() => setTab('navigate')}
        >
          <Text style={[styles.tabText, tab === 'navigate' ? styles.tabTextActive : null]}>{t('navModal.chapters')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'highlights' ? styles.tabActive : null]}
          onPress={() => setTab('highlights')}
        >
          <Text style={[styles.tabText, tab === 'highlights' ? styles.tabTextActive : null]}>
            {t('navModal.highlightsCount', { count: highlights.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'navigate' ? (
        <>
          {canGoBack && onGoBack ? (
            <>
              <Button label={t('navModal.goBack')} onPress={() => { onGoBack(); onClose(); }} variant="outline" />
              <View style={styles.sectionSpacer} />
            </>
          ) : null}

          <Text style={styles.meta}>
            {totalPages > 0 && currentPage > 0
              ? t('navModal.pageOf', { current: currentPage, total: totalPages })
              : t('navModal.pagesLoading')}
          </Text>

          <Text style={styles.label}>{t('navModal.goToPage')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={pageInput}
              onChangeText={setPageInput}
              placeholder={totalPages > 0 ? t('navModal.pageRange', { max: totalPages }) : t('navModal.waiting')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={styles.input}
              editable={totalPages > 0}
            />
            <Button
              label={t('navModal.go')}
              onPress={handleGoToPage}
              disabled={totalPages <= 0}
              variant="primary"
              size="sm"
              style={styles.goButton}
            />
          </View>

          <View style={styles.sectionSpacer} />

          <Text style={styles.label}>{t('navModal.chapters')}</Text>
          <ScrollView contentContainerStyle={styles.chapterList}>
            {tocItems.length === 0 ? (
              <Text style={styles.empty}>{t('navModal.noChapters')}</Text>
            ) : (
              tocItems.map((c) => (
                <TouchableOpacity
                  key={c.href}
                  style={styles.chapterRow}
                  onPress={() => {
                    onGoToHref(c.href);
                    onClose();
                  }}
                >
                  <Text style={styles.chapterText} numberOfLines={2}>
                    {c.label || t('navModal.chapterFallback')}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.chapterList}>
          {highlights.length === 0 ? (
            <Text style={styles.empty}>{t('navModal.noHighlights')}</Text>
          ) : (
            highlights
              .slice()
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
              .map((h) => (
                <View key={h.id} style={styles.highlightRow}>
                  <TouchableOpacity
                    style={styles.highlightMain}
                    onPress={() => {
                      onJumpToHighlight?.(h.cfi_range);
                      onClose();
                    }}
                  >
                    <Text style={styles.highlightPage}>
                      {h.page != null && Number.isFinite(h.page) ? `p. ${h.page}` : '—'}
                    </Text>
                    <Text style={styles.chapterText} numberOfLines={2}>
                      {h.selected_text}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.highlightDelete} onPress={() => onDeleteHighlight?.(h)}>
                    <Text style={styles.highlightDeleteText}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  goButton: {
    minHeight: 0,
  },
  sectionSpacer: {
    height: spacing.lg,
  },
  chapterList: {
    gap: spacing.sm,
  },
  chapterRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
  },
  chapterText: {
    ...typography.body,
    color: colors.text,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
  },
  highlightMain: {
    flex: 1,
  },
  highlightPage: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  highlightDelete: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlightDeleteText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
});


