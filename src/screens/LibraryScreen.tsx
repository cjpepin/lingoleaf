/**
 * LibraryScreen
 * Displays list of available books from Supabase
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import { fetchBooks, fetchUserBooksLastRead } from '@/supabase/queries';
import { cleanupOrphanedCache, runAutoRemoveDownloads } from '@/supabase/storage';
import { BookGridItem } from '@/components/BookGridItem';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { colors, spacing } from '@/theme';
import { logger } from '@/utils/logger';
import { LibraryHeader } from '@/components/LibraryHeader';
import { AdBanner } from '@/components/ads/AdBanner';
import { buildAdRows, type LibraryRow } from '@/ads/buildAdRows';
import { useTranslation } from '@/i18n/useTranslation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const hasInitiallyLoadedRef = useRef(false);
  const hasSetDefaultLangRef = useRef(false);
  const t = useTranslation();

  const pageSize = 15; // 5 rows × 3 columns
  const requestSeq = useRef(0);

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
        override?: { search?: string; languages?: string[]; subjects?: string[] };
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

        const offset = reset ? 0 : booksRef.current.length;
        const data = await fetchBooks({
          search: effectiveSearch.trim().length > 0 ? effectiveSearch.trim() : undefined,
          languages: effectiveLangs.length > 0 ? effectiveLangs : undefined,
          subjects: effectiveSubjects.length > 0 ? effectiveSubjects : undefined,
          limit: pageSize,
          offset,
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
        logger.error('Failed to load books:', error);
        Alert.alert('Error', t('library.loadLibraryError'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, sourceLangs, subjectFilters]
  );

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
      loadBooks(true, { runCleanup: false, override: { search } });
    }, 250);
    return () => clearTimeout(t);
  }, [search, loadBooks]);

  // Refresh when returning to screen (skip first mount to avoid double load)
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      loadBooks(true, { runCleanup: false });
    }, [loadBooks])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBooks(true, { runCleanup: true });
      logger.info('Library refreshed');
    } catch (error) {
      logger.error('Failed to refresh library:', error);
      Alert.alert('Error', t('library.refreshError'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadBooks(false);
  }, [hasMore, loading, loadingMore, loadBooks, refreshing]);

  const handleBookPress = async (book: Book) => {
    try {
      navigation.navigate('BookDetails', { bookId: book.id });
    } catch (error) {
      logger.error('Failed to open book details:', error);
      Alert.alert('Error', t('library.openBookError'));
    }
  };

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
            onApplyFilters={({ languages, subjects }) => {
              setSourceLangs(languages);
              setSubjectFilters(subjects);
              loadBooks(true, { runCleanup: true, override: { search, languages, subjects } });
            }}
            onResetFilters={() => {
              setSourceLangs([]);
              setSubjectFilters([]);
              loadBooks(true, { runCleanup: true, override: { search, languages: [], subjects: [] } });
            }}
          />
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
                <AdBanner />
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
  list: {
    paddingBottom: spacing.lg,
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

