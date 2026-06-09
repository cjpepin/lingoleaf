/**
 * BookGridItem
 *
 * 3-up grid tile showing a cached cover (best-effort) with title fallback.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import type { Book } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';
import { ensureBookCoverFromCache } from '@/utils/epubCover';
import { getSignedUrl } from '@/supabase/storage';

interface Props {
  book: Book;
  onPress: (book: Book) => void;
}

export function BookGridItem({ book, onPress }: Props) {
  const [coverUri, setCoverUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer remote cover from DB/storage so covers show without downloading the EPUB
      if (book.cover_path) {
        try {
          const signed = await getSignedUrl(book.cover_path, 3600);
          if (!cancelled) setCoverUri(signed);
          return;
        } catch (e) {
          // fall through to cache extraction
        }
      }

      // External catalog cover (e.g., Gutendex)
      if (book.cover_url) {
        if (!cancelled) setCoverUri(book.cover_url);
        return;
      }

      const local = await ensureBookCoverFromCache(book.id);
      if (!cancelled) setCoverUri(local);
    })();
    return () => {
      cancelled = true;
    };
  }, [book.cover_path, book.cover_url, book.id]);

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(book)} activeOpacity={0.8}>
      <View style={styles.cover}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.fallbackTitle} numberOfLines={3}>
              {book.title}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {book.title}
      </Text>
      {book.author ? (
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    // Width is controlled by the parent grid so we can guarantee 1/3 viewport width.
  },
  cover: {
    width: '100%',
    aspectRatio: 0.66, // ~book cover ratio
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  title: {
    ...typography.bodySmall,
    color: colors.text,
    marginTop: spacing.sm,
  },
  author: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});


