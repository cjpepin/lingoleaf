/**
 * HistoryScreen (My Books)
 *
 * User-owned books area with tabs:
 * - History: books currently/previously read
 * - Saved: books saved for later
 *
 * Includes a direct CTA to browse Library discovery.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
  Text,
  InteractionManager,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import type { BookWithStatus } from '@/supabase/queries';
import { fetchHistoryBooks } from '@/supabase/queries';
import { cleanupOrphanedCache } from '@/supabase/storage';
import { BookGridItem } from '@/components/BookGridItem';
import { EmptyState } from '@/components/EmptyState';
import { LibraryHeader } from '@/components/LibraryHeader';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { useAuthStore } from '@/state/useAuthStore';
import { Button } from '@/components/ui/Button';
import { AdBanner } from '@/components/ads/AdBanner';
import { buildAdRows, type LibraryRow } from '@/ads/buildAdRows';
import { useTranslation } from '@/i18n/useTranslation';
import { track } from '@/analytics/client';
import { SegmentedTabs } from '@/components/progress/SegmentedTabs';
import { GoalProgressBar } from '@/components/progress/GoalProgressBar';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import { calculateProgressPercent } from '@/screens/history/progress';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList>, NativeStackNavigationProp<RootStackParamList>>;
type BooksTab = 'history' | 'saved';

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { width: windowWidth } = useWindowDimensions();
  const t = useTranslation();
  const { goalMinutes, minutesToday, refresh: refreshDailyGoal } = useDailyGoal();
  const loadErrorTitle = t('common.error');
  const loadErrorMessage = t('history.loadLibraryError');

  const [activeTab, setActiveTab] = useState<BooksTab>('history');
  const [books, setBooks] = useState<BookWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isProgressCollapsed, setIsProgressCollapsed] = useState(true);

  const [search, setSearch] = useState('');
  const [sourceLangs, setSourceLangs] = useState<string[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const hasInitiallyLoadedRef = useRef(false);

  const pageSize = 15;
  const requestSeq = useRef(0);
  const booksRef = useRef<BookWithStatus[]>([]);

  const grid = useCallback(() => {
    const horizontalPadding = spacing.md;
    const columnGap = spacing.md;
    const columns = 3;
    const available = Math.max(0, windowWidth - horizontalPadding * 2 - columnGap * (columns - 1));
    const itemWidth = Math.floor(available / columns);
    return { columns, itemWidth, horizontalPadding, columnGap };
  }, [windowWidth]);

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  useEffect(() => {
    if (!user?.id) return;
    track('books_tab_viewed', {
      tab: activeTab,
      source: 'my_books_screen',
    });
  }, [activeTab, user?.id]);

  const filteredBooks = useMemo(() => (
    activeTab === 'saved'
      ? books.filter((b) => b.status === 'saved_for_later')
      : books.filter((b) => b.status !== 'saved_for_later')
  ), [activeTab, books]);

  const rows: LibraryRow<BookWithStatus>[] = useMemo(() => {
    const g = grid();
    return buildAdRows(filteredBooks, { columns: g.columns, adEveryRows: 3 });
  }, [filteredBooks, grid]);

  const progressPercent = useMemo(
    () => calculateProgressPercent(minutesToday, goalMinutes),
    [goalMinutes, minutesToday]
  );

  const loadBooks = useCallback(
    async (
      reset: boolean = false,
      opts?: {
        runCleanup?: boolean;
        override?: { search?: string; languages?: string[]; subjects?: string[] };
      }
    ) => {
      const seq = ++requestSeq.current;
      try {
        if (!user) {
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        if (reset) {
          setLoading(true);
          setHasMore(true);
        }

        const o = opts?.override;
        const effectiveSearch = o?.search ?? search;
        const effectiveLangs = o?.languages ?? sourceLangs;
        const effectiveSubjects = o?.subjects ?? subjectFilters;

        const offset = reset ? 0 : booksRef.current.length;
        const data = await fetchHistoryBooks(user.id, {
          search: effectiveSearch,
          languages: effectiveLangs.length > 0 ? effectiveLangs : undefined,
          subjects: effectiveSubjects.length > 0 ? effectiveSubjects : undefined,
          limit: pageSize,
          offset,
        });

        if (seq !== requestSeq.current) return;

        setBooks((prev) => {
          if (reset) return data;
          const seen = new Set(prev.map((b) => b.id));
          const uniqueNext = data.filter((b) => !seen.has(b.id));
          if (uniqueNext.length === 0) {
            setHasMore(false);
          }
          return uniqueNext.length > 0 ? [...prev, ...uniqueNext] : prev;
        });

        if (data.length < pageSize) setHasMore(false);
        if (reset) {
          const hasReading = data.some((b) => b.status !== 'saved_for_later');
          const hasSaved = data.some((b) => b.status === 'saved_for_later');
          if (!hasReading && hasSaved) {
            setActiveTab('saved');
          }
        }

        if (reset && (opts?.runCleanup ?? hasLoadedOnceRef.current === false)) {
          const validBookIds = data.map((b) => b.id);
          cleanupOrphanedCache(validBookIds).catch((err) => logger.warn('Cache cleanup failed', err));
        }
        hasLoadedOnceRef.current = true;
      } catch (e) {
        logger.error('Failed to load my books:', e);
        Alert.alert(loadErrorTitle, loadErrorMessage);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, sourceLangs, subjectFilters, user, loadErrorTitle, loadErrorMessage]
  );

  useEffect(() => {
    if (hasInitiallyLoadedRef.current) return;
    hasInitiallyLoadedRef.current = true;
    void loadBooks(true);
  }, [loadBooks]);

  const searchInitializedRef = useRef(false);
  useEffect(() => {
    if (!searchInitializedRef.current) {
      searchInitializedRef.current = true;
      return;
    }
    const handle = setTimeout(() => {
      void loadBooks(true, { runCleanup: false, override: { search } });
    }, 250);
    return () => clearTimeout(handle);
  }, [loadBooks, search]);

  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        void refreshDailyGoal();
        return;
      }
      void refreshDailyGoal();
      void loadBooks(true, { runCleanup: false });
    }, [loadBooks, refreshDailyGoal])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBooks(true, { runCleanup: true });
    setRefreshing(false);
  }, [loadBooks]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    void loadBooks(false);
  }, [hasMore, loading, loadingMore, loadBooks, refreshing]);

  const handleBookPress = useCallback((book: Book) => {
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('BookDetails', { bookId: book.id });
    });
  }, [navigation]);

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState message={t('history.signInPrompt')} />
        <View style={styles.footerCta}>
          <Button label={t('common.signIn')} variant="primary" onPress={() => navigation.navigate('Auth', { mode: 'signin' })} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        extraData={`${activeTab}:${filteredBooks.length}`}
        keyExtractor={(item) => item.key}
        numColumns={1}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <>
            <View style={[styles.progressCard, isProgressCollapsed && styles.progressCardCollapsed]}>
              <Pressable
                style={styles.progressHeaderRow}
                onPress={() => setIsProgressCollapsed((prev) => !prev)}
              >
                {isProgressCollapsed ? (
                  <>
                    <Text style={styles.progressInlineLabel}>{t('home.today')}</Text>
                    <View style={styles.progressInlineMeta}>
                      <View style={styles.progressInlineTrack}>
                        <View style={[styles.progressInlineFill, { width: `${progressPercent}%` }]} />
                      </View>
                      <Text style={styles.progressInlinePercent}>{progressPercent}%</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>{t('home.today')}</Text>
                    <Text style={styles.progressSubtitle}>{t('home.dailyGoal')}</Text>
                  </View>
                )}
                <Feather
                  name={isProgressCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {!isProgressCollapsed ? (
                <>
                  <GoalProgressBar minutesDone={minutesToday} goalMinutes={goalMinutes} />
                  <Button
                    label={t('home.viewProgress')}
                    variant="surface"
                    size="sm"
                    onPress={() => navigation.navigate('MyProgressScreen')}
                    style={styles.progressButton}
                  />
                </>
              ) : null}
            </View>
            <LibraryHeader
              title={t('history.myBooks')}
              ctaLabel={t('history.browseLibrary')}
              onPressCta={() => navigation.navigate('Library')}
              search={search}
              onChangeSearch={setSearch}
              languages={sourceLangs}
              subjects={subjectFilters}
              advancedFilters={{ difficulty: undefined, lengthBucket: undefined, tags: [], shortWins: false }}
              availableTags={[]}
              onApplyFilters={({ languages, subjects }) => {
                setSourceLangs(languages);
                setSubjectFilters(subjects);
                void loadBooks(true, { runCleanup: true, override: { search, languages, subjects } });
              }}
              onResetFilters={() => {
                setSourceLangs([]);
                setSubjectFilters([]);
                void loadBooks(true, { runCleanup: true, override: { search, languages: [], subjects: [] } });
              }}
            />
            <View style={styles.tabsWrap}>
              <SegmentedTabs
                tabs={[
                  { key: 'history', label: t('history.tabHistory') },
                  { key: 'saved', label: t('history.tabSaved') },
                ]}
                activeKey={activeTab}
                onPress={(key) => setActiveTab(key as BooksTab)}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState message={activeTab === 'saved' ? t('history.noSavedBooks') : t('history.noReadingHistory')} />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'ad') {
            return (
              <View style={[styles.adRow, { paddingHorizontal: grid().horizontalPadding }]}>
                <AdBanner placement="history_feed" />
              </View>
            );
          }

          return (
            <View style={[styles.bookRow, { paddingHorizontal: grid().horizontalPadding, gap: grid().columnGap }]}>
              {item.items.map((b) => (
                <View key={b.id} style={{ width: grid().itemWidth, marginBottom: spacing.md }}>
                  <BookGridItem book={b} onPress={handleBookPress} />
                </View>
              ))}
              {item.items.length < grid().columns
                ? Array.from({ length: grid().columns - item.items.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={{ width: grid().itemWidth, marginBottom: spacing.md }} />
                  ))
                : null}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  progressCardCollapsed: {
    paddingVertical: spacing.sm,
    gap: 0,
  },
  progressHeader: {
    flex: 1,
    gap: 2,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressInlineLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  progressInlineMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressInlineTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  progressInlineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressInlinePercent: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  progressTitle: {
    ...typography.h3,
    color: colors.text,
  },
  progressSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  progressButton: {
    alignSelf: 'flex-start',
  },
  tabsWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.xs,
  },
  footerCta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  bookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adRow: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
