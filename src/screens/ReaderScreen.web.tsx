/**
 * ReaderScreen (web)
 * Browser EPUB demo using epubjs — used for /lingoleaf/demo portfolio embed.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { WebEpubReader } from '@/demo/WebEpubReader';
import { fetchBook } from '@/supabase/queries';
import { getSignedUrl } from '@/supabase/storage';
import type { Book } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { resolveDemoEpubSrc } from '@/demo/demoApi';

type ReaderRoute = RouteProp<RootStackParamList, 'Reader'>;

export default function ReaderScreen() {
  const route = useRoute<ReaderRoute>();
  const navigation = useNavigation();
  const { bookId, localPath: initialLocalPath } = route.params;
  const [book, setBook] = useState<Book | null>(null);
  const [readerSrc, setReaderSrc] = useState(initialLocalPath);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchBook(bookId);
        if (cancelled) return;
        setBook(next);

        if (initialLocalPath) {
          setReaderSrc(
            initialLocalPath.includes('/api/demo/epub')
              ? initialLocalPath
              : resolveDemoEpubSrc(initialLocalPath, next?.source_id),
          );
        } else if (next.epub_url) {
          setReaderSrc(resolveDemoEpubSrc(next.epub_url, next.source_id));
        } else if (next.storage_path) {
          setReaderSrc(await getSignedUrl(next.storage_path));
        }
      } catch (error) {
        logger.error('Failed to load book for web reader', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, initialLocalPath]);

  if (loading || !readerSrc) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <WebEpubReader
        src={readerSrc}
        title={book?.title}
        bookId={bookId}
        sourceLang={book?.source_lang ?? 'es'}
        targetLang="en"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
