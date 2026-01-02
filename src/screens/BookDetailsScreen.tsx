/**
 * BookDetailsScreen
 *
 * Interstitial detail view before opening the reader:
 * - Large cover
 * - Title / author
 * - Description (if available) or subject summary fallback
 * - "Read now" button
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import { fetchBook } from '@/supabase/queries';
import { downloadBook, downloadExternalBook, getSignedUrl } from '@/supabase/storage';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { ensureBookCoverFromCache } from '@/utils/epubCover';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BookDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const bookId: string = route.params?.bookId;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const subtitle = useMemo(() => {
    const bits: string[] = [];
    if (book?.author) bits.push(book.author);
    if (book?.source_lang) bits.push(book.source_lang);
    return bits.join(' • ');
  }, [book?.author, book?.source_lang]);

  const description = useMemo(() => {
    const d = book?.description?.trim();
    if (d) return d;
    const s = book?.subjects_text?.trim();
    if (s) return `Subjects: ${s}`;
    return null;
  }, [book?.description, book?.subjects_text]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!bookId) return;
        setLoading(true);
        const b = await fetchBook(bookId);
        if (cancelled) return;
        setBook(b);
      } catch (e) {
        logger.error('Failed to load book', e);
        Alert.alert('Error', 'Could not load book details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!book) return;

      // Prefer remote cover from DB/storage (works for admin upload)
      if (book.cover_path) {
        try {
          const signed = await getSignedUrl(book.cover_path, 3600);
          if (!cancelled) setCoverUri(signed);
          return;
        } catch {
          // fall through
        }
      }

      // External catalog cover
      if (book.cover_url) {
        if (!cancelled) setCoverUri(book.cover_url);
        return;
      }

      // Last resort: extract from cached EPUB if already downloaded
      const local = await ensureBookCoverFromCache(book.id);
      if (!cancelled) setCoverUri(local);
    })();
    return () => {
      cancelled = true;
    };
  }, [book]);

  const handleReadNow = useCallback(async () => {
    if (!book) return;
    setOpening(true);
    try {
      let localPath: string;
      if (book.epub_url) {
        localPath = await downloadExternalBook(book.id, book.epub_url);
      } else if (book.storage_path) {
        localPath = await downloadBook(book.id, book.storage_path);
      } else {
        throw new Error('No download source for book');
      }

      // Best-effort: extract and cache cover now that EPUB is available locally
      ensureBookCoverFromCache(book.id).catch(() => {});

      navigation.replace('Reader', { bookId: book.id, localPath });
    } catch (e) {
      logger.error('Failed to open book', e);
      Alert.alert('Error', 'Failed to open book');
    } finally {
      setOpening(false);
    }
  }, [book, navigation]);

  if (!bookId) return null;

  if (loading) {
    return <CenteredLoader />;
  }

  if (!book) return <CenteredLoader message="Book not found." />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.coverWrap}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={styles.coverFallback}>
              <Text style={styles.coverFallbackText} numberOfLines={3}>
                {book.title}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{book.title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.body}>{description ?? 'No description available yet.'}</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button label={opening ? 'Opening…' : 'Read now'} onPress={handleReadNow} disabled={opening} variant="primary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  coverWrap: {
    alignSelf: 'center',
    width: 220,
    aspectRatio: 0.66,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  coverFallbackText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
});


