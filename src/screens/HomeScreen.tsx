/**
 * HomeScreen
 *
 * Main home hub:
 * - Combined progress + garden summary
 * - Jump back in (3 recent reads)
 * - Study section (ready lists, then recent studied, then recent created)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import { useAuthStore } from '@/state/useAuthStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { FocusPackCard } from '@/components/FocusPackCard';
import { GardenSummaryCard } from '@/components/progress/GardenSummaryCard';
import { BookGridItem } from '@/components/BookGridItem';
import type { Book } from '@/supabase/types';
import { useGardenState } from '@/hooks/useGardenState';
import {
  countStudyWordsForList,
  fetchFlashcardStats,
  fetchHistoryBooks,
  fetchVocabLists,
  touchVocabList,
  type BookWithStatus,
} from '@/supabase/queries';
import { logger } from '@/utils/logger';
import {
  selectHomeStudySection,
  type HomeStudyListCandidate,
  type HomeStudySectionMode,
} from '@/screens/home/studySection';
import { loadFocusPack } from '@/study/focusPackService';
import type { StudyPack } from '@/study/focusPack';
import { calculateProgressPercent } from '@/screens/history/progress';
import { getRecentBooksLayout } from '@/screens/home/recentBooksLayout';
import { AdBanner } from '@/components/ads/AdBanner';
import { usePremium } from '@/premium/PremiumProvider';
import { track } from '@/analytics/client';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface HomeStudyListRow extends HomeStudyListCandidate {}

const MAX_RECENT_BOOKS = 3;
const MAX_DUE_SCAN_LISTS = 24;

function sectionTitleKey(mode: HomeStudySectionMode): string {
  if (mode === 'ready') return 'home.readyToStudyTitle';
  if (mode === 'recent_studied') return 'home.recentStudiedListsTitle';
  return 'home.recentCreatedListsTitle';
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { isPremium } = usePremium();
  const { width: windowWidth } = useWindowDimensions();
  const t = useTranslation();
  const loadErrorTitle = t('common.error');
  const loadErrorMessage = t('history.loadLibraryError');
  const {
    snapshot: gardenSnapshot,
    loading: gardenLoading,
    refresh: refreshGarden,
  } = useGardenState({ placement: 'home_screen' });
  
  const [recentBooks, setRecentBooks] = useState<BookWithStatus[]>([]);
  const [studyMode, setStudyMode] = useState<HomeStudySectionMode>('ready');
  const [studyRows, setStudyRows] = useState<HomeStudyListRow[]>([]);
  const [focusPack, setFocusPack] = useState<StudyPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const focusPackCardPack = useMemo(() => {
    if (!focusPack) return null;
    if (!focusPack.isCompleted) return focusPack;
    return {
      ...focusPack,
      coachLine: t('study.focusPackCompletedCoachLine'),
    };
  }, [focusPack, t]);
  const focusPackCaption = focusPack?.isCompleted
    ? t('study.focusPackCompletedBadge')
    : t('study.focusPackBadge');
  const focusPackButtonLabel = focusPack?.isCompleted
    ? t('study.focusPackReviewCta')
    : t('study.focusPackCta');

  const recentGrid = useMemo(() => {
    return getRecentBooksLayout(windowWidth, {
      columns: 3,
      outerMargin: spacing.md,
      cardPadding: spacing.md,
      columnGap: spacing.xs,
    });
  }, [windowWidth]);

  const loadHomeSections = useCallback(async () => {
    if (!user?.id) {
      setRecentBooks([]);
      setStudyRows([]);
      setStudyMode('ready');
      setFocusPack(null);
      return;
    }

    const [historyBooks, nextFocusPack] = await Promise.all([
      fetchHistoryBooks(user.id, { limit: 12 }),
      loadFocusPack(user.id, t).catch(() => null),
    ]);
    const recentRead = historyBooks
      .filter((book) => book.status !== 'saved_for_later')
      .slice(0, MAX_RECENT_BOOKS);
    setRecentBooks(recentRead);
    setFocusPack(nextFocusPack);

    const vocabLists = await fetchVocabLists(user.id);
    if (vocabLists.length === 0) {
      setStudyRows([]);
      setStudyMode('ready');
      return;
    }

    const dueScan = vocabLists.slice(0, MAX_DUE_SCAN_LISTS);
    const duePairs = await Promise.all(
      dueScan.map(async (list) => {
        try {
          const stats = await fetchFlashcardStats(user.id, list.id);
          const dueCount = Math.max(0, (stats.unseen ?? 0) + (stats.learning ?? 0));
          return [list.id, dueCount] as const;
        } catch {
          return [list.id, 0] as const;
        }
      })
    );
    const dueByListId = new Map<string, number>(duePairs);

    const candidates: HomeStudyListCandidate[] = vocabLists.map((list) => ({
      id: list.id,
      name: list.name,
      dueCount: dueByListId.get(list.id) ?? 0,
      totalWords: 0,
      lastUsedAt: list.last_used_at ?? null,
      createdAt: list.created_at,
    }));

    const selection = selectHomeStudySection(candidates, 3);
    const totals = await Promise.all(
      selection.items.map(async (item) => {
        try {
          return await countStudyWordsForList(user.id, item.id);
        } catch {
          return 0;
        }
      })
    );

    setStudyMode(selection.mode);
    setStudyRows(selection.items.map((item, index) => ({ ...item, totalWords: totals[index] ?? 0 })));
  }, [t, user?.id]);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([
        loadHomeSections(),
        refreshGarden(),
      ]);
    } catch (error) {
      logger.error('Failed to load home screen', error);
      Alert.alert(loadErrorTitle, loadErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadErrorMessage, loadErrorTitle, loadHomeSections, refreshGarden]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        void loadAll();
        return;
      }
      void loadAll();
    }, [loadAll])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleOpenBook = useCallback(
    (book: Book) => {
      navigation.navigate('BookDetails', { bookId: book.id });
    },
    [navigation]
  );

  const handleOpenStudyList = useCallback(
    (row: HomeStudyListRow) => {
      if (focusPack) {
        track('study_pack_dismissed', {
          pack_id: focusPack.id,
          destination: 'list_study',
          source: 'home_screen',
        });
      }
      touchVocabList(row.id).catch(() => {});
      navigation.navigate('Flashcards', { listId: row.id, listName: row.name });
    },
    [focusPack, navigation]
  );

  const handleStartFocusPack = useCallback(() => {
    if (!focusPack) return;
    track('study_pack_started', {
      pack_id: focusPack.id,
      target_count: focusPack.targetCount,
      review_count: focusPack.reviewCount,
      new_count: focusPack.newCount,
      source: 'home_screen',
    });
    navigation.navigate('Flashcards', {
      listId: null,
      listName: focusPack.title,
      sessionMode: 'focus_pack',
      wordIds: focusPack.wordIds,
      reviewAllWords: focusPack.isCompleted === true,
      packTitle: focusPack.title,
      packId: focusPack.id,
      packReviewCount: focusPack.reviewCount,
      packNewCount: focusPack.newCount,
    });
  }, [focusPack, navigation]);

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState message={t('history.signInPrompt')} />
        <View style={styles.authFooter}>
          <Button
            label={t('common.signIn')}
            variant="primary"
            onPress={() => navigation.navigate('Auth', { mode: 'signin' })}
          />
        </View>
      </View>
    );
  }

  if (loading && !hasLoadedRef.current) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Pressable
          style={[styles.sectionCard, styles.gardenSectionCard]}
          onPress={() => navigation.navigate('MyProgressScreen')}
        >
          {gardenSnapshot ? <GardenSummaryCard snapshot={gardenSnapshot} /> : null}
          {gardenLoading && !gardenSnapshot ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </Pressable>
        {!isPremium ? (
          <View style={styles.adSlot}>
            <AdBanner placement="home_between_garden_recent" />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.jumpBackIn')}</Text>
            {recentBooks.length > 0 ? (
              <Pressable style={styles.seeMore} onPress={() => navigation.navigate('History')}>
                <Text style={styles.seeMoreText}>{t('home.seeMore')}</Text>
                <Feather name="chevron-right" size={14} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {recentBooks.length > 0 ? (
            <View style={[styles.booksRow, { gap: recentGrid.columnGap }]}>
              {recentBooks.map((book) => (
                <View key={book.id} style={{ width: recentGrid.itemWidth }}>
                  <BookGridItem book={book} onPress={handleOpenBook} />
                </View>
              ))}
              {recentBooks.length < 3
                ? Array.from({ length: 3 - recentBooks.length }).map((_, index) => (
                    <View key={`spacer-${index}`} style={{ width: recentGrid.itemWidth }} />
                  ))
                : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('home.findNextReadTitle')}</Text>
              <Text style={styles.emptyBody}>{t('home.findNextReadBody')}</Text>
              <Button
                label={t('home.findNextReadButton')}
                variant="primary"
                size="sm"
                onPress={() => navigation.navigate('Library')}
              />
            </View>
          )}
        </View>
        {!isPremium ? (
          <View style={styles.adSlot}>
            <AdBanner placement="home_between_recent_study" />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t(sectionTitleKey(studyMode))}</Text>
          {focusPack && focusPackCardPack ? (
            <FocusPackCard
              pack={focusPackCardPack}
              caption={focusPackCaption}
              metaText={t('study.focusPackMixLabel', {
                reviewCount: focusPack.reviewCount,
                newCount: focusPack.newCount,
              })}
              buttonLabel={focusPackButtonLabel}
              onPress={handleStartFocusPack}
            />
          ) : null}
          {studyRows.length > 0 ? (
            <View style={styles.studyListWrap}>
              {studyRows.map((row) => (
                <View key={row.id} style={styles.studyRow}>
                  <View style={styles.studyRowLeft}>
                    <Text style={styles.studyRowTitle} numberOfLines={1}>{row.name}</Text>
                    <Text style={styles.studyRowMeta}>
                      {studyMode === 'ready'
                        ? `${row.dueCount} ${t('home.cardsReady')}`
                        : `${row.totalWords} ${t('study.words')}`}
                    </Text>
                  </View>
                  <Button
                    label={studyMode === 'ready' ? t('home.studyNow') : t('home.openList')}
                    variant="surface"
                    size="sm"
                    onPress={() => handleOpenStudyList(row)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('home.noStudyListsTitle')}</Text>
              <Text style={styles.emptyBody}>{t('home.noStudyListsBody')}</Text>
              <Button
                label={t('home.startStudyingButton')}
                variant="surface"
                size="sm"
                onPress={() => navigation.navigate('Study')}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  authFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  gardenSectionCard: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  sectionCard: {
    marginHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  adSlot: {
    marginHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  seeMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seeMoreText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  booksRow: {
    flexDirection: 'row',
    width: '100%',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  studyListWrap: {
    gap: spacing.sm,
  },
  studyRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  studyRowLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  studyRowTitle: {
    ...typography.body,
    color: colors.text,
  },
  studyRowMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
