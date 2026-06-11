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
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, InteractionManager, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Book } from '@/supabase/types';
import { fetchBook, fetchUserBook, saveBookForLater, setUserBookReading } from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';
import { downloadBook, downloadExternalBook, getSignedUrl, getLocalBookPath, removeBookDownload } from '@/supabase/storage';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { ensureBookCoverFromCache } from '@/utils/epubCover';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';
import { AdBanner } from '@/components/ads/AdBanner';
import { useTranslation } from '@/i18n/useTranslation';
import { hashAnalyticsId, track } from '@/analytics/client';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BookDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const bookId: string = route.params?.bookId;
  const t = useTranslation();
  const { user } = useAuthStore();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [userBookStatus, setUserBookStatus] = useState<'reading' | 'saved_for_later' | 'completed' | null>(null);
  const [savingForLater, setSavingForLater] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [removingDownload, setRemovingDownload] = useState(false);

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
    if (s) return t('bookDetails.subjectsPrefix', { subjects: s });
    return null;
  }, [book?.description, book?.subjects_text, t]);

  const cefrBadge = useMemo(() => {
    if (!book?.estimated_cefr) return null;
    const score = book.lexical_score ?? null;
    const ranges: Array<{ min: number; max: number; cefr: string }> = [
      { min: 0, max: 0.11, cefr: 'A1' },
      { min: 0.11, max: 0.17, cefr: 'A2' },
      { min: 0.17, max: 0.25, cefr: 'B1' },
      { min: 0.25, max: 0.34, cefr: 'B2' },
      { min: 0.34, max: 0.46, cefr: 'C1' },
      { min: 0.46, max: 1, cefr: 'C2' },
    ];
    if (typeof score !== 'number') return `${book.estimated_cefr} (Beta)`;
    const boundary = ranges.find((r) => Math.abs(score - r.max) <= 0.02);
    if (!boundary) return `${book.estimated_cefr} (Beta)`;
    const idx = ranges.findIndex((r) => r.cefr === boundary.cefr);
    const next = ranges[idx + 1];
    if (!next) return `${book.estimated_cefr} (Beta)`;
    return `${boundary.cefr}-${next.cefr} (Beta)`;
  }, [book?.estimated_cefr, book?.lexical_score]);

  const wordCountLabel = useMemo(() => {
    if (!book?.word_count || book.word_count <= 0) return null;
    const rounded = Math.max(1, Math.round(book.word_count / 1000));
    return t('bookDetails.wordCountApprox', { n: rounded });
  }, [book?.word_count, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!bookId) return;
        setLoading(true);
        const [b, ub] = await Promise.all([
          fetchBook(bookId),
          user ? fetchUserBook(user.id, bookId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setBook(b);
        setUserBookStatus(ub?.status ?? null);
        track('book_detail_viewed', {
          book_id: b.id,
          estimated_cefr: b.estimated_cefr ?? undefined,
          difficulty: b.difficulty ?? undefined,
        });
      } catch (e) {
        logger.error('Failed to load book', e);
        Alert.alert(t('common.error'), t('bookDetails.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, user]);

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

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    FileSystem.getInfoAsync(getLocalBookPath(bookId)).then((info) => {
      if (!cancelled) setIsDownloaded(info.exists && (info.size ?? 0) > 0);
    });
    return () => { cancelled = true; };
  }, [bookId]);

  const handleRemoveDownload = useCallback(async () => {
    if (!book?.id) return;
    setRemovingDownload(true);
    try {
      await removeBookDownload(book.id);
      setIsDownloaded(false);
    } catch (e) {
      logger.error('Failed to remove download', e);
      Alert.alert(t('common.error'), t('bookDetails.removeDownloadFailed'));
    } finally {
      setRemovingDownload(false);
    }
  }, [book?.id, t]);

  const handleReadNow = useCallback(async () => {
    if (!book || !user) return;
    setOpening(true);
    try {
      track('book_opened', {
        book_id_hash: hashAnalyticsId(book.id),
        source: 'book_details',
        placement: 'read_now_button',
      });
      track('book_started', {
        book_id: book.id,
        language: book.source_lang ?? undefined,
        difficulty: undefined,
      });
      if (userBookStatus === 'saved_for_later') {
        await setUserBookReading(user.id, book.id);
        setUserBookStatus('reading');
      }
      let localPath: string;
      if (Platform.OS === 'web') {
        if (book.epub_url) {
          localPath = book.epub_url;
        } else if (book.storage_path) {
          localPath = await getSignedUrl(book.storage_path);
        } else {
          throw new Error('No download source for book');
        }
      } else if (book.epub_url) {
        localPath = await downloadExternalBook(book.id, book.epub_url);
      } else if (book.storage_path) {
        localPath = await downloadBook(book.id, book.storage_path);
      } else {
        throw new Error('No download source for book');
      }

      ensureBookCoverFromCache(book.id).catch(() => {});

      InteractionManager.runAfterInteractions(() => {
        navigation.replace('Reader', { bookId: book.id, localPath });
      });
    } catch (e) {
      logger.error('Failed to open book', e);
      Alert.alert(t('common.error'), t('bookDetails.openFailed'));
    } finally {
      setOpening(false);
    }
  }, [book, navigation, t, user, userBookStatus]);

  const handleSaveForLater = useCallback(async () => {
    if (!book || !user) return;
    setSavingForLater(true);
    try {
      await saveBookForLater(user.id, book.id);
      setUserBookStatus('saved_for_later');
    } catch (e) {
      logger.error('Failed to save for later', e);
      Alert.alert(t('common.error'), t('bookDetails.saveForLaterFailed'));
    } finally {
      setSavingForLater(false);
    }
  }, [book, t, user]);

  if (!bookId) return null;

  if (loading) {
    return <CenteredLoader />;
  }

  if (!book) return <CenteredLoader message={t('bookDetails.notFound')} />;

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

        <View style={styles.adSection}>
          <AdBanner placement="book_details" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('bookDetails.snapshotTitle')}</Text>
          <View style={styles.metaChips}>
            {cefrBadge ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{t('bookDetails.level', { value: cefrBadge })}</Text></View> : null}
            {wordCountLabel ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{t('bookDetails.lengthValue', { value: wordCountLabel })}</Text></View> : null}
            {book.difficulty ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{t('bookDetails.estimatedDifficulty', { value: book.difficulty })}</Text></View> : null}
            {book.lookup_rate_est ? <View style={styles.metaChip}><Text style={styles.metaChipText}>{t('bookDetails.expectedLookups', { value: book.lookup_rate_est })}</Text></View> : null}
          </View>
          {book.tags && book.tags.length > 0 ? (
            <View style={styles.tagsWrap}>
              {book.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('bookDetails.about')}</Text>
          <Text style={styles.body}>{description ?? t('bookDetails.noDescription')}</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label={
            opening
              ? t('bookDetails.opening')
              : userBookStatus === 'saved_for_later'
                ? t('bookDetails.startReading')
                : t('bookDetails.readNow')
          }
          onPress={handleReadNow}
          disabled={opening}
          variant="primary"
        />
        {user && userBookStatus == null && (
          <Button
            label={savingForLater ? '…' : t('bookDetails.saveForLater')}
            onPress={handleSaveForLater}
            disabled={savingForLater}
            variant="outline"
            style={styles.saveForLaterButton}
          />
        )}
        {isDownloaded && (
          <TouchableOpacity
            style={styles.removeDownloadButton}
            onPress={handleRemoveDownload}
            disabled={removingDownload}
          >
            <Text style={styles.removeDownloadText}>
              {removingDownload ? '…' : t('bookDetails.removeDownload')}
            </Text>
          </TouchableOpacity>
        )}
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
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  metaChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metaChipText: {
    ...typography.caption,
    color: colors.text,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    backgroundColor: colors.surface,
  },
  tagText: {
    ...typography.caption,
    color: colors.textSecondary,
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
  adSection: {
    marginTop: spacing.xl,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  saveForLaterButton: {
    marginTop: spacing.xs,
  },
  removeDownloadButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  removeDownloadText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
