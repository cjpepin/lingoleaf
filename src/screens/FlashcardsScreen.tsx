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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '@/components/ads/AdBanner';
import { useAuthStore } from '@/state/useAuthStore';
import { useStudyStore } from '@/state/useStudyStore';
import {
  applyGardenProgress,
  fetchStudyWords,
  fetchStudyWordReviews,
  fetchFlashcardQueue,
  fetchFlashcardQueueAll,
  fetchFlashcardStats,
  upsertStudyWordReview,
  recordVocabReviewed,
  deleteStudyWordReviewsForList,
  deleteAllStudyWordReviews,
  setStudyWordStarred,
  type FlashcardRating,
  type FlashcardStats,
} from '@/supabase/queries';
import { useFlashcardSettingsStore, type StudyMethod } from '@/state/useFlashcardSettingsStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import type { StudyWord } from '@/supabase/types';
import {
  getFlashcardSession,
  saveFlashcardSession,
  clearFlashcardSession,
  FLASHCARD_ALL_KEY,
  type FlashcardSession,
} from '@/utils/flashcardSessionStorage';
import { saveFocusPackCompletion } from '@/study/focusPackStorage';
import { useTranslation } from '@/i18n/useTranslation';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';
import { FlashcardSettingsModal } from '@/components/FlashcardSettingsModal';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { track } from '@/analytics/client';
import { buildFocusPackReviewQueue, computeFocusPackStats } from '@/screens/flashcards/focusPackProgress';

type FlashcardsRouteProp = RouteProp<RootStackParamList, 'Flashcards'>;

type StarredFilter = 'all' | 'starred' | 'unstarred';
type SessionMode = StudyMethod;

function applyStarredFilter(list: StudyWord[], filter: StarredFilter): StudyWord[] {
  if (filter === 'all') return list;
  if (filter === 'starred') return list.filter((w) => w.starred === true);
  return list.filter((w) => !w.starred);
}

function formatIntervalLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

function hashWordIds(wordIds: string[]): string {
  let hash = 2166136261;
  const value = wordIds.join('|');
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}

function orderWordsByIds(words: StudyWord[], wordIds: string[]): StudyWord[] {
  const byId = new Map(words.map((word) => [word.id, word]));
  return wordIds.map((id) => byId.get(id)).filter((word): word is StudyWord => Boolean(word));
}

