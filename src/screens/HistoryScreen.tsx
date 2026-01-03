/**
 * HistoryScreen
 *
 * Shows books the user has previously read/opened (based on user_books join table).
 * Behaves like Library: search + filters + pagination, plus a CTA to discover new books.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import { fetchHistoryBooks } from '@/supabase/queries';
import { cleanupOrphanedCache } from '@/supabase/storage';
import { BookGridItem } from '@/components/BookGridItem';
import { EmptyState } from '@/components/EmptyState';
import { LibraryHeader } from '@/components/LibraryHeader';
import { colors, spacing } from '@/theme';
import { logger } from '@/utils/logger';
import { useAuthStore } from '@/state/useAuthStore';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';
import { AdBanner } from '@/components/ads/AdBanner';
import { buildAdRows, type LibraryRow } from '@/ads/buildAdRows';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList>, NativeStackNavigationProp<RootStackParamList>>;

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { width: windowWidth } = useWindowDimensions();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState('');
  const [sourceLang, setSourceLang] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const hasLoadedOnceRef = useRef(false);

  const pageSize = 15; // 5 rows × 3 columns
  const requestSeq = useRef(0);
  const booksRef = useRef<Book[]>([]);

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
    booksRef.current = books;
  }, [books]);

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
        const effectiveLang = o?.language ?? sourceLang;
        const effectiveAuthor = o?.author ?? authorFilter;
        const effectiveSubject = o?.subject ?? subjectFilter;

        const offset = reset ? 0 : booksRef.current.length;
        const data = await fetchHistoryBooks(user.id, {
          search: effectiveSearch,
          language: effectiveLang.trim().length > 0 ? effectiveLang.trim() : undefined,
          author: effectiveAuthor.trim().length > 0 ? effectiveAuthor.trim() : undefined,
          subject: effectiveSubject.trim().length > 0 ? effectiveSubject.trim() : undefined,
          limit: pageSize,
          offset,
        });

        if (seq !== requestSeq.current) return;

        setBooks((prev) => {
          if (reset) return data;
          const seen = new Set(prev.map((b) => b.id));
          const uniqueNext = data.filter((b) => !seen.has(b.id));
          return uniqueNext.length > 0 ? [...prev, ...uniqueNext] : prev;
        });

        if (data.length < pageSize) setHasMore(false);

        // Cache cleanup is expensive/noisy; run only on full refresh
        if (reset && (opts?.runCleanup ?? hasLoadedOnceRef.current === false)) {
          const validBookIds = data.map((b) => b.id);
          cleanupOrphanedCache(validBookIds).catch((err) => logger.warn('Cache cleanup failed', err));
        }
        hasLoadedOnceRef.current = true;
      } catch (e) {
        logger.error('Failed to load history:', e);
        Alert.alert('Error', 'Failed to load history');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [authorFilter, search, sourceLang, subjectFilter, user]
  );

  useEffect(() => {
    loadBooks(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadBooks(true, { runCleanup: false, override: { search } }), 250);
    return () => clearTimeout(t);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadBooks(true, { runCleanup: false });
    }, [loadBooks])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBooks(true, { runCleanup: true });
    setRefreshing(false);
  }, [loadBooks]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadBooks(false);
  }, [hasMore, loading, loadingMore, loadBooks, refreshing]);

  const handleBookPress = useCallback(
    (book: Book) => {
      navigation.navigate('BookDetails', { bookId: book.id });
    },
    [navigation]
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState message="Sign in to see your reading history." />
        <View style={styles.footerCta}>
          <Button label="Sign in" variant="primary" onPress={() => navigation.navigate('Auth', { mode: 'signin' })} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        numColumns={1}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <LibraryHeader
            title="History"
            ctaLabel="Find a new book"
            onPressCta={() => navigation.navigate('Library')}
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
            <View style={styles.footer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState message="No reading history yet" />
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
    marginBottom: spacing.lg,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});


