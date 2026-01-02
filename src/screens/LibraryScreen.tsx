/**
 * LibraryScreen
 * Displays list of available books from Supabase
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
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
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { LibraryHeader } from '@/components/LibraryHeader';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { width: windowWidth } = useWindowDimensions();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceLang, setSourceLang] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const pageSize = 15; // 5 rows × 3 columns
  const requestSeq = useRef(0);

  const grid = useCallback(() => {
    const horizontalPadding = spacing.md;
    const columnGap = spacing.md;
    const columns = 3;
    const available = Math.max(0, windowWidth - horizontalPadding * 2 - columnGap * (columns - 1));
    const itemWidth = Math.floor(available / columns);

    return { columns, itemWidth, horizontalPadding, columnGap };
  }, [windowWidth]);

  useEffect(() => {
    if (user) {
      loadSettings(user.id);
    }
  }, [user]);

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadBooks(true);
    }, 300);
    return () => clearTimeout(t);
  }, [authorFilter, search, sourceLang, subjectFilter]);

  // Refresh books list when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      logger.info('LibraryScreen focused, refreshing books list');
      loadBooks(true);
    }, [])
  );

  const loadBooks = async (reset: boolean = false) => {
    const seq = ++requestSeq.current;
    try {
      if (reset) {
        setLoading(true);
        setHasMore(true);
      }

      const offset = reset ? 0 : books.length;
      const data = await fetchBooks({
        search,
        language: sourceLang.trim().length > 0 ? sourceLang.trim() : undefined,
        author: authorFilter.trim().length > 0 ? authorFilter.trim() : undefined,
        subject: subjectFilter.trim().length > 0 ? subjectFilter.trim() : undefined,
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
      if (reset) {
        const validBookIds = data.map((book) => book.id);
        cleanupOrphanedCache(validBookIds).catch((err) => logger.warn('Cache cleanup failed', err));
      }
    } catch (error) {
      logger.error('Failed to load books:', error);
      Alert.alert('Error', 'Failed to load library');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBooks(true);
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
  }, [hasMore, loading, loadingMore, refreshing]);

  const handleBookPress = async (book: Book) => {
    try {
      navigation.navigate('BookDetails', { bookId: book.id });
    } catch (error) {
      logger.error('Failed to open book details:', error);
      Alert.alert('Error', 'Failed to open book');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error('Failed to sign out:', error);
    }
  };


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        numColumns={grid().columns}
        columnWrapperStyle={[styles.row, { gap: grid().columnGap }]}
        ListHeaderComponent={
          <LibraryHeader
            title="Library"
            search={search}
            onChangeSearch={setSearch}
            language={sourceLang}
            onChangeLanguage={setSourceLang}
            author={authorFilter}
            onChangeAuthor={setAuthorFilter}
            subject={subjectFilter}
            onChangeSubject={setSubjectFilter}
            onReset={() => {
              setSearch('');
              setSourceLang('');
              setAuthorFilter('');
              setSubjectFilter('');
            }}
          />
        }
        ListEmptyComponent={<EmptyState message="No books match your filters" />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ width: grid().itemWidth, marginBottom: spacing.lg }}>
            <BookGridItem book={item} onPress={handleBookPress} />
          </View>
        )}
        contentContainerStyle={[styles.list, { paddingHorizontal: grid().horizontalPadding }]}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  row: {
    justifyContent: 'space-between',
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

