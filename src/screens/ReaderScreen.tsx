/**
 * ReaderScreen
 * EPUB reader with selection, highlight, and translation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { Reader, useReader } from '@epubjs-react-native/core';
import type { Location, Section } from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/expo-file-system';
import * as FileSystem from 'expo-file-system';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { TranslateSheet } from '@/components/TranslateSheet';
import { BookNavigationSheet } from '@/components/BookNavigationSheet';
import { ReaderOverlays } from '@/components/ReaderOverlays';
import { ReaderEdgeTapOverlay, READER_EDGE_WIDTH } from '@/components/ReaderEdgeTapOverlay';
import { UpgradeAccountPrompt } from '@/components/UpgradeAccountPrompt';
import { Snackbar } from '@/components/Snackbar';
import { useAuthStore } from '@/state/useAuthStore';
import { useUpgradePromptStore } from '@/state/useUpgradePromptStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useStudyStore } from '@/state/useStudyStore';
import {
  fetchBook,
  createStudyWord,
  translateText,
  fetchUserBook,
  upsertUserBook,
  addUserBookHighlight,
  deleteUserBookHighlight,
  fetchVocabLists,
  fetchMostRecentVocabList,
  createVocabList,
  touchVocabList,
  countAllStudyWords,
  countAllUserHighlights,
} from '@/supabase/queries';
import type { Book, VocabList, UserBookHighlight } from '@/supabase/types';
import { normalizeText, validateSelectionLength, MAX_SELECTION_LENGTH } from '@/utils/normalize';
import { colors, spacing } from '@/theme';
import { logger } from '@/utils/logger';
import { addReadMinutes, incrementReadingSession } from '@/utils/readingEngagement';
import { getCachedLastCfi, setCachedLastCfi, setCachedLastPosition } from '@/utils/readerProgressCache';
import { READER_INJECTED_JAVASCRIPT } from '@/reader/readerInjectedJavascript';
import { READER_THEME } from '@/reader/readerTheme';
import { useReaderStore } from '@/state/useReaderStore';
import { useReaderSettingsStore } from '@/state/useReaderSettingsStore';
import { ReaderSettingsModal } from '@/components/ReaderSettingsModal';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@/i18n/useTranslation';

type ReaderRouteProp = RouteProp<RootStackParamList, 'Reader'>;

interface Selection {
  text: string;
  cfiRange: string;
  position?: { x: number; y: number; width: number; height: number };
  context?: string | null;
}

export default function ReaderScreen() {
  const t = useTranslation();
  const route = useRoute<ReaderRouteProp>();
  const navigation = useNavigation();
  const { bookId, localPath } = route.params;
  const { user, isGuest } = useAuthStore();
  const { targetLang, loadSettings } = useSettingsStore();
  const { currentPage, totalPages, pageLoading, chapterLeftPct, setCurrentPage, setTotalPages, setPageLoading, setChapterLeftPct } = useReaderStore();
  const upgradePrompt = useUpgradePromptStore();
  const studyStore = useStudyStore();
  
  const [book, setBook] = useState<Book | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showTranslateSheet, setShowTranslateSheet] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [sameLanguage, setSameLanguage] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [vocabLists, setVocabLists] = useState<VocabList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [highlights, setHighlights] = useState<UserBookHighlight[]>([]);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [navVisible, setNavVisible] = useState(false);
  const [navInitialTab, setNavInitialTab] = useState<'navigate' | 'highlights'>('navigate');
  const [lastTouchPosition, setLastTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [initialLocation, setInitialLocation] = useState<string | undefined>(undefined);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [readingProgressEnabled, setReadingProgressEnabled] = useState(true);
  const [readerReady, setReaderReady] = useState(false);
  const [readerLayout, setReaderLayout] = useState<{ x: number; y: number } | null>(null);
  const [readerSettingsVisible, setReaderSettingsVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  // Get reader navigation methods
  const {
    goToLocation,
    currentLocation,
    totalLocations,
    toc,
    addAnnotation,
    removeAnnotationByCfi,
    injectJavascript,
    goNext,
    goPrevious,
    atStart,
    atEnd,
    changeFontSize,
    changeFontFamily,
  } = useReader();

  const tocItems = useMemo(() => {
    const out: Array<{ label: string; href: string }> = [];
    const walk = (items: any[]) => {
      items.forEach((t) => {
        if (t?.href) {
          out.push({
            label: typeof t.label === 'string' ? t.label : '',
            href: typeof t.href === 'string' ? t.href : '',
          });
        }
        if (Array.isArray(t?.subitems) && t.subitems.length > 0) {
          walk(t.subitems);
        }
      });
    };
    walk((toc ?? []) as any[]);
    return out;
  }, [toc]);

  useEffect(() => {
    if (!readerReady) return;
    if (!tocItems || tocItems.length === 0) return;
    logger.info('📚 TOC loaded', { bookId, count: tocItems.length, sample: tocItems.slice(0, 8) });
  }, [bookId, readerReady, tocItems]);

  // Track when selection just happened to prevent immediate clearing
  const selectionJustMade = useRef(false);
  const lastSelectionSource = useRef<'epubjs' | 'fallback' | null>(null);
  const tapNavJustMade = useRef(false);
  const lastSavedCfi = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pendingRemoteCfiRef = useRef<string | null>(null);
  const resumeGuardRef = useRef<{ expectedCfi: string; expectedIndex0: number | null; expiresAt: number } | null>(null);
  const previousNavRef = useRef<{ cfi: string; page: number | null } | null>(null);
  const appliedInitialCfiRef = useRef<string | null>(null);

  // Reset per-book reader state so we never show stale page totals from the previous book.
  useEffect(() => {
    // Cancel any in-flight save timer from the previous book instance.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    lastSavedCfi.current = null;
    pendingRemoteCfiRef.current = null;
    resumeGuardRef.current = null;

    setSelection(null);
    setShowTranslateSheet(false);
    setTranslation(null);
    setTranslateError(null);
    setTranslating(false);

    setNavVisible(false);
    setNavInitialTab('navigate');

    setInitialLocation(undefined);
    setReaderReady(false);
    setProgressLoaded(false);
    appliedInitialCfiRef.current = null;

    // Reset overlay/progress UI (page counter)
    setCurrentPage(0);
    setTotalPages(0);
    setPageLoading(true);
    setChapterLeftPct(null);
  }, [bookId]);

  useEffect(() => {
    if (user) loadSettings(user.id);
  }, [user, loadSettings]);

  // Run once per book: verify file and load book data. Do not depend on t (useTranslation) or
  // the effect re-runs every render and triggers loadBookData -> setOptions -> re-render loop.
  useEffect(() => {
    logger.info('🔵 ReaderScreen mounted', { bookId, localPath });

    const verifyFile = async () => {
      try {
        const info = await FileSystem.getInfoAsync(localPath);
        logger.info('File info:', info);
        if (!info.exists) {
          logger.error('❌ File does not exist at path:', localPath);
          Alert.alert(t('common.error'), t('reader.bookNotFound'));
        }
      } catch (error) {
        logger.error('Failed to verify file:', error);
      }
    };

    verifyFile();
    loadBookData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted to avoid re-run every render
  }, [bookId, localPath]);

  // Engagement tracking for guest upgrade prompt
  useEffect(() => {
    if (!user) return;
    sessionStartRef.current = Date.now();

    incrementReadingSession(user.id)
      .then((e) => {
        // M3: reading_sessions >= 3 OR total_read_minutes >= 20
        if (e.sessions >= 3 || e.minutes >= 20) {
          upgradePrompt.requestShow(user.id, 'read_sessions', { isGuest }).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      if (!user) return;
      const start = sessionStartRef.current;
      if (!start) return;
      const minutes = Math.floor((Date.now() - start) / (1000 * 60));
      if (minutes <= 0) return;

      addReadMinutes(user.id, minutes)
        .then((e) => {
          if (e.sessions >= 3 || e.minutes >= 20) {
            upgradePrompt.requestShow(user.id, 'read_sessions', { isGuest }).catch(() => {});
          }
        })
        .catch(() => {});
    };
  }, [isGuest, upgradePrompt, user]);

  const loadReadingProgress = useCallback(async () => {
    const userId = user?.id ?? null;

    // Always try local cache first (fast, offline-friendly).
    const local = await getCachedLastCfi(userId, bookId);
    if (local?.cfi) {
      setInitialLocation(local.cfi);
      lastSavedCfi.current = local.cfi;
      logger.info('📌 Loaded local reading progress', { bookId, hasLocal: true });

      // Hydrate page counter immediately from local cache (best-effort).
      const hasTotal =
        typeof local.totalLocations === 'number' && Number.isFinite(local.totalLocations) && local.totalLocations > 0;
      const hasIndex = typeof local.locationIndex0 === 'number' && Number.isFinite(local.locationIndex0) && local.locationIndex0 >= 0;
      if (typeof local.totalLocations === 'number' && Number.isFinite(local.totalLocations) && local.totalLocations > 0) {
        setTotalPages(Math.floor(local.totalLocations));
      }
      if (typeof local.locationIndex0 === 'number' && Number.isFinite(local.locationIndex0) && local.locationIndex0 >= 0) {
        logger.info('setCurrentPage 1');
        setCurrentPage(Math.floor(local.locationIndex0) + 1);
      }

      // Guard against the common flicker where the reader briefly reports page 1 before jumping to the resume CFI.
      resumeGuardRef.current = {
        expectedCfi: local.cfi,
        expectedIndex0: hasIndex ? Math.floor(local.locationIndex0 as number) : null,
        expiresAt: Date.now() + 1500,
      };

      // If we have both page + total cached, we can render immediately without a loading state.
      // Otherwise, keep the spinner until `onLocationChange` fills in missing data.
      setPageLoading(!(hasTotal && hasIndex));
    }
    if (!local?.cfi) {
      // No local cache. Keep currentPage at 0 (loading state) until we know more.
      setCurrentPage(0);
      setTotalPages(0);
      setPageLoading(true);
    }

    // Let the reader mount as soon as local cache is checked.
    setProgressLoaded(true);

    // No signed-in user or DB progress disabled → local-only.
    if (!user || !readingProgressEnabled) return;

    try {
      const data = await fetchUserBook(user.id, bookId);
      const remoteCfi = data?.last_cfi ?? null;
      const savedHighlights = data?.highlights ?? [];
      const remoteUpdatedAt = data?.updated_at ? Date.parse(data.updated_at) : 0;

      logger.info('📌 Loaded remote reading progress', { bookId, hasProgress: Boolean(remoteCfi) });

      if (highlightsEnabled) setHighlights(savedHighlights);

      if (remoteCfi) {
        const shouldUseRemote = !local?.cfi || remoteUpdatedAt > (local?.updatedAt ?? 0);
        if (shouldUseRemote) {
          if (readerReady) {
            goToLocation(remoteCfi);
          } else {
            setInitialLocation(remoteCfi);
            pendingRemoteCfiRef.current = remoteCfi;
          }
          lastSavedCfi.current = remoteCfi;
          void setCachedLastCfi(userId, bookId, remoteCfi, remoteUpdatedAt > 0 ? remoteUpdatedAt : undefined);

          // Remote resume can also cause a brief "page 1" relocation before the jump; guard similarly.
          resumeGuardRef.current = {
            expectedCfi: remoteCfi,
            expectedIndex0: null,
            expiresAt: Date.now() + 1500,
          };
        }
      } else if (!local?.cfi) {
        // No remote resume and no local cache → first-time open.
        // onLocationChange will set the correct page once the reader reports its location.
        logger.info('First-time open, waiting for onLocationChange to set page');
      }
    } catch (error) {
      const code = (error as any)?.code;
      if (code === 'PGRST205') {
        // Table missing (migration not applied yet)
        setReadingProgressEnabled(false);
        logger.warn(
          'user_books table missing (apply Supabase migration `supabase/migrations/006_user_books.sql` to enable resume)',
          { code }
        );
      } else if (code === 'PGRST204') {
        // Column missing (migration not applied yet)
        setHighlightsEnabled(false);
        logger.warn(
          'user_books highlights missing (apply Supabase migration `supabase/migrations/008_user_books_highlights.sql` to enable persistent highlights)',
          { code }
        );
      } else {
        logger.error('Failed to load reading progress:', error);
      }
    }
  }, [bookId, goToLocation, highlightsEnabled, readerReady, readingProgressEnabled, user]);

  // As soon as the reader reports total locations, populate totalPages so we don't show "1 / 0".
  useEffect(() => {
    if (typeof totalLocations !== 'number' || !Number.isFinite(totalLocations) || totalLocations <= 0) return;
    if (totalPages > 0) return;
    setTotalPages(Math.floor(totalLocations));
    // If we already know the current page, we can stop showing the loading state.
    if (currentPage > 0) setPageLoading(false);
  }, [currentPage, setPageLoading, setTotalPages, totalLocations, totalPages]);

  useEffect(() => {
    // Always load local cache; remote load runs only when user exists.
    loadReadingProgress();
  }, [loadReadingProgress]);

  const loadListsForSave = useCallback(async () => {
    if (!user) return;
    try {
      const lists = await fetchVocabLists(user.id);
      if (lists.length === 0) {
        const created = await createVocabList(user.id, 'My Words');
        setVocabLists([created]);
        setSelectedListId(created.id);
        return;
      }

      setVocabLists(lists);

      const recent = await fetchMostRecentVocabList(user.id);
      if (recent?.id) {
        setSelectedListId(recent.id);
        return;
      }

      setSelectedListId(lists[0].id);
    } catch (error) {
      logger.error('Failed to load vocab lists:', error);
    }
  }, [user]);

  useEffect(() => {
    if (showTranslateSheet) {
      loadListsForSave();
    }
  }, [loadListsForSave, showTranslateSheet]);

  const flushReadingProgress = useCallback(async (cfi: string) => {
    void setCachedLastCfi(user?.id ?? null, bookId, cfi);
    if (!user || !readingProgressEnabled) return;
    try {
      await upsertUserBook({
        user_id: user.id,
        book_id: bookId,
        last_cfi: cfi,
      });
      lastSavedCfi.current = cfi;
      logger.debug('💾 Saved reading progress', { bookId });
    } catch (error) {
      const code = (error as any)?.code;
      if (code === 'PGRST205') {
        setReadingProgressEnabled(false);
        logger.warn(
          'user_books table missing (apply Supabase migration `supabase/migrations/006_user_books.sql` to enable resume)',
          { code }
        );
      } else {
        logger.error('Failed to save reading progress:', error);
      }
    }
  }, [bookId, readingProgressEnabled, user]);

  const scheduleSaveReadingProgress = useCallback((cfi: string) => {
    if (lastSavedCfi.current === cfi) return;
    void setCachedLastCfi(user?.id ?? null, bookId, cfi);
    if (!cfi || !user || !readingProgressEnabled) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushReadingProgress(cfi);
    }, 800);
  }, [flushReadingProgress, readingProgressEnabled, user]);

  useEffect(() => {
    // Flush on unmount
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const cfi = currentLocation?.start?.cfi;
      if (cfi) void flushReadingProgress(cfi);
    };
  }, [currentLocation?.start?.cfi, flushReadingProgress, user]);

  useEffect(() => {
    if (!selection) {
      logger.info('🧹 Selection cleared');
      return;
    }
    logger.info('🧩 Selection active', {
      source: lastSelectionSource.current,
      hasCfiRange: Boolean(selection.cfiRange),
      textPreview: selection.text.substring(0, 80),
      contextPreview: selection.context ? selection.context.substring(0, 120) : null,
      position: selection.position,
    });
  }, [selection]);

  const loadBookData = async () => {
    try {
      const bookData = await fetchBook(bookId);
      setBook(bookData);
      navigation.setOptions({
        title: bookData.title,
        headerRight: () => (
          <View style={{ marginRight: spacing.md }}>
            <Pressable
              onPress={() => setReaderSettingsVisible(true)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather name="more-vertical" size={24} color={colors.primary} />
            </Pressable>
          </View>
        ),
      });
    } catch (error) {
      logger.error('Failed to load book data:', error);
      Alert.alert('Error', 'Failed to load book');
    }
  };

  const applyHighlightsToReader = useCallback(() => {
    if (!readerReady || !highlightsEnabled) return;
    if (!addAnnotation || !removeAnnotationByCfi) return;

    highlights.forEach((h) => {
      if (!h?.cfi_range) return;
      try {
        const hex = h.color === 'yellow' ? colors.highlightYellow : h.color === 'pink' ? colors.highlightPink : colors.highlightMint;
        removeAnnotationByCfi(h.cfi_range);
        addAnnotation('highlight', h.cfi_range, { id: h.id }, { color: hex, opacity: 0.7 });
      } catch (e) {
        // Best-effort; CFI can fail if section not yet rendered
      }
    });
  }, [addAnnotation, highlights, highlightsEnabled, readerReady, removeAnnotationByCfi]);

  useEffect(() => {
    applyHighlightsToReader();
  }, [applyHighlightsToReader]);

  const handleTextSelected = useCallback((cfiRange: string, text: string) => {
    logger.info('📝 Text selected:', { cfiRange, text: text.substring(0, 50) });
    lastSelectionSource.current = 'epubjs';
    
    if (!validateSelectionLength(text, MAX_SELECTION_LENGTH)) {
      Alert.alert(t('reader.selectionTooLongTitle'), t('reader.selectionTooLong', { max: MAX_SELECTION_LENGTH }));
      return;
    }

    // Use last touch position to estimate selection location
    let position: { x: number; y: number; width: number; height: number } | undefined;
    
    if (lastTouchPosition) {
      position = {
        x: lastTouchPosition.x, // Center around touch point
        y: lastTouchPosition.y,
        width: 100, // Approximate selection width
        height: 40, // Approximate selection height
      };
      logger.info('📍 Using touch position for selection:', position);
    }

    setSelection({ text: text.trim(), cfiRange, position });
    logger.info('✅ Selection state updated, toolbar should appear');
    
    // Mark that selection just happened to prevent immediate clearing
    selectionJustMade.current = true;
    setTimeout(() => {
      selectionJustMade.current = false;
    }, 300);
  }, [lastTouchPosition, t]);

  const clearWebViewSelection = useCallback(() => {
    injectJavascript?.(
      `(function(){try{var d=document;if(d.getSelection){d.getSelection().removeAllRanges();}d.querySelectorAll('iframe').forEach(function(f){try{var id=f.contentDocument||f.contentWindow?.document;if(id&&id.getSelection){id.getSelection().removeAllRanges();}}catch(e){}});}catch(e){}}());true;`
    );
  }, [injectJavascript]);

  const handleHighlight = useCallback(async () => {
    if (!selection || !user || !book) return;
    if (!selection.cfiRange) {
      logger.warn('Highlight requested without cfiRange (fallback selection)', {
        textPreview: selection.text.substring(0, 80),
      });
      Alert.alert(t('reader.highlightUnavailableTitle'), t('reader.highlightUnavailable'));
      return;
    }
    if (!highlightsEnabled) {
      Alert.alert(t('reader.highlightsUnavailableTitle'), t('reader.highlightsUnavailable'));
      return;
    }

    try {
      const highlightColor = useReaderSettingsStore.getState().highlightColor;
      const now = new Date().toISOString();
      const newHighlight: UserBookHighlight = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        cfi_range: selection.cfiRange,
        selected_text: selection.text,
        created_at: now,
        color: highlightColor,
      };

      // Apply immediately in the reader (best-effort)
      try {
        removeAnnotationByCfi?.(newHighlight.cfi_range);
        const hex = highlightColor === 'yellow' ? colors.highlightYellow : highlightColor === 'pink' ? colors.highlightPink : colors.highlightMint;
          addAnnotation?.('highlight', newHighlight.cfi_range, { id: newHighlight.id }, { color: hex, opacity: 0.7 });
      } catch (e) {}

      setHighlights((prev) => [...prev, newHighlight]);
      await addUserBookHighlight(user.id, book.id, newHighlight);
      countAllUserHighlights(user.id)
        .then((c) => {
          if (c >= 5) {
            upgradePrompt.requestShow(user.id, 'highlights_5', { isGuest }).catch(() => {});
          }
        })
        .catch(() => {});
      setSelection(null);
      clearWebViewSelection();
    } catch (error) {
      logger.error('Failed to save highlight:', error);
      Alert.alert(t('common.error'), t('reader.failedToSaveHighlight'));
    }
  }, [addAnnotation, addUserBookHighlight, book, clearWebViewSelection, highlightsEnabled, isGuest, removeAnnotationByCfi, selection, t, upgradePrompt, user]);

  const handleJumpToHighlight = useCallback((cfiRange: string) => {
    if (!cfiRange) return;
    try {
      goToLocation?.(cfiRange);
    } catch (e) {}
    setNavVisible(false);
  }, [goToLocation]);

  const handleDeleteHighlight = useCallback(async (h: UserBookHighlight) => {
    if (!user || !book) return;
    Alert.alert(t('reader.deleteHighlightTitle'), t('reader.deleteHighlightMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            removeAnnotationByCfi?.(h.cfi_range);
            setHighlights((prev) => prev.filter((x) => x.id !== h.id));
            await deleteUserBookHighlight(user.id, book.id, h.id);
          } catch (error) {
            logger.error('Failed to delete highlight:', error);
            Alert.alert(t('common.error'), t('reader.failedToDeleteHighlight'));
          }
        },
      },
    ]);
  }, [book, deleteUserBookHighlight, removeAnnotationByCfi, t, user]);

  const handleTranslate = useCallback(async () => {
    if (!selection || !book?.source_lang) return;

    setShowTranslateSheet(true);
    setTranslating(true);
    setTranslateError(null);
    setTranslation(null);
    setSameLanguage(false);

    try {
      logger.info('🌐 Translating selection', {
        text: selection.text,
        context: selection.context ?? null,
        sourceLang: book.source_lang,
        targetLang,
      });

      const response = await translateText({
        source_lang: book.source_lang,
        target_lang: targetLang,
        text: selection.text,
        context: selection.context ?? undefined,
      });

      // Handle same-language case
      if (response.same_language) {
        logger.info('Same language detected, showing original text');
        setSameLanguage(true);
        setTranslation(t('reader.alreadyInLang', { text: selection.text, lang: t('language.' + targetLang) }));
      } else {
        setSameLanguage(false);
        setTranslation(response.translation);
      }
      
      // Log detected language for debugging
      if (response.detected_lang && response.detected_lang !== book.source_lang) {
        logger.info(`Language mismatch: book=${book.source_lang}, detected=${response.detected_lang}`);
      }
    } catch (error: any) {
      logger.error('Translation failed:', error);
      setTranslateError(error.message || t('msg.translationFailed'));
    } finally {
      setTranslating(false);
    }
  }, [selection, book, targetLang, t]);

  const highlightOnTranslate = useReaderSettingsStore((s) => s.highlightOnTranslate);

  const handleSaveStudyWord = useCallback(async () => {
    if (!selection || !translation || !user || !book?.source_lang) return;
    if (!selectedListId) {
      setSnackbar({ visible: true, message: t('msg.chooseList'), type: 'error' });
      return;
    }

    try {
      // Auto-highlight when translating (if enabled in settings)
      if (highlightOnTranslate && selection.cfiRange && highlightsEnabled) {
        try {
          const readerHighlightColor = useReaderSettingsStore.getState().highlightColor;
          const highlightHex = readerHighlightColor === 'yellow' ? colors.highlightYellow
            : readerHighlightColor === 'pink' ? colors.highlightPink
            : colors.highlightMint;
          const now = new Date().toISOString();
          const newHighlight: UserBookHighlight = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            cfi_range: selection.cfiRange,
            selected_text: selection.text,
            created_at: now,
            color: readerHighlightColor,
          };
          addAnnotation?.('highlight', selection.cfiRange, { id: newHighlight.id }, { color: highlightHex, opacity: 0.7 });
          setHighlights((prev) => [...prev, newHighlight]);
          await addUserBookHighlight(user.id, book.id, newHighlight);
        } catch (e) {
          logger.warn('Auto-highlight on translate failed', e);
        }
      }

      const translationToSave = sameLanguage ? selection.text : translation;
      const newWord = await createStudyWord({
        user_id: user.id,
        book_id: book.id,
        list_id: selectedListId,
        source_lang: book.source_lang,
        target_lang: targetLang,
        term: selection.text,
        term_normalized: normalizeText(selection.text),
        translation: translationToSave,
        context_snippet: selection.context ?? null,
      });

      // Optimistically update the study store cache
      studyStore.upsertWordInCache(selectedListId, newWord);
      studyStore.adjustListCount(selectedListId, 1);
      studyStore.adjustAllCount(1);

      touchVocabList(selectedListId).catch(() => {});
      setSnackbar({ visible: true, message: t('msg.addedToList'), type: 'success' });
      countAllStudyWords(user.id)
        .then((c) => {
          if (c >= 10) {
            upgradePrompt.requestShow(user.id, 'vocab_10', { isGuest }).catch(() => {});
          }
        })
        .catch(() => {});
      setShowTranslateSheet(false);
      setSelection(null);
      clearWebViewSelection();
    } catch (error) {
      logger.error('Failed to save study word:', error);
      setSnackbar({ visible: true, message: t('msg.failedToSave'), type: 'error' });
    }
  }, [addAnnotation, book, clearWebViewSelection, highlightOnTranslate, highlightsEnabled, isGuest, sameLanguage, selectedListId, selection, studyStore, t, targetLang, translation, upgradePrompt, user]);

  const handleCloseToolbar = useCallback(() => {
    setSelection(null);
    clearWebViewSelection();
  }, [clearWebViewSelection]);

  const handlePressAnnotation = useCallback((annotation: { cfiRange?: string; data?: { id?: string }; cfiRangeText?: string }) => {
    if (!annotation?.cfiRange) return;
    const highlight = highlights.find((h) => h.id === annotation.data?.id || h.cfi_range === annotation.cfiRange);
    if (highlight) {
      Alert.alert(t('reader.highlights'), highlight.selected_text, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reader.removeHighlight'), style: 'destructive', onPress: () => handleDeleteHighlight(highlight) },
      ]);
    }
  }, [highlights, handleDeleteHighlight, t]);

  const handleCreateNewList = useCallback(async (listName: string) => {
    if (!user) return;
    try {
      const newList = await createVocabList(user.id, listName);
      setVocabLists((prev) => [...prev, newList]);
      setSelectedListId(newList.id);
      setSnackbar({ visible: true, message: t('msg.listCreated', { name: listName }), type: 'success' });
    } catch (error) {
      logger.error('Failed to create list:', error);
      setSnackbar({ visible: true, message: t('msg.failedToCreateList'), type: 'error' });
    }
  }, [t, user]);

  const handleCloseSheet = useCallback(() => {
    logger.info('Closing TranslateSheet', { listPickerVisible });
    setShowTranslateSheet(false);
    setListPickerVisible(false);
    setSelection(null);
    clearWebViewSelection();
  }, [clearWebViewSelection, listPickerVisible]);

  const handleTapLeftEdge = useCallback(() => {
    if (selection || showTranslateSheet || selectionJustMade.current) return;
    if (navVisible) return;
    if (atStart) return;
    tapNavJustMade.current = true;
    setTimeout(() => {
      tapNavJustMade.current = false;
    }, 250);
    logger.info('👈 Tap left edge');
    if (totalPages > 0) setPageLoading(false);
    goPrevious?.();
  }, [atStart, goPrevious, navVisible, selection, setPageLoading, showTranslateSheet, totalPages]);

  const handleTapRightEdge = useCallback(() => {
    if (selection || showTranslateSheet || selectionJustMade.current) return;
    if (navVisible) return;
    if (atEnd) return;
    tapNavJustMade.current = true;
    setTimeout(() => {
      tapNavJustMade.current = false;
    }, 250);
    logger.info('👉 Tap right edge');
    if (totalPages > 0) setPageLoading(false);
    goNext?.();
  }, [atEnd, goNext, navVisible, selection, setPageLoading, showTranslateSheet, totalPages]);

  const handleReaderWebViewMessage = useCallback((event: any) => {
    // This only receives NON-internal events from the epubjs webview template.
    // We use it as a "selection debug + fallback" bridge.
    try {
      const type = event?.type;
      if (type === 'llNavDebug') {
        logger.info('🧭 llNavDebug (web)', event);
        return;
      }
      if (type === 'llSelectionCleared') {
        logger.info('🧪 llSelectionCleared (web)', { sourceHref: event?.sourceHref });
        setSelection(null);
        setShowTranslateSheet(false);
        setTranslation(null);
        setTranslateError(null);
        setTranslating(false);
        lastSelectionSource.current = null;
        return;
      }
      if (type === 'llHighlightClicked') {
        const cfi = event?.cfi;
        const highlightId = event?.highlightId;
        const highlight = highlights.find((h) => h.id === highlightId || h.cfi_range === cfi);
        if (highlight) {
          Alert.alert(t('reader.highlights'), highlight.selected_text, [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('reader.removeHighlight'), style: 'destructive', onPress: () => handleDeleteHighlight(highlight) },
          ]);
        }
        return;
      }

      if (type !== 'llSelectionDebug') {
        logger.debug('🌐 Reader onWebViewMessage', event);
        return;
      }

      const text = typeof event?.text === 'string' ? event.text.trim() : '';
      const context = typeof event?.context === 'string' ? event.context.trim() : '';
      if (!text) return;

      logger.info('🧪 llSelectionDebug (web)', {
        sourceHref: event?.sourceHref,
        length: text.length,
        preview: text.substring(0, 80),
        contextPreview: context ? context.substring(0, 120) : null,
        rect: event?.rect,
      });

      // Fallback: if epubjs onSelected isn't firing, at least show the toolbar for translate.
      // We intentionally do NOT set cfiRange here.
      if (!selection) {
        lastSelectionSource.current = 'fallback';
        setSelection({
          text,
          cfiRange: '',
          position: event?.rect
            ? {
                x: event.rect.x ?? 0,
                y: event.rect.y ?? 0,
                width: event.rect.width ?? 100,
                height: event.rect.height ?? 40,
              }
            : undefined,
          context: context || null,
        });
        setLastTouchPosition({ x: event?.rect?.x ?? 0, y: event?.rect?.y ?? 0 });
      } else if (selection.text === text && context) {
        // Enrich existing selection (e.g. epubjs onSelected fired) with context from the web layer.
        setSelection(prev => (prev ? { ...prev, context, position: event?.rect ? { x: event.rect.x ?? prev?.position?.x ?? 0, y: event.rect.y ?? prev?.position?.y ?? 0, width: event.rect.width ?? prev?.position?.width ?? 100, height: event.rect.height ?? prev?.position?.height ?? 40 } : prev?.position } : prev));
      }
    } catch (error) {
      logger.error('Failed handling onWebViewMessage', error);
    }
  }, [handleDeleteHighlight, highlights, lastTouchPosition, selection, t]);

  const readerTheme = READER_THEME;
  const injectedJavascript = READER_INJECTED_JAVASCRIPT;


  // Memoize callbacks to prevent Reader re-renders
  const handleReaderSelected = useCallback((selectedText: string, cfiRange: string) => {
    logger.info('📝 Text selected:', { selectedText: selectedText.substring(0, 50), cfiRange });
    handleTextSelected(cfiRange, selectedText);
  }, [handleTextSelected]);

  const handleReaderStarted = useCallback(() => {
    logger.info('✅ Reader started');
  }, []);

  const handleReaderRendered = useCallback((section: any) => {
    logger.info('✅ Section rendered', section);
  }, []);

  const handleReaderError = useCallback((error: string) => {
    logger.error('❌ Reader display error:', error);
    Alert.alert(t('reader.readerErrorTitle'), t('reader.failedToDisplayBook'));
  }, [t]);

  const handleReaderPress = useCallback(() => {
    // Don't clear if selection was just made (prevents race condition)
    if (selectionJustMade.current || tapNavJustMade.current) {
      logger.debug('Reader pressed - ignoring, selection just made');
      return;
    }
    // Clear selection when tapping anywhere
    logger.debug('Reader pressed', selection ? '- clearing selection' : '- no selection');
    setSelection(null);
    setShowTranslateSheet(false);
  }, [selection]);

  const handleReaderSingleTap = useCallback(() => {
    logger.info('📱 Single tap detected');
    // Don't clear if selection was just made (prevents race condition)
    if (selectionJustMade.current || tapNavJustMade.current) {
      logger.debug('Single tap - ignoring, selection just made');
      return;
    }
    // If nothing is selected and no sheet is open, treat center tap as "toggle nav"
    if (!selection && !showTranslateSheet) {
      setNavVisible((prev) => !prev);
      logger.debug('Single tap - toggling navigation', { next: !navVisible });
      return;
    }

    // Otherwise clear selection when tapping
    logger.debug('Single tap', selection ? '- clearing selection' : '- no selection');
    setSelection(null);
    setShowTranslateSheet(false);
  }, [navVisible, selection, showTranslateSheet]);

  const handleReaderLongPress = useCallback(() => {
    logger.info('📱 Long press detected');
  }, []);

  const handleReaderReady = useCallback((readyTotalLocations: number, readyLocation: Location, readyProgress: number) => {
    const idx = readyLocation?.start?.location;
    const cfi = readyLocation?.start?.cfi;
    const displayedPage = readyLocation?.start?.displayed?.page;
    const displayedTotal = readyLocation?.start?.displayed?.total;

    logger.info('✅ Reader ready', {
      totalLocations: typeof readyTotalLocations === 'number' ? readyTotalLocations : 0,
      startLocationIndex: idx,
      progress: readyProgress,
      displayed: readyLocation?.start?.displayed,
      displayedPage,
      displayedTotal,
    });

    setReaderReady(true);

    // Resolve loading state: we're on first page when reader is ready. Locations may generate async.
    const total = typeof readyTotalLocations === 'number' && Number.isFinite(readyTotalLocations) && readyTotalLocations > 0
      ? Math.floor(readyTotalLocations) : 0;
    const pageFromIdx = typeof idx === 'number' && Number.isFinite(idx) && idx >= 0 ? Math.floor(idx) + 1 : 1;
    setCurrentPage(pageFromIdx);
    if (total > 0) setTotalPages(total);
    setPageLoading(false);

    if (cfi) {
      // Save immediately on ready (covers cases where user opens and closes quickly)
      scheduleSaveReadingProgress(cfi);
    }

    // Force paginated flow so epub.js emits "relocated" on each page turn (not only when changing spine items).
    // This makes `onLocationChange` reliable for mid-chapter progress updates.
    injectJavascript?.(
      `(function(){` +
        `try{` +
          `var r=null; try{r=(typeof rendition!=='undefined'?rendition:(window.rendition||null));}catch(e){r=(window.rendition||null);}` +
          `if(!r){return true;}` +
          `if(r.flow){try{r.flow('paginated');}catch(e1){}}` +
          `if(r.spread){try{r.spread('none');}catch(e2){}}` +
          `if(r.resize){try{r.resize();}catch(e3){}}` +
        `}catch(e){}` +
        `return true;` +
      `})()`
    );
  }, [scheduleSaveReadingProgress]);

  const handleLocationChange = useCallback((
    totalLocs: number,
    loc: Location,
    progress: number,
    currentSection: Section | null
  ) => {
    logger.info('Location change', {
      totalLocs,
      progress,
      sectionHref: currentSection?.href ?? null,
      startLocationIndex: loc?.start?.location ?? null,
      cfi: loc?.start?.cfi ?? null,
      displayed: loc?.start?.displayed ?? null,
    });
    const cfi = loc?.start?.cfi;
    const displayedPage = loc?.start?.displayed?.page;
    const displayedTotal = loc?.start?.displayed?.total;
    logger.info('Location displayed', { displayedPage, displayedTotal });

    // Update page counter from the reader's generated location index (0-based).
    let idx0: number | undefined = loc?.start?.location;
    if (typeof idx0 !== 'number' || !Number.isFinite(idx0) || idx0 < 0) {
      const disp = loc?.start?.displayed;
      if (disp && typeof disp.page === 'number' && typeof disp.total === 'number' && disp.total > 0) {
        idx0 = Math.max(0, disp.page - 1);
      } else if (typeof progress === 'number' && Number.isFinite(progress) && progress >= 0) {
        const total = typeof totalLocs === 'number' && totalLocs > 0 ? totalLocs : 1;
        idx0 = Math.min(total - 1, Math.floor((progress / 100) * total));
      }
    }
    const hasTotalLocs = typeof totalLocs === 'number' && Number.isFinite(totalLocs) && totalLocs > 0;

    const guard = resumeGuardRef.current;
    if (guard && Date.now() < guard.expiresAt && guard.expectedIndex0 !== null) {
      const expected = guard.expectedIndex0;
      if (typeof idx0 === 'number' && idx0 < Math.max(0, expected - 2) && cfi && cfi !== guard.expectedCfi) {
        return;
      }
      resumeGuardRef.current = null;
    }

    if (hasTotalLocs) {
      setTotalPages(Math.floor(totalLocs));
    }
    if (typeof idx0 === 'number' && Number.isFinite(idx0) && idx0 >= 0) {
      if (!hasTotalLocs && currentPage > 0) {
        if (cfi) scheduleSaveReadingProgress(cfi);
        return;
      }
      const newPage = Math.floor(idx0) + 1;
      const displayedPage = useReaderStore.getState().currentPage;
      if (newPage !== displayedPage) {
        setCurrentPage(newPage);
      }
      setPageLoading(false);
      setChapterLeftPct(null);

      // Persist numeric index only when locations are ready (avoid clobbering cache with idx0=0).
      if (hasTotalLocs && cfi) {
        void setCachedLastPosition(user?.id ?? null, bookId, {
          cfi,
          locationIndex0: Math.floor(idx0),
          totalLocations: Math.floor(totalLocs),
        });
      }
    }

    if (cfi) {
      scheduleSaveReadingProgress(cfi);
    }

    logger.debug('📄 Location changed', {
      startLocationIndex: loc?.start?.location ?? null,
      progress,
      sectionHref: currentSection?.href ?? null,
      displayed: loc?.start?.displayed,
    });
  }, [bookId, currentPage, scheduleSaveReadingProgress, setChapterLeftPct, setCurrentPage, setPageLoading, setTotalPages, user?.id]);

  const handleGoToHref = useCallback(
    (href: string) => {
      const raw = typeof href === 'string' ? href.trim() : '';
      if (!raw) return;

      // Allow "go back" if this jump was accidental.
      const curCfi = currentLocation?.start?.cfi ?? null;
      previousNavRef.current = curCfi ? { cfi: curCfi, page: currentPage > 0 ? currentPage : null } : null;

      const tryDecode = (s: string): string | null => {
        try {
          const out = decodeURIComponent(s);
          return out === s ? null : out;
        } catch {
          return null;
        }
      };

      const stripLeading = (s: string): string => {
        let out = s;
        // Common EPUB root folders
        out = out.replace(/^\/+/, '');
        out = out.replace(/^(OEBPS|OPS)\//i, '');
        out = out.replace(/^\.\/+/, '');
        return out;
      };

      // Normalization: keep both with/without fragment; also include decoded variants.
      const noHash = raw.split('#')[0] ?? raw;
      const decodedRaw = tryDecode(raw);
      const decodedNoHash = tryDecode(noHash);

      const candidates = Array.from(
        new Set(
          [
            raw,
            noHash,
            decodedRaw,
            decodedNoHash,
            stripLeading(raw),
            stripLeading(noHash),
            decodedRaw ? stripLeading(decodedRaw) : null,
            decodedNoHash ? stripLeading(decodedNoHash) : null,
          ].filter((x): x is string => typeof x === 'string' && x.length > 0)
        )
      );

      logger.info('Navigate: go to chapter', {
        href: raw,
        candidates,
        currentHref: currentLocation?.start?.href ?? null,
      });

      // Only use goToLocation directly for CFIs. For hrefs, prefer rendition.display().
      const looksLikeCfi = raw.startsWith('epubcfi(');
      if (looksLikeCfi) {
        try {
          goToLocation(raw);
        } catch {
          // fall through to WebView display
        }
      }

      // Reliable fallback: call epub.js rendition.display(href) inside the WebView.
      const safeCandidates = candidates
        .map((c) => c.replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
        .map((c) => `'${c}'`)
        .join(',');

      injectJavascript?.(
        `(function(){` +
          `var post=function(p){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage&&window.ReactNativeWebView.postMessage(JSON.stringify(p));}catch(e){}};` +
          `try{` +
            `var r=null; try{r=(typeof rendition!=='undefined'?rendition:(window.rendition||null));}catch(e){r=(window.rendition||null);}` +
            `if(!r||!r.display){post({type:'llNavDebug', did:false, reason:'no_rendition'}); return true;}` +
            `var candidates=[${safeCandidates}];` +
            // Prefer fragment candidates first (single-file books often use #id for chapters)
            `candidates.sort(function(a,b){return (String(a).indexOf('#')>=0?0:1) - (String(b).indexOf('#')>=0?0:1);});` +
            `var splitHref=function(h){try{h=String(h||''); var i=h.indexOf('#'); return i>=0?{path:h.slice(0,i), frag:h.slice(i+1)}:{path:h, frag:''};}catch(e){return {path:String(h||''), frag:''};}};` +
            `var normPath=function(s){try{` +
              `s=String(s||'');` +
              `s=s.replace(/^\\/+/, '');` +
              `s=s.replace(/^(OEBPS|OPS)\\//i, '');` +
              `s=s.replace(/^\\.\\/+/, '');` +
              `s=s.split('#')[0]||s;` +
              `try{s=decodeURIComponent(s);}catch(e){};` +
              `return s;` +
            `}catch(e){return String(s||'');}};` +
            `var curLoc=function(){try{` +
              `if(typeof r.currentLocation==='function') return r.currentLocation();` +
              `return (r.location||null);` +
            `}catch(e){return null;}};` +
            `var curHref=function(){try{var l=curLoc(); return l&&l.start&&l.start.href?l.start.href:null;}catch(e){return null;}};` +
            `var curCfi=function(){try{var l=curLoc(); return l&&l.start&&l.start.cfi?l.start.cfi:null;}catch(e){return null;}};` +
            `var findAndDisplayAnchor=async function(frag){` +
              `try{` +
                `if(!frag) return true;` +
                `var cs=[]; try{cs=(typeof r.getContents==='function')?r.getContents():[];}catch(e){cs=[];}` +
                `for(var j=0;j<cs.length;j++){` +
                  `var c=cs[j];` +
                  `var doc=c&&c.document?c.document:null;` +
                  `if(!doc||!doc.getElementById) continue;` +
                  `var el=null; try{el=doc.getElementById(frag);}catch(e2){el=null;}` +
                  `if(!el) continue;` +
                  `try{` +
                    `if(typeof c.cfiFromElement==='function'){` +
                      `var acfi=c.cfiFromElement(el);` +
                      `if(acfi){try{await r.display(acfi);}catch(e3){}}` +
                    `}else{` +
                      `try{el.scrollIntoView();}catch(e4){}` +
                    `}` +
                  `}catch(e5){}` +
                  `return true;` +
                `}` +
                `return false;` +
              `}catch(e){return false;}` +
            `};` +
            `(async function(){` +
              `var beforeHref=curHref();` +
              `var beforeCfi=curCfi();` +
              `for(var i=0;i<candidates.length;i++){` +
                `var h=candidates[i];` +
                `var sp=splitHref(h);` +
                `var did=false;` +
                `try{await r.display(h); did=true;}catch(e){try{await r.display(sp.path); did=true;}catch(e2){did=false;}}` +
                `if(!did) continue;` +
                `try{await new Promise(function(res){setTimeout(res, 0);});}catch(e3){}` +
                `if(sp.frag){` +
                  `var ok=await findAndDisplayAnchor(sp.frag);` +
                  `try{await new Promise(function(res){setTimeout(res, 0);});}catch(e4){}` +
                  `if(!ok){continue;}` +
                `}` +
                `var afterHref=curHref();` +
                `var afterCfi=curCfi();` +
                // Success if we landed on the right spine doc, and if fragment exists we also changed CFI (best-effort)
                `var sameDoc=afterHref && normPath(afterHref)===normPath(sp.path||h);` +
                `var moved=!beforeCfi || !afterCfi ? true : (afterCfi!==beforeCfi);` +
                `if(sameDoc && (!sp.frag || moved)){` +
                  `post({type:'llNavDebug', did:true, used:h, before:beforeHref, after:afterHref, beforeCfi:beforeCfi, afterCfi:afterCfi, frag:sp.frag||null, candidates:candidates});` +
                  `return;` +
                `}` +
              `}` +
              `post({type:'llNavDebug', did:false, reason:'no_match', before:beforeHref, after:curHref(), candidates:candidates});` +
            `})();` +
          `}catch(e){post({type:'llNavDebug', did:false, error:String(e)});}` +
          `return true;` +
        `})()`
      );

      setNavVisible(false);
    },
    [currentLocation?.start?.cfi, currentLocation?.start?.href, currentPage, goToLocation, injectJavascript]
  );

  const handleGoBack = useCallback(() => {
    const prev = previousNavRef.current;
    if (!prev?.cfi) return;
    try {
      goToLocation(prev.cfi);
    } catch {
      // ignore
    }
  }, [goToLocation]);

  const handleGoToPage = useCallback(
    (page: number) => {
      const total = totalPages;
      if (total <= 0) return;
      if (!Number.isFinite(page) || page < 1 || page > total) return;

      // Capture "go back" target before jumping.
      const curCfi = currentLocation?.start?.cfi ?? null;
      previousNavRef.current = curCfi ? { cfi: curCfi, page: currentPage > 0 ? currentPage : null } : null;

      const idx0 = page - 1;
      // Optimistic UI + guard against early bogus relocations.
      setCurrentPage(page);
      setPageLoading(true);
      resumeGuardRef.current = { expectedCfi: '', expectedIndex0: idx0, expiresAt: Date.now() + 1500 };

      // Prefer a WebView-side jump that doesn't require pulling the huge `locations[]` array into RN memory.
      // This works as soon as book.locations are generated (which is also what sets totalPages).
      injectJavascript?.(
        `(function(){` +
          `var post=function(p){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage&&window.ReactNativeWebView.postMessage(JSON.stringify(p));}catch(e){}};` +
          `try{` +
            `var b=null; try{b=(typeof book!=='undefined'?book:(window.book||null));}catch(e){b=(window.book||null);}` +
            `var r=null; try{r=(typeof rendition!=='undefined'?rendition:(window.rendition||null));}catch(e2){r=(window.rendition||null);}` +
            `if(!b||!r||!r.display||!b.locations){post({type:'llNavDebug', did:false, reason:'no_book_or_rendition'}); return true;}` +
            `var idx=${idx0};` +
            `var cfi=null; try{` +
              `if(typeof b.locations.cfiFromLocation==='function'){cfi=b.locations.cfiFromLocation(idx);} ` +
              `else if(typeof b.locations.cfiFromPercentage==='function' && b.locations.total>0){cfi=b.locations.cfiFromPercentage(idx/(b.locations.total-1));}` +
            `}catch(e3){cfi=null;}` +
            `if(!cfi){post({type:'llNavDebug', did:false, reason:'no_cfi_for_page', idx:idx, total:(b.locations&&b.locations.total)||0}); return true;}` +
            `(async function(){` +
              `try{await r.display(cfi);}catch(e4){try{r.display(cfi);}catch(e5){}}` +
              `post({type:'llNavDebug', did:true, used:'page', idx:idx, cfi:cfi});` +
            `})();` +
          `}catch(e){post({type:'llNavDebug', did:false, error:String(e)});}` +
          `return true;` +
        `})()`
      );
    },
    [currentLocation?.start?.cfi, currentPage, injectJavascript, setCurrentPage, setPageLoading, totalPages]
  );

  // Apply reader font settings when ready or when they change.
  // Font changes apply instantly; no spinner — epub.js locations regenerate in background and we update when ready.
  const readerFontSize = useReaderSettingsStore((s) => s.fontSize);
  const readerFontFamily = useReaderSettingsStore((s) => s.fontFamily);
  useEffect(() => {
    if (!readerReady || !changeFontSize || !changeFontFamily) return;
    changeFontSize(readerFontSize);
    changeFontFamily(readerFontFamily);
  }, [readerReady, readerFontSize, readerFontFamily, changeFontSize, changeFontFamily]);

  useEffect(() => {
    if (!readerReady) return;
    const pending = pendingRemoteCfiRef.current;
    if (!pending) return;
    pendingRemoteCfiRef.current = null;
    goToLocation(pending);
  }, [goToLocation, readerReady]);

  // Force displayed page to match cached initialLocation when reader is ready (fixes page counter correct but content on cover).
  useEffect(() => {
    if (!readerReady || !initialLocation || !goToLocation) return;
    if (appliedInitialCfiRef.current === initialLocation) return;
    appliedInitialCfiRef.current = initialLocation;
    const t = setTimeout(() => {
      try {
        goToLocation(initialLocation);
      } catch (e) {
        appliedInitialCfiRef.current = null;
      }
    }, 100);
    return () => clearTimeout(t);
  }, [goToLocation, initialLocation, readerReady]);

  // Ensure we've checked local resume state before mounting the Reader.
  if (!progressLoaded) {
    return <View style={styles.container} />;
  }

  const readerOffset = readerLayout
    ? { x: readerLayout.x + READER_EDGE_WIDTH, y: readerLayout.y + spacing.lg }
    : { x: READER_EDGE_WIDTH, y: spacing.lg };

  return (
    <View style={styles.container}>
      <View
        style={styles.readerWrapper}
        onLayout={(e) => {
          const { x, y } = e.nativeEvent.layout;
          setReaderLayout({ x, y });
        }}
      >
        <ReaderEdgeTapOverlay onTapLeft={handleTapLeftEdge} onTapRight={handleTapRightEdge}>
          <Reader
            src={localPath}
            fileSystem={useFileSystem}
            defaultTheme={readerTheme}
            injectedJavascript={injectedJavascript}
            manager="default"
            flow="paginated"
            snap={true}
            enableSwipe={true}
            enableSelection={true}
            allowPopups={false}
            allowScriptedContent={true}
            initialLocation={initialLocation}
            onSelected={handleReaderSelected}
            onPressAnnotation={handlePressAnnotation}
            onStarted={handleReaderStarted}
            onReady={handleReaderReady}
            onRendered={handleReaderRendered}
            onDisplayError={handleReaderError}
            onPress={handleReaderPress}
            onSingleTap={handleReaderSingleTap}
            onLongPress={handleReaderLongPress}
            onLocationChange={handleLocationChange}
            onLocationsReady={(epubKey, locs) => {
              if (Array.isArray(locs) && locs.length > 0) {
                setTotalPages(locs.length);
                if (currentPage > 0) setPageLoading(false);
              }
            }}
            onWebViewMessage={handleReaderWebViewMessage}
          />
        </ReaderEdgeTapOverlay>
      </View>
      <ReaderOverlays
        currentPage={currentPage}
        totalPages={totalPages}
        pageLoading={pageLoading}
        chapterLeftPct={chapterLeftPct}
        onPressNavigate={() => {
          setNavInitialTab('navigate');
          setNavVisible(true);
        }}
      />
      {/* Custom Selection Toolbar */}
      {selection && !showTranslateSheet && (
        <SelectionToolbar
          onHighlight={handleHighlight}
          onTranslate={handleTranslate}
          onClose={handleCloseToolbar}
          selectionBounds={selection.position}
          readerOffset={readerOffset}
        />
      )}
      <TranslateSheet
        visible={showTranslateSheet}
        term={selection?.text || ''}
        translation={translation}
        loading={translating}
        error={translateError}
        selectedListName={vocabLists.find((l) => l.id === selectedListId)?.name ?? null}
        onSelectList={() => {
          logger.info('Opening vocab list picker', {
            listCount: vocabLists.length,
            selectedListId,
          });
          setListPickerVisible(true);
        }}
        listPickerVisible={listPickerVisible}
        lists={vocabLists}
        selectedListId={selectedListId}
        onPickList={(id) => {
          setSelectedListId(id);
          setListPickerVisible(false);
        }}
        onCloseListPicker={() => setListPickerVisible(false)}
        onCreateNewList={handleCreateNewList}
        onSave={handleSaveStudyWord}
        onClose={handleCloseSheet}
      />
      <BookNavigationSheet
        visible={navVisible}
        initialTab={navInitialTab}
            currentPage={currentPage}
            totalPages={totalPages}
        tocItems={tocItems}
            canGoBack={Boolean(previousNavRef.current?.cfi)}
        onClose={() => setNavVisible(false)}
        onGoToHref={handleGoToHref}
            onGoToPage={handleGoToPage}
            onGoBack={handleGoBack}
        highlights={highlights}
        onJumpToHighlight={(cfiRange) => handleJumpToHighlight(cfiRange)}
        onDeleteHighlight={(h) => handleDeleteHighlight(h)}
      />
      <UpgradeAccountPrompt
        visible={upgradePrompt.visible}
        onClose={upgradePrompt.close}
        onNotNow={() => {
          if (user) upgradePrompt.dismiss(user.id).catch(() => {});
        }}
      />
      <ReaderSettingsModal
        visible={readerSettingsVisible}
        onClose={() => setReaderSettingsVisible(false)}
      />
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        passThrough
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  readerWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    // Reserve space for bottom overlays (e.g. Navigate button) so they don't cover text.
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  notice: {
    margin: 20,
    padding: 20,
    backgroundColor: colors.highlightYellow,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  noticeSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: 8,
  },
});

