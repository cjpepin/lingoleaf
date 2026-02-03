/**
 * FlashcardsScreen
 *
 * Anki-style spaced repetition + browse mode.
 * - Spaced: flip → rate (Again/Hard/Good/Easy) → next; session can be resumed
 * - Browse: prev/next, flip only
 * - 3-dots menu: term/translation first, etc.
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useStudyStore } from '@/state/useStudyStore';
import {
  fetchStudyWords,
  fetchFlashcardQueue,
  fetchFlashcardQueueAll,
  fetchFlashcardStats,
  upsertStudyWordReview,
  type FlashcardRating,
  type FlashcardStats,
} from '@/supabase/queries';
import { useFlashcardSettingsStore } from '@/state/useFlashcardSettingsStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import type { StudyWord } from '@/supabase/types';
import {
  getFlashcardSession,
  saveFlashcardSession,
  clearFlashcardSession,
  FLASHCARD_ALL_KEY,
  type FlashcardSession,
} from '@/utils/flashcardSessionStorage';
import { useTranslation } from '@/i18n/useTranslation';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';
import { FlashcardSettingsModal } from '@/components/FlashcardSettingsModal';
import { OverlayModal } from '@/components/ui/OverlayModal';

type FlashcardsRouteProp = RouteProp<RootStackParamList, 'Flashcards'>;

type StudyMode = 'spaced' | 'browse';

function formatIntervalLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

export default function FlashcardsScreen() {
  const route = useRoute<FlashcardsRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const studyStore = useStudyStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const getFlashcardSettings = useFlashcardSettingsStore((s) => s.getSettings);
  const t = useTranslation();

  useEffect(() => {
    if (user) loadSettings(user.id);
  }, [user, loadSettings]);

  const { listId, listName } = route.params;

  const [loading, setLoading] = useState(true);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState<FlashcardSession | null>(null);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [queue, setQueue] = useState<StudyWord[]>([]);
  const [mode, setMode] = useState<StudyMode>('spaced');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showTranslationFirst, setShowTranslationFirst] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [sessionWordsLearned, setSessionWordsLearned] = useState(0);

  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const displayWords = mode === 'spaced' ? queue : words;
  const current = displayWords[index] ?? null;

  useEffect(() => {
    navigation.setOptions({
      title: listName || t('nav.flashcards'),
      headerRight: () => (
        <Pressable
          onPress={() => setSettingsVisible(true)}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="more-vertical" size={24} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [listName, navigation, t]);

  const loadQueue = useCallback(async (): Promise<StudyWord[]> => {
    if (!user) return [];
    try {
      const [data, newStats] = await Promise.all([
        listId ? fetchFlashcardQueue(user.id, listId) : fetchFlashcardQueueAll(user.id),
        fetchFlashcardStats(user.id, listId),
      ]);
      setQueue(data);
      setStats(newStats);
      setIndex(0);
      setFlipped(false);
      setCompletionVisible(false);
      return data;
    } catch (e) {
      logger.error('Failed to load flashcard queue', e);
      throw e;
    }
  }, [listId, user]);

  const loadBrowse = useCallback(async () => {
    if (!user) return;
    try {
      studyStore.hydrateForUser(user.id);
      if (listId) {
        await studyStore.refreshWordsForList(user.id, listId, { force: false });
      }
      const cached = listId ? studyStore.getCachedWords(listId) : null;
      const data = cached ?? (await fetchStudyWords(user.id, listId));
      setWords(data);
      const newStats = await fetchFlashcardStats(user.id, listId);
      setStats(newStats);
      setIndex(0);
      setFlipped(false);
      setCompletionVisible(false);
      return data;
    } catch (e) {
      logger.error('Failed to load flashcards', e);
      throw e;
    }
  }, [listId, studyStore, user]);

  // Omit t from deps so load is stable; otherwise t (new ref every render) causes this effect to
  // re-run every render, calling loadQueue() and resetting flipped/index (rating row disappears).
  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const session = await getFlashcardSession(listId);
      if (session && session.queueWordIds.length > 0) {
        setPendingSession(session);
        setResumePromptVisible(true);
        if (listId) {
          await loadBrowse();
        } else {
          const data = await fetchFlashcardQueueAll(user.id);
          setWords(data);
        }
        setLoading(false);
        return;
      }
      setResumePromptVisible(false);
      setPendingSession(null);
      await loadQueue();
      setMode('spaced');
    } catch (error) {
      logger.error('Failed to load flashcards', error);
      Alert.alert(t('common.error'), t('flashcards.failedToLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted to avoid re-run every render
  }, [listId, loadBrowse, loadQueue, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResume = useCallback(async () => {
    if (!pendingSession || !user) return;
    setResumePromptVisible(false);
    setLoading(true);
    try {
      const data = listId
        ? await fetchFlashcardQueue(user.id, listId)
        : await fetchFlashcardQueueAll(user.id);
      const idToWord = new Map(data.map((w) => [w.id, w]));
      const restored = pendingSession.queueWordIds
        .map((id) => idToWord.get(id))
        .filter((w): w is StudyWord => Boolean(w));
      setQueue(restored.length > 0 ? restored : data);
      setIndex(Math.min(pendingSession.currentIndex, Math.max(0, (restored.length || data.length) - 1)));
      setFlipped(false);
      setMode('spaced');
    } catch (e) {
      logger.error('Failed to resume session', e);
      await loadQueue();
    } finally {
      setLoading(false);
    }
  }, [listId, loadQueue, pendingSession, user]);

  const handleStartOver = useCallback(async () => {
    setResumePromptVisible(false);
    setPendingSession(null);
    await clearFlashcardSession(listId ?? FLASHCARD_ALL_KEY);
    setLoading(true);
    try {
      if (listId) {
        await loadBrowse();
        setMode('browse');
      } else {
        await loadQueue();
        setMode('spaced');
      }
    } catch {
      // already handled
    } finally {
      setLoading(false);
    }
  }, [listId, loadBrowse, loadQueue]);

  const handleFlip = useCallback(() => {
    setFlipped((p) => !p);
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipped, flipAnim]);

  const advanceWithAnimation = useCallback(
    (nextIndex: number) => {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start();
      setIndex(nextIndex);
      setFlipped(false);
      flipAnim.setValue(0);
    },
    [flipAnim, slideAnim]
  );

  const refreshStats = useCallback(async () => {
    if (!user) return;
    try {
      const newStats = await fetchFlashcardStats(user.id, listId);
      setStats(newStats);
    } catch (e) {
      logger.error('Failed to refresh stats', e);
    }
  }, [listId, user]);

  const handleRate = useCallback(
    async (rating: FlashcardRating) => {
      if (!current || !user) return;
      setSaving(true);
      const settings = getFlashcardSettings();
      try {
        await upsertStudyWordReview(current.id, rating, settings);
        let nextQueue: StudyWord[];
        let nextIdx: number;
        if (rating === 'again') {
          nextQueue = [
            ...displayWords.slice(0, index),
            ...displayWords.slice(index + 1, index + settings.againCards + 1),
            current,
            ...displayWords.slice(index + settings.againCards + 1),
          ];
          nextIdx = index;
        } else {
          nextQueue = displayWords;
          nextIdx = index + 1;
        }

        if (nextIdx >= nextQueue.length) {
          const sessionKey = listId ?? FLASHCARD_ALL_KEY;
          await clearFlashcardSession(sessionKey);
          const fresh = listId
            ? await fetchFlashcardQueue(user.id, listId)
            : await fetchFlashcardQueueAll(user.id);
          setQueue(fresh);
          setSessionWordsLearned(displayWords.length);
          setCompletionVisible(true);
          advanceWithAnimation(0);
        } else {
          const sessionKey = listId ?? FLASHCARD_ALL_KEY;
          await saveFlashcardSession({
            listId: sessionKey,
            listName: listName || 'Flashcards',
            queueWordIds: nextQueue.map((w) => w.id),
            currentIndex: nextIdx,
            startedAt: new Date().toISOString(),
          });
          setQueue(nextQueue);
          advanceWithAnimation(nextIdx);
        }
        await refreshStats();
      } catch (e) {
        logger.error('Failed to save review', e);
        Alert.alert('Error', 'Failed to save review');
      } finally {
        setSaving(false);
      }
    },
    [current, displayWords, index, listId, listName, user, getFlashcardSettings, advanceWithAnimation, refreshStats],
  );

  const handlePrev = useCallback(() => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 100, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
    setIndex((prev) => Math.max(0, prev - 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [flipAnim, slideAnim]);

  const handleNext = useCallback(() => {
    if (mode === 'spaced') return;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -100, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
    setIndex((prev) => Math.min(displayWords.length - 1, prev + 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [displayWords.length, flipAnim, mode, slideAnim]);

  const progressText = useMemo(() => {
    if (mode === 'browse') {
      if (displayWords.length === 0) return '0 / 0';
      return `${index + 1} / ${displayWords.length}`;
    }
    const s = stats ?? { unseen: 0, learning: 0, learned: 0 };
    const parts = [
      `${t('flashcards.unseen')}: ${s.unseen}`,
      `${t('flashcards.learning')}: ${s.learning}`,
      `${t('flashcards.learned')}: ${s.learned}`,
    ];
    return parts.join('  ·  ');
  }, [displayWords.length, index, mode, stats, t]);

  if (!user && !loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('flashcards.signInRequired')}</Text>
        <Text style={styles.subtitle}>{t('flashcards.signInSubtitle')}</Text>
        <Button label={t('common.signIn')} variant="primary" onPress={() => (navigation as any).navigate('Auth', { mode: 'signin' })} />
      </View>
    );
  }

  if (loading && displayWords.length === 0) {
    return <CenteredLoader />;
  }

  if (resumePromptVisible) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('flashcards.resumeTitle')}</Text>
        <Text style={styles.subtitle}>{t('flashcards.resumeSubtitle')}</Text>
        <View style={styles.promptButtons}>
          <Button label={t('flashcards.resume')} variant="primary" onPress={handleResume} />
          <Button label={t('flashcards.startOver')} variant="surface" onPress={handleStartOver} />
        </View>
        <FlashcardSettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          showTranslationFirst={showTranslationFirst}
          onShowTranslationFirstChange={(v) => {
            setShowTranslationFirst(v);
            setSettingsVisible(false);
          }}
        />
      </View>
    );
  }

  if (completionVisible) {
    return (
      <View style={styles.container}>
        <OverlayModal visible={completionVisible} onClose={() => {}} dismissOnBackdropPress={false}>
          <Text style={styles.completionTitle}>{t('flashcards.congratsTitle')}</Text>
          <Text style={styles.completionSubtitle}>
            {t('flashcards.congratsSubtitle', { count: sessionWordsLearned })}
          </Text>
          <View style={styles.completionButtons}>
            <Button
              label={t('flashcards.continueFreeStudying')}
              variant="primary"
              onPress={async () => {
                setCompletionVisible(false);
                await loadBrowse();
                setMode('browse');
              }}
              style={styles.completionButton}
            />
            <Button
              label={t('flashcards.resetAndStartOver')}
              variant="surface"
              onPress={async () => {
                setCompletionVisible(false);
                await clearFlashcardSession(listId ?? FLASHCARD_ALL_KEY);
                setLoading(true);
                try {
                  if (listId) {
                    await loadBrowse();
                    setMode('browse');
                  } else {
                    await loadQueue();
                    setMode('spaced');
                  }
                } finally {
                  setLoading(false);
                }
              }}
              style={styles.completionButton}
            />
            <Button
              label={t('flashcards.goBackToReading')}
              variant="outline"
              onPress={() => {
                setCompletionVisible(false);
                (navigation as any).navigate('MainTabs', { screen: 'History' });
              }}
              style={styles.completionButton}
            />
          </View>
        </OverlayModal>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('flashcards.noWords')}</Text>
        <Text style={styles.subtitle}>{t('flashcards.noWordsSubtitle')}</Text>
        <FlashcardSettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          showTranslationFirst={showTranslationFirst}
          onShowTranslationFirstChange={(v) => {
            setShowTranslationFirst(v);
            setSettingsVisible(false);
          }}
        />
      </View>
    );
  }

  const frontText = showTranslationFirst ? current.translation : current.term;
  const backText = showTranslationFirst ? current.term : current.translation;
  const frontLabel = showTranslationFirst ? t('flashcards.translation') : t('flashcards.term');
  const backLabel = showTranslationFirst ? t('flashcards.term') : t('flashcards.translation');

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>{progressText}</Text>
        <Text style={styles.modeLabel}>{mode === 'spaced' ? t('flashcards.spacedRepetition') : t('flashcards.browse')}</Text>
      </View>

      <Animated.View style={[styles.cardContainer, { transform: [{ translateX: slideAnim }] }]}>
        <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={handleFlip}>
          <Animated.View
            style={[
              styles.cardFace,
              { opacity: frontOpacity, transform: [{ rotateY: frontInterpolate }] },
            ]}
          >
            <Text style={styles.cardLabel}>{frontLabel}</Text>
            <Text style={styles.cardText}>{frontText}</Text>
            <Text style={styles.cardHint}>{t('flashcards.tapToFlip')}</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardBack,
              { opacity: backOpacity, transform: [{ rotateY: backInterpolate }] },
            ]}
          >
            <Text style={styles.cardLabel}>{backLabel}</Text>
            <Text style={styles.cardText}>{backText}</Text>
            {mode === 'spaced' ? (
              <Text style={styles.cardHint}>{t('flashcards.howWell')}</Text>
            ) : (
              <Text style={styles.cardHint}>{t('flashcards.tapToFlip')}</Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {mode === 'spaced' && flipped ? (
        <View style={styles.ratingRow}>
          <Pressable
            style={[styles.ratingButton, styles.ratingAgain]}
            onPress={() => handleRate('again')}
            disabled={saving}
          >
            <Text style={styles.ratingText}>{t('flashcards.again')}</Text>
            <Text style={styles.ratingSub}>{t('flashcards.cards', { count: getFlashcardSettings().againCards })}</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, styles.ratingHard]}
            onPress={() => handleRate('hard')}
            disabled={saving}
          >
            <Text style={styles.ratingText}>{t('flashcards.hard')}</Text>
            <Text style={styles.ratingSub}>{formatIntervalLabel(getFlashcardSettings().intervalHardMin)}</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, styles.ratingGood]}
            onPress={() => handleRate('good')}
            disabled={saving}
          >
            <Text style={styles.ratingText}>{t('flashcards.good')}</Text>
            <Text style={styles.ratingSub}>{formatIntervalLabel(getFlashcardSettings().intervalGoodMin)}</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, styles.ratingEasy]}
            onPress={() => handleRate('easy')}
            disabled={saving}
          >
            <Text style={styles.ratingText}>{t('flashcards.easy')}</Text>
            <Text style={styles.ratingSub}>{formatIntervalLabel(getFlashcardSettings().intervalEasyMin)}</Text>
          </Pressable>
        </View>
      ) : mode === 'browse' ? (
        <View style={styles.actions}>
          <Button label={t('flashcards.prev')} onPress={handlePrev} disabled={index === 0} variant="surface" size="md" style={styles.actionButton} />
          <Button
            label={t('flashcards.next')}
            onPress={handleNext}
            disabled={index >= displayWords.length - 1}
            variant="primary"
            size="md"
            style={styles.actionButton}
          />
        </View>
      ) : null}

      <FlashcardSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        showTranslationFirst={showTranslationFirst}
        onShowTranslationFirstChange={(v) => {
          setShowTranslationFirst(v);
          setFlipped(false);
          flipAnim.setValue(0);
          setSettingsVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  progress: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cardContainer: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
  },
  cardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardText: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cardHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  ratingAgain: { backgroundColor: colors.error + '30' },
  ratingHard: { backgroundColor: colors.warning + '30' },
  ratingGood: { backgroundColor: colors.success + '30' },
  ratingEasy: { backgroundColor: colors.primary + '30' },
  ratingText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  ratingSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  completionTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  completionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  completionButtons: {
    gap: spacing.md,
  },
  completionButton: {
    marginBottom: 0,
  },
  promptButtons: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
