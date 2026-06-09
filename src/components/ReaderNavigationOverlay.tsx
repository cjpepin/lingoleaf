/**
 * ReaderNavigationOverlay
 *
 * Kindle-style navigation panel: horizontal page strip, scrub slider,
 * chapters / highlights tabs. Appears when the reader zooms out.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { UserBookHighlight } from '@/supabase/types';

const PAGE_CARD_WIDTH = 56;
const PAGE_CARD_HEIGHT = 76;
const PAGE_CARD_GAP = 8;
const ITEM_SIZE = PAGE_CARD_WIDTH + PAGE_CARD_GAP;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_STRIP_PADDING = (SCREEN_WIDTH - 2 * spacing.md) / 2 - PAGE_CARD_WIDTH / 2 - PAGE_CARD_GAP / 2;

type TabKey = 'chapters' | 'highlights';

interface Props {
  currentPage: number;
  totalPages: number;
  currentChapter: string | null;
  tocItems: Array<{ label: string; href: string }>;
  highlights: UserBookHighlight[];
  canGoBack: boolean;
  onGoToPage: (page: number) => void;
  onGoToHref: (href: string) => void;
  onGoBack: () => void;
  onJumpToHighlight: (cfiRange: string) => void;
  onDeleteHighlight: (highlight: UserBookHighlight) => void;
  onClose: () => void;
}

export function ReaderNavigationOverlay({
  currentPage,
  totalPages,
  currentChapter,
  tocItems,
  highlights,
  canGoBack,
  onGoToPage,
  onGoToHref,
  onGoBack,
  onJumpToHighlight,
  onDeleteHighlight,
  onClose,
}: Props) {
  const t = useTranslation();
  const [tab, setTab] = useState<TabKey>('chapters');
  const [sliderPreview, setSliderPreview] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const didInitialScroll = useRef(false);

  const pages = useMemo(() => {
    if (totalPages <= 0) return [];
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [totalPages]);

  // Center the current page in the strip when overlay opens or page changes
  useEffect(() => {
    if (pages.length <= 0 || currentPage <= 0) return;
    const idx = Math.max(0, Math.min(currentPage - 1, pages.length - 1));
    const timer = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: didInitialScroll.current,
          viewPosition: 0.5,
        });
      } catch { /* ignore */ }
      didInitialScroll.current = true;
    }, 50);
    return () => clearTimeout(timer);
  }, [currentPage, pages.length]);

  const handlePagePress = useCallback(
    (page: number) => {
      onGoToPage(page);
      onClose();
    },
    [onClose, onGoToPage],
  );

  const renderPageCard = useCallback(
    ({ item: page }: { item: number }) => {
      const isCurrent = page === currentPage;
      return (
        <Pressable
          style={[styles.pageCard, isCurrent && styles.pageCardCurrent]}
          onPress={() => handlePagePress(page)}
        >
          <View style={styles.pageCardScribble}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.pageCardLine, isCurrent && styles.pageCardLineCurrent]} />
            ))}
          </View>
          <Text style={[styles.pageNumber, isCurrent && styles.pageNumberCurrent]}>{page}</Text>
        </Pressable>
      );
    },
    [currentPage, handlePagePress],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_SIZE,
      offset: ITEM_SIZE * index,
      index,
    }),
    [],
  );

  const sortedHighlights = useMemo(
    () => highlights.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [highlights],
  );

  // Scroll page strip in sync while scrubbing the slider
  const handleSliderChange = useCallback(
    (v: number) => {
      const page = Math.round(v);
      setSliderPreview(page);
      try {
        flatListRef.current?.scrollToIndex({
          index: Math.max(0, Math.min(page - 1, pages.length - 1)),
          animated: true,
          viewPosition: 0.5,
        });
      } catch { /* ignore */ }
    },
    [pages.length],
  );

  // Navigate when the slider stops — don't dismiss so user can keep scrubbing
  const handleSliderComplete = useCallback(
    (v: number) => {
      setSliderPreview(null);
      onGoToPage(Math.round(v));
    },
    [onGoToPage],
  );

  return (
    <View style={styles.container}>
      {/* ── Horizontal page strip ── */}
      {totalPages > 0 && (
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={renderPageCard}
          keyExtractor={String}
          horizontal
          showsHorizontalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialScrollIndex={
            pages.length > 0 ? Math.max(0, Math.min(currentPage - 1, pages.length - 1)) : undefined
          }
          onScrollToIndexFailed={() => {}}
          style={styles.pageStrip}
          ItemSeparatorComponent={PageCardSeparator}
          contentContainerStyle={[styles.pageStripContent, { paddingHorizontal: Math.max(0, PAGE_STRIP_PADDING) }]}
          decelerationRate="fast"
        />
      )}

      {/* ── Slider section ── */}
      <View style={styles.sliderSection}>
        {canGoBack && (
          <Pressable
            style={styles.goBackRow}
            onPress={() => {
              onGoBack();
              onClose();
            }}
          >
            <Feather name="arrow-left" size={14} color={colors.primary} />
            <Text style={styles.goBackText}>{t('readerNav.goBack')}</Text>
          </Pressable>
        )}

        {currentChapter ? (
          <Text style={styles.chapterLabel} numberOfLines={1}>
            {currentChapter}
          </Text>
        ) : null}

        <View style={styles.sliderRow}>
          <Text style={styles.sliderEdge}>1</Text>
          <View style={styles.sliderWrap}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={Math.max(1, totalPages)}
              step={1}
              value={currentPage}
              onValueChange={handleSliderChange}
              onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
          <Text style={styles.sliderEdge}>{totalPages || '—'}</Text>
        </View>

        {sliderPreview != null && (
          <Text style={styles.sliderPreview}>
            {t('readerNav.pageLabel', { page: sliderPreview })}
          </Text>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'chapters' && styles.tabActive]}
          onPress={() => setTab('chapters')}
        >
          <Text style={[styles.tabText, tab === 'chapters' && styles.tabTextActive]}>
            {t('readerNav.chapters')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'highlights' && styles.tabActive]}
          onPress={() => setTab('highlights')}
        >
          <Text style={[styles.tabText, tab === 'highlights' && styles.tabTextActive]}>
            {t('readerNav.highlightsCount', { count: highlights.length })}
          </Text>
        </Pressable>
      </View>

      {/* ── Tab content ── */}
      <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
        {tab === 'chapters' ? (
          tocItems.length === 0 ? (
            <Text style={styles.emptyText}>{t('readerNav.noChapters')}</Text>
          ) : (
            tocItems.map((c, i) => (
              <Pressable
                key={`${c.href}-${i}`}
                style={styles.chapterRow}
                onPress={() => {
                  onGoToHref(c.href);
                  onClose();
                }}
              >
                <Text style={styles.chapterItemText} numberOfLines={2}>
                  {c.label || t('readerNav.chapter')}
                </Text>
              </Pressable>
            ))
          )
        ) : sortedHighlights.length === 0 ? (
          <Text style={styles.emptyText}>{t('readerNav.noHighlights')}</Text>
        ) : (
          sortedHighlights.map((h) => (
            <View key={h.id} style={styles.highlightRow}>
              <Pressable
                style={styles.highlightMain}
                onPress={() => {
                  onJumpToHighlight(h.cfi_range);
                  onClose();
                }}
              >
                <Text style={styles.highlightPage}>
                  {h.page != null && Number.isFinite(h.page) ? `p. ${h.page}` : '—'}
                </Text>
                <Text style={styles.highlightItemText} numberOfLines={2}>
                  {h.selected_text}
                </Text>
              </Pressable>
              <Pressable style={styles.highlightDelete} onPress={() => onDeleteHighlight(h)}>
                <Feather name="trash-2" size={14} color={colors.error} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* Separator kept outside render to avoid re-creating on each frame */
function PageCardSeparator() {
  return <View style={{ width: PAGE_CARD_GAP }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Page strip ── */
  pageStrip: { flexGrow: 0, marginBottom: spacing.sm },
  pageStripContent: { paddingHorizontal: spacing.md, alignItems: 'center' },
  pageCard: {
    width: PAGE_CARD_WIDTH,
    height: PAGE_CARD_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pageCardCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.highlightMint,
  },
  pageCardScribble: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-evenly',
    paddingHorizontal: 2,
  },
  pageCardLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.divider,
    width: '100%',
  },
  pageCardLineCurrent: {
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  pageNumber: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  pageNumberCurrent: { color: colors.primary, fontWeight: '700' },

  /* ── Slider section ── */
  sliderSection: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  goBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  goBackText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  chapterLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sliderWrap: { flex: 1, height: 40, justifyContent: 'center', overflow: 'hidden' },
  slider: { flex: 1, height: 40 },
  sliderEdge: { ...typography.caption, color: colors.textTertiary, minWidth: 28, textAlign: 'center' },
  sliderPreview: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 2,
  },

  /* ── Tabs ── */
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.text },

  /* ── Tab content ── */
  tabScroll: { flex: 1, paddingHorizontal: spacing.md },
  tabScrollContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  chapterRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
  },
  chapterItemText: { ...typography.body, color: colors.text },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
  },
  highlightMain: { flex: 1 },
  highlightPage: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  highlightItemText: { ...typography.body, color: colors.text },
  highlightDelete: {
    padding: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
