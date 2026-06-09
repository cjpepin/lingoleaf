/**
 * LibraryScreen
 * Displays list of available books from Supabase
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import {
  fetchAvailableTags,
  fetchBooks,
  fetchUserBooksLastRead,
  type LibraryShelfType,
  type BookDifficulty,
  type BookLengthBucket,
} from '@/supabase/queries';
import { cleanupOrphanedCache, runAutoRemoveDownloads } from '@/supabase/storage';
import { BookGridItem } from '@/components/BookGridItem';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { LibraryHeader } from '@/components/LibraryHeader';
import { AdBanner } from '@/components/ads/AdBanner';
import { buildAdRows, type LibraryRow } from '@/ads/buildAdRows';
import { useTranslation } from '@/i18n/useTranslation';
import { hashAnalyticsId, track } from '@/analytics/client';
import type { LibraryAdvancedFilters } from '@/components/LibraryAdvancedFiltersModal';
import { shouldShowBlockingLibraryLoader } from '@/screens/library/loading';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const ADV_FILTERS_KEY = '@lingoleaf:library_advanced_filters_v1';

const SHELVES: Array<{ key: LibraryShelfType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'start_easy', label: 'Start Easy' },
  { key: 'short_wins', label: 'Short Wins' },
  { key: 'popular', label: 'Popular' },
];

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { loadSettings, autoRemoveDownloadsAfterDays } = useSettingsStore();
  const { width: windowWidth } = useWindowDimensions();
  const [books, setBooks] = useState<Book[]>([]);
  const booksRef = useRef<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceLangs, setSourceLangs] = useState<string[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [shelf, setShelf] = useState<LibraryShelfType>('all');
  const [advancedFilters, setAdvancedFilters] = useState<LibraryAdvancedFilters>({
    difficulty: undefined,
    lengthBucket: undefined,
    tags: [],
    shortWins: false,
  });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const hasInitiallyLoadedRef = useRef(false);
  const hasSetDefaultLangRef = useRef(false);
  const t = useTranslation();

  const pageSize = 15; // 5 rows × 3 columns
  const requestSeq = useRef(0);
  const loadBooksRef = useRef<(
    reset?: boolean,
    opts?: {
      runCleanup?: boolean;
      override?: {
        search?: string;
        languages?: string[];
        subjects?: string[];
        shelf?: LibraryShelfType;
        difficulty?: BookDifficulty;
        lengthBucket?: BookLengthBucket;
        shortWins?: boolean;
        tags?: string[];
      };
    }
  ) => Promise<void>>();

  const hasAdvancedFilters = Boolean(
    advancedFilters.difficulty ||
      advancedFilters.lengthBucket ||
      advancedFilters.shortWins ||
      advancedFilters.tags.length > 0
  );

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  const grid = useCallback(() => {
    const horizontalPadding = spacing.md;
    const columnGap = spacing.md;
    const columns = 3;
    const available = Math.max(0, windowWidth - horizontalPadding * 2 - columnGap * (columns - 1));
    const itemWidth = Math.floor(available / columns);

    return { columns, itemWidth, horizontalPadding, columnGap };
  }, [windowWidth]);

  const rows: LibraryRow[] = useMemo(() => {
    return buildAdRows(books, { columns: grid().columns, adEveryRows: 3 });
  }, [books, grid]);

  const loadBooks = useCallback(
    async (
      reset: boolean = false,
      opts?: {
        runCleanup?: boolean;
        override?: {
          search?: string;
          languages?: string[];
          subjects?: string[];
          shelf?: LibraryShelfType;
          difficulty?: BookDifficulty;
          lengthBucket?: BookLengthBucket;
          shortWins?: boolean;
          tags?: string[];
        };
      }
    ) => {
      const seq = ++requestSeq.current;
      try {
        if (reset) {
          setLoading(true);
          setHasMore(true);
        }

        const o = opts?.override;
        const effectiveSearch = o?.search ?? search;
        const effectiveLangs = o?.languages ?? sourceLangs;
        const effectiveSubjects = o?.subjects ?? subjectFilters;
        const effectiveShelf = o?.shelf ?? shelf;
        const effectiveDifficulty = o?.difficulty ?? advancedFilters.difficulty;
        const effectiveLengthBucket = o?.lengthBucket ?? advancedFilters.lengthBucket;
        const effectiveShortWins = o?.shortWins ?? advancedFilters.shortWins;
        const effectiveTags = o?.tags ?? advancedFilters.tags;

        const offset = reset ? 0 : booksRef.current.length;
        const data = await fetchBooks({
          search: effectiveSearch.trim().length > 0 ? effectiveSearch.trim() : undefined,
          languages: effectiveLangs.length > 0 ? effectiveLangs : undefined,
          subjects: effectiveSubjects.length > 0 ? effectiveSubjects : undefined,
          shelfType: effectiveShelf,
          difficulty: effectiveDifficulty,
          lengthBucket: effectiveLengthBucket,
          shortWins: effectiveShortWins,
          tags: effectiveTags,
          limit: pageSize,
          cursor: offset,
        });

        // Ignore stale responses (e.g., filter changed while request was in flight)
        if (seq !== requestSeq.current) return;

        setBooks((prev) => {
          if (reset) return data;
          const seen = new Set(prev.map((b) => b.id));
          const uniqueNext = data.filter((b) => !seen.has(b.id));
          if (uniqueNext.length === 0) return prev;
          return [...prev, ...uniqueNext];
        });

        if (data.length < pageSize) setHasMore(false);

        // Clean up cached files for books that no longer exist in DB
        if (reset && (opts?.runCleanup ?? hasLoadedOnceRef.current === false)) {
          const validBookIds = data.map((book) => book.id);
          cleanupOrphanedCache(validBookIds).catch((err) => logger.warn('Cache cleanup failed', err));
        }
        // Auto-remove downloads for books not read within setting (e.g. 2 weeks)
        if (reset && user && autoRemoveDownloadsAfterDays > 0) {
          fetchUserBooksLastRead(user.id)
            .then((lastRead) => runAutoRemoveDownloads(autoRemoveDownloadsAfterDays, lastRead))
            .catch((err) => logger.warn('Auto-remove downloads failed', err));
        }
        hasLoadedOnceRef.current = true;
      } catch (error) {
        if (seq !== requestSeq.current) return;
        logger.error('Failed to load books:', error);
        Alert.alert(t('common.error'), t('library.loadLibraryError'));
      } finally {
        if (seq !== requestSeq.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, sourceLangs, subjectFilters, shelf, advancedFilters]
  );

  useEffect(() => {
    loadBooksRef.current = loadBooks;
  }, [loadBooks]);

  // Single initial load: get settings first, then load books with default lang.
  // No cleanup/abort - let the load always complete so state updates trigger UI refresh.
  useEffect(() => {
    if (!user || hasInitiallyLoadedRef.current) return;
    hasInitiallyLoadedRef.current = true;

    (async () => {
      try {
        const settings = await loadSettings(user.id);
        const goalLangs = settings?.goal_langs ?? [];
        await loadBooks(true, {
          override: { languages: goalLangs.length > 0 ? goalLangs : undefined },
          runCleanup: true,
        });
        if (goalLangs.length > 0) {
          setSourceLangs(goalLangs);
          hasSetDefaultLangRef.current = true;
        }
      } catch (err) {
        hasInitiallyLoadedRef.current = false;
      }
    })();
  }, [user, loadSettings, loadBooks]);

  // Debounced title/author search
  const searchInitializedRef = useRef(false);
  useEffect(() => {
    if (!searchInitializedRef.current) {
      searchInitializedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      track('search_performed', {
        query_length: search.trim().length,
        source: 'library_search',
      });
      track('library_search', {
        query_len: search.trim().length,
        has_filters: hasAdvancedFilters || sourceLangs.length > 0 || subjectFilters.length > 0,
        language: sourceLangs[0] ?? 'all',
      });
      loadBooks(true, { runCleanup: false, override: { search } });
    }, 250);
    return () => clearTimeout(t);
  }, [search, loadBooks, hasAdvancedFilters, sourceLangs, subjectFilters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ADV_FILTERS_KEY);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as Partial<LibraryAdvancedFilters> & { shelf?: LibraryShelfType };
        if (parsed && !cancelled) {
          const nextShelf = parsed.shelf ?? 'all';
          const nextFilters: LibraryAdvancedFilters = {
            difficulty: parsed.difficulty as BookDifficulty | undefined,
            lengthBucket: parsed.lengthBucket as BookLengthBucket | undefined,
            shortWins: Boolean(parsed.shortWins),
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          };
          setAdvancedFilters({
            ...nextFilters,
          });
          if (parsed.shelf) setShelf(parsed.shelf);
          void loadBooksRef.current?.(true, {
            runCleanup: false,
            override: {
              search,
              languages: sourceLangs,
              subjects: subjectFilters,
              shelf: nextShelf,
              difficulty: nextFilters.difficulty,
              lengthBucket: nextFilters.lengthBucket,
              shortWins: nextFilters.shortWins,
              tags: nextFilters.tags,
            },
          });
        }
      } catch (error) {
        logger.warn('Failed to hydrate advanced filters', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lang = sourceLangs[0] ?? undefined;
    fetchAvailableTags(lang)
      .then(setAvailableTags)
      .catch((err) => logger.warn('Failed to fetch available tags', err));
  }, [sourceLangs]);

  // Refresh when returning to screen (skip first mount to avoid double load)
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      track('library_opened', { source: 'library_tab' });
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void loadBooksRef.current?.(true, { runCleanup: false });
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBooks(true, { runCleanup: true });
      logger.info('Library refreshed');
    } catch (error) {
      logger.error('Failed to refresh library:', error);
      Alert.alert(t('common.error'), t('library.refreshError'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyFilters = useCallback(
    ({ languages, subjects, advanced }: { languages: string[]; subjects: string[]; advanced: LibraryAdvancedFilters }) => {
      const hasModalFilters =
        languages.length > 0 ||
        subjects.length > 0 ||
        Boolean(advanced.difficulty || advanced.lengthBucket || advanced.shortWins || advanced.tags.length > 0);
      const effectiveShelf: LibraryShelfType = hasModalFilters ? 'all' : shelf;

      track('filter_applied', {
        language_count: languages.length,
        subject_count: subjects.length,
        source: 'library_filters',
      });
      track('library_filter_applied', {
        difficulty: advanced.difficulty ?? undefined,
        length_bucket: advanced.lengthBucket ?? undefined,
        tags_count: advanced.tags.length,
        short_wins: advanced.shortWins,
      });
      setSourceLangs(languages);
      setSubjectFilters(subjects);
      setAdvancedFilters(advanced);
      if (effectiveShelf !== shelf) setShelf(effectiveShelf);
      void AsyncStorage.setItem(
        ADV_FILTERS_KEY,
        JSON.stringify({
          ...advanced,
          shelf: effectiveShelf,
        })
      );
      void loadBooks(true, {
        runCleanup: true,
        override: {
          search,
          languages,
          subjects,
          shelf: effectiveShelf,
          difficulty: advanced.difficulty,
          lengthBucket: advanced.lengthBucket,
          shortWins: advanced.shortWins,
          tags: advanced.tags,
        },
      });
    },
    [loadBooks, search, shelf]
  );

  const handleResetFilters = useCallback(() => {
    const cleared: LibraryAdvancedFilters = {
      difficulty: undefined,
      lengthBucket: undefined,
      tags: [],
      shortWins: false,
    };
    track('filter_applied', {
      language_count: 0,
      subject_count: 0,
      source: 'library_filters',
    });
    track('library_filter_applied', {
      difficulty: undefined,
      length_bucket: undefined,
      tags_count: 0,
      short_wins: false,
    });
    setSourceLangs([]);
    setSubjectFilters([]);
    setAdvancedFilters(cleared);
    void AsyncStorage.setItem(
      ADV_FILTERS_KEY,
      JSON.stringify({
        ...cleared,
        shelf,
      })
    );
    void loadBooks(true, {
      runCleanup: true,
      override: {
        search,
        languages: [],
        subjects: [],
        shelf,
        difficulty: undefined,
        lengthBucket: undefined,
        shortWins: false,
        tags: [],
      },
    });
  }, [loadBooks, search, shelf]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadBooks(false);
  }, [hasMore, loading, loadingMore, loadBooks, refreshing]);

  const handleBookPress = async (book: Book) => {
    try {
      track('book_opened', {
        book_id_hash: hashAnalyticsId(book.id),
        source: 'library',
        placement: 'library_grid',
      });
      InteractionManager.runAfterInteractions(() => {
        navigation.navigate('BookDetails', { bookId: book.id });
      });
    } catch (error) {
      logger.error('Failed to open book details:', error);
      Alert.alert(t('common.error'), t('library.openBookError'));
    }
  };

  if (shouldShowBlockingLibraryLoader(loading, books.length, refreshing)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        extraData={books.length}
        keyExtractor={(item) => item.key}
        numColumns={1}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <>
          <LibraryHeader
            title={t('library.library')}
            search={search}
            onChangeSearch={setSearch}
            languages={sourceLangs}
            subjects={subjectFilters}
            advancedFilters={advancedFilters}
            availableTags={availableTags}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
            onOpenMoreFilters={() => {
              track('library_filter_opened', {});
            }}
          />
            <View style={styles.shelvesWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelvesRow}>
                {SHELVES.map((item) => {
                  const selected = shelf === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.shelfChip, selected && styles.shelfChipSelected]}
                      onPress={() => {
                        setShelf(item.key);
                        void AsyncStorage.setItem(
                          ADV_FILTERS_KEY,
                          JSON.stringify({
                            ...advancedFilters,
                            shelf: item.key,
                          })
                        );
                        void loadBooks(true, {
                          runCleanup: false,
                          override: {
                            search,
                            languages: sourceLangs,
                            subjects: subjectFilters,
                            shelf: item.key,
                            difficulty: advancedFilters.difficulty,
                            lengthBucket: advancedFilters.lengthBucket,
                            shortWins: advancedFilters.shortWins,
                            tags: advancedFilters.tags,
                          },
                        });
                      }}
                    >
                      <Text style={[styles.shelfChipText, selected && styles.shelfChipTextSelected]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState message={t('library.noBooksMatchFilters')} />
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
                <AdBanner placement="library_feed" />
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
  emptyLoading: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  shelvesWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  shelvesRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  shelfChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shelfChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  shelfChipText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  shelfChipTextSelected: {
    color: colors.primary,
  },
  bookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adRow: {
    marginBottom: spacing.md,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
