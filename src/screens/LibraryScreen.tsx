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
import { fetchBooks } from '@/supabase/queries';
import { cleanupOrphanedCache } from '@/supabase/storage';
import { BookGridItem } from '@/components/BookGridItem';
import { EmptyState } from '@/components/EmptyState';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { colors, spacing } from '@/theme';
import { logger } from '@/utils/logger';
import { LibraryHeader } from '@/components/LibraryHeader';
import { AdBanner } from '@/components/ads/AdBanner';
import { buildAdRows, type LibraryRow } from '@/ads/buildAdRows';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { width: windowWidth } = useWindowDimensions();
  const [books, setBooks] = useState<Book[]>([]);
  const booksRef = useRef<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceLang, setSourceLang] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedOnceRef = useRef(false);

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
    return buildAdRows(books, { columns: grid().columns, adEveryRows: 4 });
  }, [books, grid]);

  useEffect(() => {
    if (user) {
      loadSettings(user.id);
    }
  }, [user]);

  const loadBooks = useCallback(
    async (
      reset: boolean = false,
      opts?: {
        runCleanup?: boolean;
        override?: { search?: string; language?: string; author?: string; subject?: string };
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
        const effectiveLang = o?.language ?? sourceLang;
        const effectiveAuthor = o?.author ?? authorFilter;
        const effectiveSubject = o?.subject ?? subjectFilter;

        const offset = reset ? 0 : booksRef.current.length;
        const data = await fetchBooks({
          search: effectiveSearch,
          language: effectiveLang.trim().length > 0 ? effectiveLang.trim() : undefined,
          author: effectiveAuthor.trim().length > 0 ? effectiveAuthor.trim() : undefined,
          subject: effectiveSubject.trim().length > 0 ? effectiveSubject.trim() : undefined,
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
        hasLoadedOnceRef.current = true;
      } catch (error) {
        logger.error('Failed to load books:', error);
        Alert.alert('Error', 'Failed to load library');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [authorFilter, search, sourceLang, subjectFilter]
  );

  useEffect(() => {
    loadBooks(true);
  }, [loadBooks]);

  useEffect(() => {
    const t = setTimeout(() => {
      // Search should not feel like a full-screen reset.
      loadBooks(true, { runCleanup: false, override: { search } });
    }, 250);
    return () => clearTimeout(t);
  }, [loadBooks, search]);

  // Refresh books list when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      logger.info('LibraryScreen focused, refreshing books list');
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
      Alert.alert('Error', 'Failed to refresh library');
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
      Alert.alert('Error', 'Failed to open book');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        numColumns={1}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <LibraryHeader
            title="Library"
            search={search}
            onChangeSearch={setSearch}
            language={sourceLang}
            author={authorFilter}
            subject={subjectFilter}
            onApplyFilters={({ language, author, subject }) => {
              setSourceLang(language);
              setAuthorFilter(author);
              setSubjectFilter(subject);
              loadBooks(true, { runCleanup: true, override: { language, author, subject } });
            }}
            onResetFilters={() => {
              setSourceLang('');
              setAuthorFilter('');
              setSubjectFilter('');
              loadBooks(true, { runCleanup: true, override: { language: '', author: '', subject: '' } });
            }}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState message="No books match your filters" />
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
                <View key={b.id} style={{ width: grid().itemWidth, marginBottom: spacing.lg }}>
                  <BookGridItem book={b} onPress={handleBookPress} />
                </View>
              ))}
              {item.items.length < grid().columns
                ? Array.from({ length: grid().columns - item.items.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={{ width: grid().itemWidth, marginBottom: spacing.lg }} />
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
    marginBottom: spacing.lg,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