export default function FlashcardsScreen() {
  const route = useRoute<FlashcardsRouteProp>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const getFlashcardSettings = useFlashcardSettingsStore((s) => s.getSettings);
  const preferredStudyMethod = useFlashcardSettingsStore((s) => s.preferredStudyMethod);
  const setPreferredStudyMethod = useFlashcardSettingsStore((s) => s.setPreferredStudyMethod);
  const t = useTranslation();

  useEffect(() => {
    if (user) loadSettings(user.id);
  }, [user, loadSettings]);

  const {
    listId,
    listName,
    sessionMode: requestedSessionMode,
    wordIds: requestedWordIds,
    reviewAllWords,
    packTitle,
    packId,
    packReviewCount,
    packNewCount,
  } = route.params;
  const focusPackWordIds = requestedWordIds ?? [];
  const isFocusPackSession = requestedSessionMode === 'focus_pack' && focusPackWordIds.length > 0;
  const isCompletedFocusPackReview = isFocusPackSession && reviewAllWords === true;
  const sessionStorageKey = isFocusPackSession ? `focus_pack_${hashWordIds(focusPackWordIds)}` : (listId ?? FLASHCARD_ALL_KEY);

  const [loading, setLoading] = useState(true);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState<FlashcardSession | null>(null);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [queue, setQueue] = useState<StudyWord[]>([]);
  const [mode, setMode] = useState<SessionMode>(preferredStudyMethod);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showTranslationFirst, setShowTranslationFirst] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [sessionWordsLearned, setSessionWordsLearned] = useState(0);
  const [starredFilter, setStarredFilter] = useState<StarredFilter>('all');

  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const baseWords = mode === 'spaced' ? queue : words;
  const displayWords = useMemo(
    () => (mode === 'free' ? applyStarredFilter(baseWords, starredFilter) : baseWords),
    [baseWords, mode, starredFilter]
  );
  const current = displayWords[index] ?? null;
  const analyticsMode = isFocusPackSession ? 'focus_pack' : mode;
  const showsPackCompletionCopy = isFocusPackSession;

  // (native header is hidden — we render our own custom header bar below)

  const loadQueue = useCallback(async (): Promise<StudyWord[]> => {
    if (!user) return [];
    if (isFocusPackSession) {
      try {
        const allWords = await fetchStudyWords(user.id);
        const ordered = orderWordsByIds(allWords, focusPackWordIds);
        const reviews = await fetchStudyWordReviews(focusPackWordIds);
        const remaining = buildFocusPackReviewQueue(ordered, reviews);
        setQueue(remaining);
        setStats(computeFocusPackStats(ordered, reviews));
        setIndex(0);
        setFlipped(false);
        setCompletionVisible(false);
        if (remaining.length === 0 && ordered.length > 0) {
          setSessionWordsLearned(ordered.length);
          setCompletionVisible(true);
        }
        return remaining;
      } catch (e) {
        logger.error('Failed to load focus pack queue', e);
        throw e;
      }
    }
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
      // If all cards are learned (no due cards), show congrats immediately instead of empty screen
      const total = newStats.unseen + newStats.learning + newStats.learned;
      if (data.length === 0 && total > 0 && newStats.learned === total) {
        setSessionWordsLearned(total);
        setCompletionVisible(true);
      }
      return data;
    } catch (e) {
      logger.error('Failed to load flashcard queue', e);
      throw e;
    }
  }, [focusPackWordIds, isFocusPackSession, listId, user]);

  const loadBrowse = useCallback(async () => {
    if (!user) return;
    try {
      if (isFocusPackSession) {
        const allWords = await fetchStudyWords(user.id);
        const ordered = orderWordsByIds(allWords, focusPackWordIds);
        setWords(ordered);
        setQueue(ordered);
        setStats(null);
        setIndex(0);
        setFlipped(false);
        setCompletionVisible(false);
        return ordered;
      }
      const store = useStudyStore.getState();
      store.hydrateForUser(user.id);
      if (listId) {
        await store.refreshWordsForList(user.id, listId, { force: false });
      }
      const cached = listId ? store.getCachedWords(listId) : null;
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
  }, [focusPackWordIds, isFocusPackSession, listId, user]);

  // Omit t from deps so load is stable; otherwise t (new ref every render) causes this effect to
  // re-run every render, calling loadQueue() and resetting flipped/index (rating row disappears).
  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const session = await getFlashcardSession(sessionStorageKey);
      if (session && session.queueWordIds.length > 0) {
        setPendingSession(session);
        setResumePromptVisible(true);
        await loadBrowse();
        // Ensure stats are populated when resuming a spaced session so counts don't start at 0
        if (!isFocusPackSession) {
          try {
            const newStats = await fetchFlashcardStats(user.id, listId);
            setStats(newStats);
          } catch (e) {
            logger.error('Failed to load flashcard stats for resumed session', e);
          }
        }
        setLoading(false);
        return;
      }
      setResumePromptVisible(false);
      setPendingSession(null);
      await loadBrowse();
      if (isFocusPackSession) {
        if (isCompletedFocusPackReview) {
          setMode('free');
        } else if (preferredStudyMethod === 'spaced') {
          await loadQueue();
          setMode('spaced');
        } else {
          setMode('free');
        }
      } else {
        await loadQueue();
      }
      // Do not set mode here — let loadPrefs restore saved mode (free/spaced) and starred filter
    } catch (error) {
      logger.error('Failed to load flashcards', error);
      Alert.alert(t('common.error'), t('flashcards.failedToLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted to avoid re-run every render
  }, [isCompletedFocusPackReview, isFocusPackSession, listId, loadBrowse, loadQueue, preferredStudyMethod, sessionStorageKey, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    track('study_session_started', {
      mode,
      source: 'flashcards_screen',
      placement: 'screen_open',
    });
  }, [loading, mode]);

  // Clamp index when displayWords shrinks (e.g. after changing starred filter)
  useEffect(() => {
    if (displayWords.length > 0 && index >= displayWords.length) {
      setIndex(0);
      setFlipped(false);
      flipAnim.setValue(0);
    }
  }, [displayWords.length, index, flipAnim]);

  const handleResume = useCallback(async () => {
    if (!pendingSession || !user) return;
    setResumePromptVisible(false);
    setLoading(true);
    try {
      let data: StudyWord[];
      if (isFocusPackSession) {
        const wordsForPack = orderWordsByIds(await fetchStudyWords(user.id), focusPackWordIds);
        if (!isCompletedFocusPackReview && preferredStudyMethod === 'spaced') {
          const reviews = await fetchStudyWordReviews(focusPackWordIds);
          setStats(computeFocusPackStats(wordsForPack, reviews));
          data = buildFocusPackReviewQueue(wordsForPack, reviews);
        } else {
          setStats(null);
          data = wordsForPack;
        }
      } else {
        data = listId
          ? await fetchFlashcardQueue(user.id, listId)
          : await fetchFlashcardQueueAll(user.id);
      }
      const idToWord = new Map(data.map((w) => [w.id, w]));
      const restored = pendingSession.queueWordIds
        .map((id) => idToWord.get(id))
        .filter((w): w is StudyWord => Boolean(w));
      setQueue(restored.length > 0 ? restored : data);
      setIndex(Math.min(pendingSession.currentIndex, Math.max(0, (restored.length || data.length) - 1)));
      setFlipped(false);
      setMode(isFocusPackSession ? (isCompletedFocusPackReview ? 'free' : preferredStudyMethod) : 'spaced');
    } catch (e) {
      logger.error('Failed to resume session', e);
      await loadQueue();
    } finally {
      setLoading(false);
    }
  }, [focusPackWordIds, isCompletedFocusPackReview, isFocusPackSession, listId, loadQueue, pendingSession, preferredStudyMethod, user]);

  const handleStartOver = useCallback(async () => {
    setResumePromptVisible(false);
    setPendingSession(null);
    await clearFlashcardSession(sessionStorageKey);
    setLoading(true);
    try {
      if (isFocusPackSession) {
        if (isCompletedFocusPackReview) {
          await loadBrowse();
          setMode('free');
        } else if (preferredStudyMethod === 'spaced') {
          await loadQueue();
          setMode('spaced');
        } else {
          await loadBrowse();
          setMode('free');
        }
      } else if (listId) {
        await loadBrowse();
        setMode('free');
      } else {
        await loadQueue();
        setMode('spaced');
      }
    } catch {
      // already handled
    } finally {
      setLoading(false);
    }
  }, [isCompletedFocusPackReview, isFocusPackSession, listId, loadBrowse, loadQueue, preferredStudyMethod, sessionStorageKey]);

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
      if (isFocusPackSession) {
        if (mode !== 'spaced') {
          setStats(null);
          return;
        }
        const allWords = orderWordsByIds(await fetchStudyWords(user.id), focusPackWordIds);
        const reviews = await fetchStudyWordReviews(focusPackWordIds);
        setStats(computeFocusPackStats(allWords, reviews));
        return;
      }
      const newStats = await fetchFlashcardStats(user.id, listId);
      setStats(newStats);
    } catch (e) {
      logger.error('Failed to refresh stats', e);
    }
  }, [focusPackWordIds, isFocusPackSession, listId, mode, user]);

  const handleRate = useCallback(
    async (rating: FlashcardRating) => {
      if (!current || !user) return;
      setSaving(true);
      const settings = getFlashcardSettings();
      try {
        track('study_question_answered', {
          correct: rating !== 'again',
          mode: analyticsMode,
          source: 'flashcards_screen',
        });
        await upsertStudyWordReview(current.id, rating, settings);
        recordVocabReviewed(user.id, current.id).catch(() => {});
        if (rating === 'good' || rating === 'easy') {
          applyGardenProgress(user.id, { learnedCount: 1, source: 'learned' }).catch(() => {});
        }
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

        const completedWordCount = isFocusPackSession ? focusPackWordIds.length : displayWords.length;
        if (nextIdx >= nextQueue.length) {
          await clearFlashcardSession(sessionStorageKey);
          if (isFocusPackSession && mode === 'spaced') {
            const allWords = orderWordsByIds(await fetchStudyWords(user.id), focusPackWordIds);
            const reviews = await fetchStudyWordReviews(focusPackWordIds);
            const remaining = buildFocusPackReviewQueue(allWords, reviews);
            if (remaining.length > 0) {
              await saveFlashcardSession({
                listId: sessionStorageKey,
                listName: packTitle || listName || 'Flashcards',
                queueWordIds: remaining.map((word) => word.id),
                currentIndex: 0,
                startedAt: new Date().toISOString(),
              });
              setQueue(remaining);
              setIndex(0);
              setFlipped(false);
              flipAnim.setValue(0);
              setStats(computeFocusPackStats(allWords, reviews));
              return;
            }
            setQueue([]);
          } else if (!isFocusPackSession) {
            const fresh = listId
              ? await fetchFlashcardQueue(user.id, listId)
              : await fetchFlashcardQueueAll(user.id);
            setQueue(fresh);
          }
          if (isFocusPackSession) {
            await saveFocusPackCompletion(user.id, packId ?? `focus_${hashWordIds(focusPackWordIds)}`);
          }
          setSessionWordsLearned(completedWordCount);
          setCompletionVisible(true);
          track('study_session_completed', {
            mode: analyticsMode,
            answered_count: completedWordCount,
            source: 'flashcards_screen',
          });
          if (isFocusPackSession) {
            track('study_pack_completed', {
              pack_id: packId ?? sessionStorageKey,
              answered_count: completedWordCount,
              review_count: packReviewCount ?? 0,
              new_count: packNewCount ?? 0,
              source: 'flashcards_screen',
            });
          }
          advanceWithAnimation(0);
        } else {
          await saveFlashcardSession({
            listId: sessionStorageKey,
            listName: packTitle || listName || 'Flashcards',
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
        Alert.alert(t('common.error'), t('flashcards.failedToSaveReview'));
      } finally {
        setSaving(false);
      }
    },
    [
      advanceWithAnimation,
      current,
      displayWords,
      focusPackWordIds,
      getFlashcardSettings,
      index,
      isFocusPackSession,
      listId,
      listName,
      mode,
      analyticsMode,
      packTitle,
      packId,
      packNewCount,
      packReviewCount,
      flipAnim,
      refreshStats,
      sessionStorageKey,
      t,
      user,
    ],
  );

  const handlePrev = useCallback(() => {
    if (displayWords.length === 0) return;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 100, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
    setIndex((prev) => (prev <= 0 ? displayWords.length - 1 : prev - 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [displayWords.length, flipAnim, slideAnim]);

  const handleNext = useCallback(() => {
    if (mode === 'spaced') return;
    if (displayWords.length === 0) return;
    if (isFocusPackSession && index >= displayWords.length - 1) {
      if (user) {
        saveFocusPackCompletion(user.id, packId ?? `focus_${hashWordIds(focusPackWordIds)}`).catch(() => {});
      }
      setSessionWordsLearned(focusPackWordIds.length || displayWords.length);
      setCompletionVisible(true);
      track('study_session_completed', {
        mode: analyticsMode,
        answered_count: focusPackWordIds.length || displayWords.length,
        source: 'flashcards_screen',
      });
      track('study_pack_completed', {
        pack_id: packId ?? sessionStorageKey,
        answered_count: focusPackWordIds.length || displayWords.length,
        review_count: packReviewCount ?? 0,
        new_count: packNewCount ?? 0,
        source: 'flashcards_screen',
      });
      return;
    }
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -100, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
    setIndex((prev) => (prev >= displayWords.length - 1 ? 0 : prev + 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [
    analyticsMode,
    displayWords.length,
    flipAnim,
    focusPackWordIds.length,
    index,
    isFocusPackSession,
    mode,
    packId,
    packNewCount,
    packReviewCount,
    sessionStorageKey,
    slideAnim,
    user,
  ]);

  const handleShuffle = useCallback(() => {
    if (mode === 'free' && words.length > 0) {
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setWords(shuffled);
      setIndex(0);
      setFlipped(false);
      flipAnim.setValue(0);
    } else if (mode === 'spaced' && queue.length > 0) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setIndex(0);
      setFlipped(false);
      flipAnim.setValue(0);
    }
  }, [mode, words, queue]);

  const handleToggleStarred = useCallback(async () => {
    if (!current || !user) return;
    const next = !current.starred;
    try {
      await setStudyWordStarred(current.id, next);
      const updatedWord = { ...current, starred: next };
      const update = (w: StudyWord) => (w.id === current.id ? { ...w, starred: next } : w);
      setWords((prev) => prev.map(update));
      setQueue((prev) => prev.map(update));
      // Update cache so starred state persists when leaving/returning to screen
      if (listId) {
        useStudyStore.getState().upsertWordInCache(listId, updatedWord);
      }
    } catch (e) {
      logger.error('Failed to update starred', e);
      Alert.alert(t('common.error'), t('flashcards.failedToSaveStarred'));
    }
  }, [current, listId, t, user]);

  const handleSwitchMode = useCallback(async () => {
    if (isFocusPackSession) return;
    const newMode: StudyMethod = mode === 'spaced' ? 'free' : 'spaced';
    setMode(newMode);
    track('study_session_started', {
      mode: newMode,
      source: 'flashcards_screen',
      placement: 'mode_toggle',
    });
    setPreferredStudyMethod(newMode);
    setIndex(0);
    setFlipped(false);
    flipAnim.setValue(0);
    if (newMode === 'spaced') {
      await loadQueue();
    } else {
      await loadBrowse();
    }
  }, [flipAnim, isFocusPackSession, loadBrowse, loadQueue, mode, setPreferredStudyMethod]);

  const progressText = useMemo(() => {
    if (isFocusPackSession && mode === 'free') {
      const focusPackTotal = focusPackWordIds.length || displayWords.length;
      return t('flashcards.focusPackProgress', {
        current: displayWords.length > 0 ? index + 1 : 0,
        total: focusPackTotal,
      });
    }
    // Stats for spaced mode (in free mode, counter is shown separately below the card)
    const s = stats ?? { unseen: 0, learning: 0, learned: 0 };
    const parts = [
      `${t('flashcards.unseen')}: ${s.unseen}`,
      `${t('flashcards.learning')}: ${s.learning}`,
      `${t('flashcards.learned')}: ${s.learned}`,
    ];
    return parts.join('  ·  ');
  }, [displayWords.length, focusPackWordIds.length, index, isFocusPackSession, mode, stats, t]);

  const freeStudyCounter = mode === 'free' && !isFocusPackSession
    ? `${displayWords.length > 0 ? index + 1 : 0} / ${displayWords.length}`
    : null;
  const completionPrimaryLabel = isFocusPackSession
    ? t('flashcards.reviewTodaysPack')
    : t('flashcards.continueFreeStudying');

  // Persist UI preferences (mode, filter, index, front side) per user + list
  useEffect(() => {
    if (!user || isFocusPackSession) return;
    const key = `ll_flashcards_ui_${user.id}_${listId ?? FLASHCARD_ALL_KEY}`;

    const loadPrefs = async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          mode?: StudyMethod;
          starredFilter?: StarredFilter;
          index?: number;
          showTranslationFirst?: boolean;
        };
        if (parsed.mode === 'spaced' || parsed.mode === 'free') {
          setMode(parsed.mode);
        }
        if (parsed.starredFilter === 'all' || parsed.starredFilter === 'starred' || parsed.starredFilter === 'unstarred') {
          setStarredFilter(parsed.starredFilter);
        }
        if (typeof parsed.index === 'number' && parsed.index >= 0) {
          setIndex(parsed.index);
        }
        if (typeof parsed.showTranslationFirst === 'boolean') {
          setShowTranslationFirst(parsed.showTranslationFirst);
        }
      } catch (e) {
        logger.error('Failed to load flashcard UI prefs', e);
      }
    };

    void loadPrefs();
  }, [isFocusPackSession, user, listId]);

  useEffect(() => {
    if (!user || isFocusPackSession) return;
    const key = `ll_flashcards_ui_${user.id}_${listId ?? FLASHCARD_ALL_KEY}`;
    const prefs = {
      mode,
      starredFilter,
      index,
      showTranslationFirst,
    };
    void AsyncStorage.setItem(key, JSON.stringify(prefs)).catch((e) =>
      logger.error('Failed to save flashcard UI prefs', e),
    );
  }, [user, isFocusPackSession, listId, mode, starredFilter, index, showTranslationFirst]);

  const handleResetProgress = useCallback(async () => {
    if (!user) return;
    const total = isFocusPackSession
      ? displayWords.length || words.length
      : (stats?.unseen ?? 0) + (stats?.learning ?? 0) + (stats?.learned ?? 0);
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('flashcards.resetConfirmTitle'),
        t('flashcards.resetConfirmMessage', { count: total }),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.ok'), onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;

    setCompletionVisible(false);
    setLoading(true);
    try {
      await clearFlashcardSession(sessionStorageKey);
      if (isFocusPackSession) {
        if (preferredStudyMethod === 'spaced') {
          await loadQueue();
          setMode('spaced');
        } else {
          await loadBrowse();
          setMode('free');
        }
      } else if (listId) {
        await deleteStudyWordReviewsForList(user.id, listId);
        await loadBrowse();
        setMode('free');
      } else {
        await deleteAllStudyWordReviews(user.id);
        await loadQueue();
        setMode('spaced');
      }
    } catch (e) {
      logger.error('Failed to reset progress', e);
      Alert.alert(t('common.error'), t('flashcards.resetFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    deleteAllStudyWordReviews,
    deleteStudyWordReviewsForList,
    displayWords.length,
    isFocusPackSession,
    listId,
    loadBrowse,
    loadQueue,
    preferredStudyMethod,
    sessionStorageKey,
    stats,
    t,
    user,
    words.length,
  ]);

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
      <View style={styles.screenContainer}>
        <View style={[styles.headerBar, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={({ pressed }) => [styles.headerBackButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {listName || t('nav.flashcards')}
          </Text>
          <Pressable
            onPress={() => setSettingsVisible(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerSettingsButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="more-vertical" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.container}>
          <Text style={styles.title}>{t('flashcards.resumeTitle')}</Text>
          <Text style={styles.subtitle}>{t('flashcards.resumeSubtitle')}</Text>
          <View style={styles.promptButtons}>
            <Button label={t('flashcards.resume')} variant="primary" onPress={handleResume} />
            <Button label={t('flashcards.startOver')} variant="surface" onPress={handleStartOver} />
          </View>
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
          <Text style={styles.completionTitle}>
            {showsPackCompletionCopy
              ? t('flashcards.focusPackCompleteTitle')
              : t('flashcards.congratsMessage', { count: sessionWordsLearned })}
          </Text>
          {showsPackCompletionCopy ? (
            <Text style={styles.completionSubtitle}>
              {t('flashcards.focusPackCompleteSubtitle', { count: sessionWordsLearned })}
            </Text>
          ) : null}
          <View style={styles.completionButtons}>
            <Button
              label={completionPrimaryLabel}
              variant="primary"
              onPress={async () => {
                setCompletionVisible(false);
                await loadBrowse();
                setMode('free');
              }}
              style={styles.completionButton}
            />
            <Button
              label={t('flashcards.resetAndStartOver')}
              variant="surface"
              onPress={handleResetProgress}
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
    // Show header with filter options so user can switch filters even when no cards match
    const isFilteredEmpty = starredFilter !== 'all' && displayWords.length === 0 && words.length > 0;
    const emptyTitle = isFilteredEmpty
      ? (starredFilter === 'starred' ? t('flashcards.noStarredWords') : t('flashcards.noUnstarredWords'))
      : t('flashcards.noWords');
    const emptySubtitle = isFilteredEmpty
      ? t('flashcards.noStarredWordsSubtitle')
      : t('flashcards.noWordsSubtitle');

    return (
      <View style={styles.screenContainer}>
        <View style={[styles.headerBar, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={({ pressed }) => [styles.headerBackButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {listName || t('nav.flashcards')}
          </Text>
          <Pressable
            onPress={() => setSettingsVisible(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerSettingsButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="more-vertical" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.container}>
          <View style={styles.header}>
            {(mode === 'spaced' || isFocusPackSession) && <Text style={styles.progress}>{progressText}</Text>}
            {!isFocusPackSession ? (
              <Pressable style={styles.modeToggle} onPress={handleSwitchMode}>
                <Feather name={mode === 'spaced' ? 'repeat' : 'layers'} size={16} color={colors.primary} />
                <Text style={styles.modeToggleText}>
                  {mode === 'spaced' ? t('flashcards.switchToFreeStudy') : t('flashcards.switchToSpaced')}
                </Text>
              </Pressable>
            ) : null}
            {mode === 'free' && !isFocusPackSession ? (
              <View style={styles.starredFilterRow}>
                {(['all', 'starred', 'unstarred'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => {
                      setStarredFilter(f);
                      setIndex(0);
                      setFlipped(false);
                      flipAnim.setValue(0);
                    }}
                    style={[styles.starredFilterBtn, starredFilter === f && styles.starredFilterBtnActive]}
                  >
                    <Text style={[styles.starredFilterText, starredFilter === f && styles.starredFilterTextActive]}>
                      {f === 'all' ? t('flashcards.starredFilterAll') : f === 'starred' ? t('flashcards.starredFilterStarred') : t('flashcards.starredFilterUnstarred')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.emptyContent}>
            <Text style={styles.title}>{emptyTitle}</Text>
            <Text style={styles.subtitle}>{emptySubtitle}</Text>
          </View>
        </View>
        <FlashcardSettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          showTranslationFirst={showTranslationFirst}
          onShowTranslationFirstChange={(v) => {
            setShowTranslationFirst(v);
            setSettingsVisible(false);
          }}
          onResetProgress={handleResetProgress}
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
    <View style={styles.screenContainer}>
      {/* Custom header bar — replaces native header to avoid iOS pill styling */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.headerBackButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {listName || t('nav.flashcards')}
        </Text>
        <Pressable
          onPress={() => setSettingsVisible(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.headerSettingsButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="more-vertical" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.container}>
      <View style={styles.header}>
        {(mode === 'spaced' || isFocusPackSession) && <Text style={styles.progress}>{progressText}</Text>}
        {!isFocusPackSession ? (
          <Pressable style={styles.modeToggle} onPress={handleSwitchMode}>
            <Feather name={mode === 'spaced' ? 'repeat' : 'layers'} size={16} color={colors.primary} />
            <Text style={styles.modeToggleText}>
              {mode === 'spaced' ? t('flashcards.switchToFreeStudy') : t('flashcards.switchToSpaced')}
            </Text>
          </Pressable>
        ) : null}
        {mode === 'free' && !isFocusPackSession ? (
        <View style={styles.starredFilterRow}>
          {(['all', 'starred', 'unstarred'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setStarredFilter(f);
                setIndex(0);
                setFlipped(false);
                flipAnim.setValue(0);
              }}
              style={[styles.starredFilterBtn, starredFilter === f && styles.starredFilterBtnActive]}
            >
              <Text style={[styles.starredFilterText, starredFilter === f && styles.starredFilterTextActive]}>
                {f === 'all' ? t('flashcards.starredFilterAll') : f === 'starred' ? t('flashcards.starredFilterStarred') : t('flashcards.starredFilterUnstarred')}
              </Text>
            </Pressable>
          ))}
        </View>
        ) : null}
      </View>

      {mode === 'spaced' ? (
        <>
          <View style={styles.spacedCardArea}>
            <View style={[styles.cardRow, styles.cardRowCentered]}>
              <View style={styles.edgeTapLeft} />
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
                    <Text style={styles.cardHint}>{t('flashcards.howWell')}</Text>
                  </Animated.View>
                  {current ? (
                    <Pressable onPress={handleToggleStarred} style={styles.starButton} hitSlop={12}>
                      <Ionicons name={current.starred ? 'star' : 'star-outline'} size={24} color={current.starred ? colors.warning : colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
              <View style={styles.edgeTapRight} />
            </View>
          </View>
          <View style={styles.ratingSlot}>
            {flipped ? (
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
            ) : null}
          </View>
        </>
      ) : (
        <>
          <View style={styles.cardRow}>
            <Pressable style={styles.edgeTapLeft} onPress={handlePrev} hitSlop={{ left: 24 }} />
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
                  <Text style={styles.cardHint}>{t('flashcards.tapToFlip')}</Text>
                </Animated.View>
                {current ? (
                  <Pressable onPress={handleToggleStarred} style={styles.starButton} hitSlop={12}>
                    <Ionicons name={current.starred ? 'star' : 'star-outline'} size={24} color={current.starred ? colors.warning : colors.textSecondary} />
                  </Pressable>
                ) : null}
              </TouchableOpacity>
            </Animated.View>
            <Pressable style={styles.edgeTapRight} onPress={handleNext} hitSlop={{ right: 24 }} />
          </View>
          <View style={styles.freeStudyControls}>
            {freeStudyCounter && <Text style={styles.freeStudyCounter}>{freeStudyCounter}</Text>}
            <View style={styles.actions}>
              <Button label={t('flashcards.prev')} onPress={handlePrev} variant="surface" size="md" style={styles.actionButton} />
              {!isFocusPackSession ? (
                <Button label={t('flashcards.shuffle')} onPress={handleShuffle} variant="surface" size="md" style={styles.actionButton} />
              ) : null}
              <Button
                label={t('flashcards.next')}
                onPress={handleNext}
                variant="primary"
                size="md"
                style={styles.actionButton}
              />
            </View>
          </View>
        </>
      )}

      <AdBanner placement="flashcards" />

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
        onResetProgress={handleResetProgress}
      />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.xs,
  },
  headerSettingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  focusPackStatus: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
  },
  modeToggleText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  freeStudyControls: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  freeStudyCounter: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  spacedCardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  cardRowCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingSlot: {
    minHeight: 80,
    justifyContent: 'center',
  },
  edgeTapLeft: {
    width: 6,
  },
  edgeTapRight: {
    width: 6,
  },
  cardContainer: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1.45,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
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
  starredFilterRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  starredFilterBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  starredFilterBtnActive: {
    backgroundColor: colors.primary + '30',
  },
  starredFilterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  starredFilterTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  starButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
