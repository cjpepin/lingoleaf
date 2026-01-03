/**
 * ReaderScreen
 * EPUB reader with selection, highlight, and translation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
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
import { ReaderEdgeTapOverlay } from '@/components/ReaderEdgeTapOverlay';
import { ReaderOverlays } from '@/components/ReaderOverlays';
import { UpgradeAccountPrompt } from '@/components/UpgradeAccountPrompt';
import { useAuthStore } from '@/state/useAuthStore';
import { useUpgradePromptStore } from '@/state/useUpgradePromptStore';
import { useSettingsStore } from '@/state/useSettingsStore';
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
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { addReadMinutes, incrementReadingSession } from '@/utils/readingEngagement';
import { getCachedLastCfi, setCachedLastCfi } from '@/utils/readerProgressCache';

type ReaderRouteProp = RouteProp<RootStackParamList, 'Reader'>;

interface Selection {
  text: string;
  cfiRange: string;
  position?: { x: number; y: number; width: number; height: number };
  context?: string | null;
}

export default function ReaderScreen() {
  const route = useRoute<ReaderRouteProp>();
  const navigation = useNavigation();
  const { bookId, localPath } = route.params;
  const { user, isGuest } = useAuthStore();
  const { targetLang } = useSettingsStore();
  const upgradePrompt = useUpgradePromptStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  
  const [book, setBook] = useState<Book | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showTranslateSheet, setShowTranslateSheet] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [vocabLists, setVocabLists] = useState<VocabList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [highlights, setHighlights] = useState<UserBookHighlight[]>([]);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [navVisible, setNavVisible] = useState(false);
  const [navInitialTab, setNavInitialTab] = useState<'navigate' | 'highlights'>('navigate');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [chapterLeftPct, setChapterLeftPct] = useState<number | null>(null);
  const [locationCfis, setLocationCfis] = useState<string[]>([]);
  const [lastTouchPosition, setLastTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [initialLocation, setInitialLocation] = useState<string | undefined>(undefined);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [readingProgressEnabled, setReadingProgressEnabled] = useState(true);
  const [readerReady, setReaderReady] = useState(false);

  // Map CFIs to indices so we can have a stable "page number" based on onLocationsReady CFIs
  const cfiToIndexRef = useRef<Map<string, number>>(new Map());
  const avgLocsPerPageRef = useRef<number>(42); // start near typical ~400 pages for ~16k locations
  const lastLocIdxRef = useRef<number | null>(null);
  const lastDisplayedPageRef = useRef<number | null>(null);
  const lastSectionHrefRef = useRef<string | null>(null);
  const lastProgressRef = useRef<number | null>(null);
  const lastTotalLocsRef = useRef<number | null>(null);
  const globalTotalPagesRef = useRef<number | null>(null);

  const clampNum = useCallback((n: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, n));
  }, []);

  const normalizeProgress = useCallback(
    (raw: number): number | null => {
      if (!Number.isFinite(raw)) return null;
      // Some callbacks report progress as 0..100 (percent). Others use 0..1.
      const p = raw > 1.001 ? raw / 100 : raw;
      return clampNum(p, 0, 1);
    },
    [clampNum]
  );

  const computeGlobalTotalPages = useCallback((): number | null => {
    const fixed = globalTotalPagesRef.current;
    if (typeof fixed === 'number' && Number.isFinite(fixed) && fixed > 0) return fixed;
    const totalLocs =
      typeof lastTotalLocsRef.current === 'number' && Number.isFinite(lastTotalLocsRef.current)
        ? lastTotalLocsRef.current
        : locationCfis.length > 0
          ? locationCfis.length
          : null;
    if (!totalLocs || totalLocs <= 0) return null;
    const perPage = Math.max(8, Math.min(200, avgLocsPerPageRef.current));
    const total = Math.max(1, Math.round(totalLocs / perPage));
    globalTotalPagesRef.current = total;
    return total;
  }, [locationCfis.length]);

  const computeGlobalPageFromLocationIndex = useCallback(
    (locIdx0: number, totalLocs: number, totalPages: number): number => {
      if (!Number.isFinite(locIdx0) || !Number.isFinite(totalLocs) || totalLocs <= 0 || totalPages <= 1) return 1;
      const idx = clampNum(locIdx0, 0, Math.max(0, totalLocs - 1));
      const ratio = totalLocs > 1 ? idx / (totalLocs - 1) : 0;
      return clampNum(Math.round(ratio * (totalPages - 1)) + 1, 1, totalPages);
    },
    [clampNum]
  );

  const computeChapterLeft = useCallback((displayedPage: unknown, displayedTotal: unknown): number | null => {
    if (typeof displayedTotal !== 'number' || !Number.isFinite(displayedTotal) || displayedTotal <= 0) return null;
    if (typeof displayedPage !== 'number' || !Number.isFinite(displayedPage)) return null;
    const page = clampNum(Math.round(displayedPage), 1, Math.round(displayedTotal));
    const total = Math.max(1, Math.round(displayedTotal));
    const left = Math.round(((total - page) / total) * 100);
    return clampNum(left, 0, 100);
  }, [clampNum]);
  
  // Get reader navigation methods
  const {
    goNext,
    goPrevious,
    goToLocation,
    getCurrentLocation,
    getLocations,
    currentLocation,
    totalLocations,
    progress: readerProgress,
    atStart,
    atEnd,
    locations,
    toc,
    addAnnotation,
    removeAnnotationByCfi,
    injectJavascript,
  } = useReader();
  const panRef = useRef(null);

  useEffect(() => {
    const locArray: string[] = Array.isArray(locationCfis) ? locationCfis : [];
    const map = new Map<string, number>();
    locArray.forEach((cfi, i) => {
      map.set(cfi, i);
    });
    cfiToIndexRef.current = map;
  }, [locationCfis]);
  
  // Track when selection just happened to prevent immediate clearing
  const selectionJustMade = useRef(false);
  const lastSelectionSource = useRef<'epubjs' | 'fallback' | null>(null);
  const tapNavJustMade = useRef(false);
  const lastSavedCfi = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pendingRemoteCfiRef = useRef<string | null>(null);

  useEffect(() => {
    logger.info('🔵 ReaderScreen mounted', { bookId, localPath });
    
    // Verify file exists
    const verifyFile = async () => {
      try {
        const info = await FileSystem.getInfoAsync(localPath);
        logger.info('File info:', info);
        if (!info.exists) {
          logger.error('❌ File does not exist at path:', localPath);
          Alert.alert('Error', 'Book file not found');
        }
      } catch (error) {
        logger.error('Failed to verify file:', error);
      }
    };
    
    verifyFile();
    loadBookData();
  }, [bookId]);

  // Screen-size based starting guess for locations-per-page.
  useEffect(() => {
    const area = windowWidth * windowHeight;
    if (!Number.isFinite(area) || area <= 0) return;
    const baselineArea = 390 * 844; // iPhone 13-ish
    const baselineLocsPerPage = 42;
    const scale = area / baselineArea;
    const guess = baselineLocsPerPage * scale;
    avgLocsPerPageRef.current = Math.max(10, Math.min(120, guess));
  }, [windowHeight, windowWidth]);

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
        }
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
      navigation.setOptions({ title: bookData.title });
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
        removeAnnotationByCfi(h.cfi_range);
        addAnnotation('highlight', h.cfi_range, { id: h.id }, { color: colors.primary, opacity: 0.25 });
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
      Alert.alert('Selection Too Long', `Please select ${MAX_SELECTION_LENGTH} characters or less`);
      return;
    }

    // Use last touch position to estimate selection location
    let position: { x: number; y: number; width: number; height: number } | undefined;
    
    if (lastTouchPosition) {
      position = {
        x: lastTouchPosition.x - 50, // Center around touch point
        y: lastTouchPosition.y - 20,
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
  }, [lastTouchPosition]);

  const handleHighlight = useCallback(async () => {
    if (!selection || !user || !book) return;
    if (!selection.cfiRange) {
      logger.warn('Highlight requested without cfiRange (fallback selection)', {
        textPreview: selection.text.substring(0, 80),
      });
      Alert.alert('Highlight Unavailable', 'Please try selecting again (highlight anchor not detected).');
      return;
    }
    if (!highlightsEnabled) {
      Alert.alert('Highlights Unavailable', 'Please apply the DB migration to enable persistent highlights.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const newHighlight: UserBookHighlight = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        cfi_range: selection.cfiRange,
        selected_text: selection.text,
        created_at: now,
        color: 'mint',
      };

      // Apply immediately in the reader (best-effort)
      try {
        removeAnnotationByCfi?.(newHighlight.cfi_range);
        addAnnotation?.('highlight', newHighlight.cfi_range, { id: newHighlight.id }, { color: colors.primary, opacity: 0.25 });
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
    } catch (error) {
      logger.error('Failed to save highlight:', error);
      Alert.alert('Error', 'Failed to save highlight');
    }
  }, [addAnnotation, addUserBookHighlight, book, highlightsEnabled, isGuest, removeAnnotationByCfi, selection, upgradePrompt, user]);

  const handleJumpToHighlight = useCallback((cfiRange: string) => {
    if (!cfiRange) return;
    try {
      goToLocation?.(cfiRange);
    } catch (e) {}
    setNavVisible(false);
  }, [goToLocation]);

  const handleDeleteHighlight = useCallback(async (h: UserBookHighlight) => {
    if (!user || !book) return;
    Alert.alert('Delete Highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            removeAnnotationByCfi?.(h.cfi_range);
            setHighlights((prev) => prev.filter((x) => x.id !== h.id));
            await deleteUserBookHighlight(user.id, book.id, h.id);
          } catch (error) {
            logger.error('Failed to delete highlight:', error);
            Alert.alert('Error', 'Failed to delete highlight');
          }
        },
      },
    ]);
  }, [book, deleteUserBookHighlight, removeAnnotationByCfi, user]);

  const handleTranslate = useCallback(async () => {
    if (!selection || !book?.source_lang) return;

    setShowTranslateSheet(true);
    setTranslating(true);
    setTranslateError(null);
    setTranslation(null);

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
        setTranslation(`"${selection.text}" is already in ${targetLang.toUpperCase()}`);
      } else {
        setTranslation(response.translation);
      }
      
      // Log detected language for debugging
      if (response.detected_lang && response.detected_lang !== book.source_lang) {
        logger.info(`Language mismatch: book=${book.source_lang}, detected=${response.detected_lang}`);
      }
    } catch (error: any) {
      logger.error('Translation failed:', error);
      setTranslateError(error.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }, [selection, book, targetLang]);

  const handleSaveStudyWord = useCallback(async () => {
    if (!selection || !translation || !user || !book?.source_lang) return;
    if (!selectedListId) {
      Alert.alert('Select a List', 'Please choose a list to save this word to.');
      return;
    }

    try {
      await createStudyWord({
        user_id: user.id,
        book_id: book.id,
        list_id: selectedListId,
        source_lang: book.source_lang,
        target_lang: targetLang,
        term: selection.text,
        term_normalized: normalizeText(selection.text),
        translation,
        context_snippet: selection.context ?? null,
      });

      touchVocabList(selectedListId).catch(() => {});
      Alert.alert('Success', 'Added to study list');
      countAllStudyWords(user.id)
        .then((c) => {
          if (c >= 10) {
            upgradePrompt.requestShow(user.id, 'vocab_10', { isGuest }).catch(() => {});
          }
        })
        .catch(() => {});
      setShowTranslateSheet(false);
      setSelection(null);
    } catch (error) {
      logger.error('Failed to save study word:', error);
      Alert.alert('Error', 'Failed to save word');
    }
  }, [book, isGuest, selectedListId, selection, targetLang, translation, upgradePrompt, user]);

  const handleCloseToolbar = useCallback(() => {
    setSelection(null);
  }, []);

  const handleCloseSheet = useCallback(() => {
    logger.info('Closing TranslateSheet', { listPickerVisible });
    setShowTranslateSheet(false);
    setListPickerVisible(false);
    setSelection(null);
  }, [listPickerVisible]);

  const handleReaderWebViewMessage = useCallback((event: any) => {
    // This only receives NON-internal events from the epubjs webview template.
    // We use it as a "selection debug + fallback" bridge.
    try {
      const type = event?.type;
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
          position: lastTouchPosition
            ? {
                x: lastTouchPosition.x - 50,
                y: lastTouchPosition.y - 20,
                width: 100,
                height: 40,
              }
            : undefined,
          context: context || null,
        });
      } else if (selection.text === text && context) {
        // Enrich existing selection (e.g. epubjs onSelected fired) with context from the web layer.
        setSelection(prev => (prev ? { ...prev, context } : prev));
      }
    } catch (error) {
      logger.error('Failed handling onWebViewMessage', error);
    }
  }, [lastTouchPosition, selection]);

  // Memoize theme to prevent re-renders
  const readerTheme = useMemo(() => ({ 
    body: { 
      background: colors.background,
      overflow: 'hidden',
    } 
  }), []);

  // Inject JavaScript - SIMPLIFIED to just suppress menu, let library handle selection
  const injectedJavascript = useMemo(
    () => `
    (function() {
      console.log('🚀 LinguaLeaf JS injected!');

      function postToRN(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }
      
      // Just apply CSS to suppress menu - let epub.js handle selection detection
      function applyCSS(doc) {
        if (doc.__llCSS) return;
        
        const style = doc.createElement('style');
        style.textContent = \`
          * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          ::selection {
            background: rgba(180, 215, 255, 0.4) !important;
          }
        \`;
        (doc.head || doc.documentElement).appendChild(style);
        
        // Block context menu
        doc.addEventListener('contextmenu', e => {
          e.preventDefault();
          return false;
        }, { capture: true, passive: false });
        
        doc.__llCSS = true;
        console.log('✅ CSS applied to', doc.location?.href || 'document');
      }

      function attachSelectionDebug(doc) {
        if (doc.__llSelectionDebug) return;
        try {
          const handler = () => {
            try {
              const sel = doc.getSelection ? doc.getSelection() : null;
              const text = sel ? (sel.toString() || '').trim() : '';
              const href = doc.location?.href || null;

              // Emit "selection cleared" once when transitioning from non-empty -> empty
              if (!text) {
                if (doc.__llHadSelection) {
                  doc.__llHadSelection = false;
                  doc.__llLastSelectionText = '';
                  postToRN({
                    type: 'llSelectionCleared',
                    sourceHref: href,
                  });
                }
                return;
              }

              // De-dupe repeated events (selectionchange can spam)
              if (doc.__llLastSelectionText === text) return;
              doc.__llLastSelectionText = text;
              doc.__llHadSelection = true;

              let rect = null;
              let context = null;
              try {
                if (sel && sel.rangeCount > 0) {
                  const range = sel.getRangeAt(0);
                  const r = range.getBoundingClientRect();
                  rect = { x: r.x, y: r.y, width: r.width, height: r.height };

                  // Context: 1 word before + 1 word after, best-effort (works reliably for single text node selections)
                  try {
                    const sc = range.startContainer;
                    const ec = range.endContainer;
                    if (sc && ec && sc === ec && sc.nodeType === 3) {
                      const full = (sc.textContent || '');
                      const start = range.startOffset;
                      const end = range.endOffset;

                      const isWs = (ch) => ch === ' ' || ch === '\\n' || ch === '\\t' || ch === '\\r';

                      let left = start;
                      // Skip whitespace immediately before selection
                      while (left > 0 && isWs(full[left - 1])) left--;
                      // Consume one word before
                      while (left > 0 && !isWs(full[left - 1])) left--;
                      // Optional: also include any whitespace between word and selection
                      while (left > 0 && isWs(full[left - 1])) left--;
                      while (left > 0 && !isWs(full[left - 1])) left--;

                      let right = end;
                      // Skip whitespace immediately after selection
                      while (right < full.length && isWs(full[right])) right++;
                      // Consume one word after
                      while (right < full.length && !isWs(full[right])) right++;

                      const slice = full.slice(left, right).trim();
                      if (slice && slice !== text) context = slice;
                    }
                  } catch (e) {}
                }
              } catch (e) {}

              postToRN({
                type: 'llSelectionDebug',
                sourceHref: href,
                text: text.length > 400 ? text.slice(0, 400) : text,
                context,
                rect,
              });
            } catch (e) {}
          };

          doc.addEventListener('selectionchange', handler, { passive: true });
          doc.addEventListener('mouseup', handler, { passive: true });
          doc.addEventListener('touchend', handler, { passive: true });
          doc.__llHadSelection = false;
          doc.__llLastSelectionText = '';
          doc.__llSelectionDebug = true;
          console.log('✅ Selection debug attached to', doc.location?.href || 'document');
        } catch (e) {}
      }
      
      // Apply to main doc
      applyCSS(document);
      attachSelectionDebug(document);
      
      // Patch iframes
      function patchIframes() {
        document.querySelectorAll('iframe').forEach((iframe, i) => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && !doc.__llCSS) {
              applyCSS(doc);
              console.log('✅ Patched iframe', i);
            }
            if (doc && !doc.__llSelectionDebug) {
              attachSelectionDebug(doc);
            }
          } catch (e) {
            if (!iframe.__listener) {
              iframe.addEventListener('load', () => {
                try {
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    applyCSS(doc);
                    attachSelectionDebug(doc);
                  }
                } catch (e2) {}
              });
              iframe.__listener = true;
            }
          }
        });
      }
      
      patchIframes();
      new MutationObserver(patchIframes).observe(document.documentElement, { childList: true, subtree: true });
      
      let count = 0;
      const interval = setInterval(() => {
        patchIframes();
        if (++count > 100) clearInterval(interval);
      }, 100);
      
      console.log('✅ LinguaLeaf JS initialized');
    })();
    true;
  `,
    []
  );


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
    Alert.alert('Reader Error', 'Failed to display book');
  }, []);

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
    const nextTotal = typeof readyTotalLocations === 'number' ? readyTotalLocations : 0;
    const nextPage = typeof idx === 'number' ? idx + 1 : 1;
    const displayedPage = readyLocation?.start?.displayed?.page;
    const displayedTotal = readyLocation?.start?.displayed?.total;
    if (typeof readyTotalLocations === 'number' && Number.isFinite(readyTotalLocations)) {
      lastTotalLocsRef.current = readyTotalLocations;
    }
    {
      const p = normalizeProgress(readyProgress);
      if (p !== null) lastProgressRef.current = p;
    }

    logger.info('✅ Reader ready', {
      totalLocations: nextTotal,
      startLocationIndex: idx,
      progress: readyProgress,
      displayed: readyLocation?.start?.displayed,
    });

    setChapterLeftPct(computeChapterLeft(displayedPage, displayedTotal));

    // Global pages: estimate from totalLocations + screen-derived locs-per-page.
    if (nextTotal > 0) {
      const globalTotal = computeGlobalTotalPages();
      const locIdx0 = typeof idx === 'number' ? idx : 0;
      if (globalTotal) {
        const pageFromIdx = computeGlobalPageFromLocationIndex(locIdx0, nextTotal, globalTotal);
        setTotalPages(globalTotal);
        setCurrentPage(pageFromIdx);
        setPageLoading(false);
      }
    } else {
      setPageLoading(true);
    }
    setReaderReady(true);

    if (cfi) {
      // Save immediately on ready (covers cases where user opens and closes quickly)
      scheduleSaveReadingProgress(cfi);
    }
  }, [computeChapterLeft, computeGlobalPageFromLocationIndex, computeGlobalTotalPages, locationCfis.length, normalizeProgress, scheduleSaveReadingProgress]);

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
    const idx = loc?.start?.location;
    const cfi = loc?.start?.cfi;
    const nextTotal = typeof totalLocs === 'number' ? totalLocs : 0;
    const nextPage = typeof idx === 'number' ? idx + 1 : 1;
    const displayedPage = loc?.start?.displayed?.page;
    const displayedTotal = loc?.start?.displayed?.total;
    logger.info('Location displayed', { displayedPage, displayedTotal });
    {
      const p = normalizeProgress(progress);
      if (p !== null) lastProgressRef.current = p;
    }
    if (typeof totalLocs === 'number' && Number.isFinite(totalLocs)) {
      lastTotalLocsRef.current = totalLocs;
    }

    let pageForLog: number | null = null;

    setChapterLeftPct(computeChapterLeft(displayedPage, displayedTotal));

    const globalTotal = computeGlobalTotalPages();
    if (globalTotal) {
      const locIdx0 = typeof idx === 'number' ? idx : 0;
      const pageFromIdx = computeGlobalPageFromLocationIndex(locIdx0, nextTotal > 0 ? nextTotal : (lastTotalLocsRef.current ?? 0), globalTotal);
      setTotalPages(globalTotal);
      setCurrentPage(pageFromIdx);
      setPageLoading(false);
      pageForLog = pageFromIdx;
    } else {
      setPageLoading(true);
    }

    // Adapt locations-per-page estimate using consecutive displayed.page increments within same section.
    const sectionHref = (currentSection?.href ?? null) as string | null;
    if (
      typeof displayedPage === 'number' &&
      sectionHref &&
      lastSectionHrefRef.current === sectionHref &&
      typeof lastLocIdxRef.current === 'number' &&
      typeof lastDisplayedPageRef.current === 'number'
    ) {
      const nextLocIdx0 = typeof idx === 'number' ? idx : null;
      if (typeof nextLocIdx0 !== 'number') {
        // Can't learn without a numeric location index
        return;
      }
      const dLoc = nextLocIdx0 - lastLocIdxRef.current;
      const dPage = displayedPage - lastDisplayedPageRef.current;
      if (dLoc > 0 && dPage > 0) {
        const sample = dLoc / dPage;
        const next = avgLocsPerPageRef.current * 0.9 + sample * 0.1;
        avgLocsPerPageRef.current = Math.max(8, Math.min(200, next));
      }
    }
    if (typeof idx === 'number') lastLocIdxRef.current = idx;
    lastDisplayedPageRef.current = typeof displayedPage === 'number' ? displayedPage : null;
    lastSectionHrefRef.current = (currentSection?.href ?? null) as string | null;

    if (cfi) {
      scheduleSaveReadingProgress(cfi);
    }

    logger.debug('📄 Location changed', {
      page: pageForLog,
      total: nextTotal,
      startLocationIndex: idx,
      progress,
      sectionHref: currentSection?.href ?? null,
      displayed: loc?.start?.displayed,
    });
  }, [computeChapterLeft, computeGlobalPageFromLocationIndex, computeGlobalTotalPages, normalizeProgress, scheduleSaveReadingProgress]);

  // If onLocationChange doesn't fire reliably (some engine + gesture combos),
  // keep the global counter in sync via reader context.
  useEffect(() => {
    const total = computeGlobalTotalPages();
    if (!total) return;
    const idx = currentLocation?.start?.location;
    const totalLocs = typeof lastTotalLocsRef.current === 'number' ? lastTotalLocsRef.current : (locationCfis.length > 0 ? locationCfis.length : 0);
    const page = computeGlobalPageFromLocationIndex(typeof idx === 'number' ? idx : 0, totalLocs, total);
    setTotalPages(total);
    setCurrentPage(page);
    setPageLoading(false);
  }, [computeGlobalPageFromLocationIndex, computeGlobalTotalPages, currentLocation?.start?.location, locationCfis.length]);

  const handleLocationsReady = useCallback((epubKey: string, locs: string[]) => {
    logger.info('📍 Locations ready:', { epubKey, totalLocations: locs.length });
    setLocationCfis(locs);
    // Ensure we lock in a stable total page count once locations are ready.
    if (locs.length > 0 && (!globalTotalPagesRef.current || globalTotalPagesRef.current <= 0)) {
      const perPage = Math.max(8, Math.min(200, avgLocsPerPageRef.current));
      globalTotalPagesRef.current = Math.max(1, Math.round(locs.length / perPage));
    }
    const total = computeGlobalTotalPages();
    if (!total) return;
    const idx = currentLocation?.start?.location;
    const page = computeGlobalPageFromLocationIndex(typeof idx === 'number' ? idx : 0, locs.length, total);
    setTotalPages(total);
    setCurrentPage(page);
    setPageLoading(false);
  }, [computeGlobalPageFromLocationIndex, computeGlobalTotalPages, currentLocation?.start?.location]);

  const handlePanGesture = useCallback((event: any) => {
    const { state, translationX, velocityX, x, y } = event.nativeEvent;
    
    // Track touch position for selection positioning
    if (state === State.BEGAN || state === State.ACTIVE) {
      setLastTouchPosition({ x, y });
    }
    
    if (state === State.END) {
      // Swipe left (next page)
      if (translationX < -50 || velocityX < -500) {
        logger.info('👉 Swipe left - next page');
        if (goNext) {
          goNext();
        }
      }
      // Swipe right (previous page)
      else if (translationX > 50 || velocityX > 500) {
        logger.info('👈 Swipe right - previous page');
        if (goPrevious) {
          goPrevious();
        }
      }
    }
  }, [goNext, goPrevious]);

  const handleTapLeftEdge = useCallback(() => {
    if (selection || showTranslateSheet || selectionJustMade.current) {
      logger.debug('Tap left edge ignored (selection active)', {
        selection: Boolean(selection),
        showTranslateSheet,
      });
      return;
    }
    if (navVisible) {
      logger.debug('Tap left edge ignored (nav open)');
      return;
    }

    tapNavJustMade.current = true;
    setTimeout(() => {
      tapNavJustMade.current = false;
    }, 300);

    logger.info('👈 Tap left edge - previous page', { hasGoPrevious: Boolean(goPrevious), atStart: Boolean(atStart) });
    if (!goPrevious) return;
    goPrevious();
    setTimeout(() => {
      try {
        const next = getCurrentLocation ? getCurrentLocation() : null;
        if (next && typeof (next as any).then === 'function') {
          (next as unknown as Promise<Location>).then((l: Location) =>
            logger.debug('After goPrevious: currentLocation', { cfi: l?.start?.cfi ?? null })
          );
        } else if (next) {
          const l = next as Location;
          logger.debug('After goPrevious: currentLocation', { cfi: l?.start?.cfi ?? null });
        }
      } catch {
        // ignore
      }
    }, 150);
  }, [goPrevious, navVisible, selection, showTranslateSheet]);

  const handleTapRightEdge = useCallback(() => {
    if (selection || showTranslateSheet || selectionJustMade.current) {
      logger.debug('Tap right edge ignored (selection active)', {
        selection: Boolean(selection),
        showTranslateSheet,
      });
      return;
    }
    if (navVisible) {
      logger.debug('Tap right edge ignored (nav open)');
      return;
    }

    tapNavJustMade.current = true;
    setTimeout(() => {
      tapNavJustMade.current = false;
    }, 300);

    logger.info('👉 Tap right edge - next page', { hasGoNext: Boolean(goNext), atEnd: Boolean(atEnd) });
    if (!goNext) return;
    goNext();
    setTimeout(() => {
      try {
        const next = getCurrentLocation ? getCurrentLocation() : null;
        if (next && typeof (next as any).then === 'function') {
          (next as unknown as Promise<Location>).then((l: Location) =>
            logger.debug('After goNext: currentLocation', { cfi: l?.start?.cfi ?? null })
          );
        } else if (next) {
          const l = next as Location;
          logger.debug('After goNext: currentLocation', { cfi: l?.start?.cfi ?? null });
        }
      } catch {
        // ignore
      }
    }, 150);
  }, [goNext, navVisible, selection, showTranslateSheet]);

  useEffect(() => {
    // Fallback: keep chapter-left percent in sync from reader context.
    const displayedPage = currentLocation?.start?.displayed?.page;
    const displayedTotal = currentLocation?.start?.displayed?.total;
    setChapterLeftPct(computeChapterLeft(displayedPage, displayedTotal));
  }, [computeChapterLeft, currentLocation?.start?.displayed?.page, currentLocation?.start?.displayed?.total]);

  useEffect(() => {
    if (!readerReady) return;
    const pending = pendingRemoteCfiRef.current;
    if (!pending) return;
    pendingRemoteCfiRef.current = null;
    goToLocation(pending);
  }, [goToLocation, readerReady]);

  if (!book) {
    return <View style={styles.container} />;
  }

  // Ensure we've checked local resume state before mounting the Reader.
  if (!progressLoaded) {
    return <View style={styles.container} />;
  }

  const tocItems = (() => {
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
  })();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <PanGestureHandler
          ref={panRef}
          onHandlerStateChange={handlePanGesture}
          activeOffsetX={[-30, 30]}
          failOffsetY={[-20, 20]}
          shouldCancelWhenOutside={false}
          maxPointers={1}
        >
          <View style={styles.readerWrapper}>
            <Reader
              src={localPath}
              fileSystem={useFileSystem}
              defaultTheme={readerTheme}
              injectedJavascript={injectedJavascript}
              manager="default"
              flow="paginated"
              snap={true}
              enableSwipe={false}
              enableSelection={true}
              allowPopups={false}
              allowScriptedContent={true}
              initialLocation={initialLocation}
              menuItems={[]}
              onSelected={handleReaderSelected}
              onStarted={handleReaderStarted}
              onReady={handleReaderReady}
              onRendered={handleReaderRendered}
              onDisplayError={handleReaderError}
              onPress={handleReaderPress}
              onSingleTap={handleReaderSingleTap}
              onLongPress={handleReaderLongPress}
              onLocationChange={handleLocationChange}
              onLocationsReady={handleLocationsReady}
              onWebViewMessage={handleReaderWebViewMessage}
            />

            <ReaderEdgeTapOverlay onTapLeft={handleTapLeftEdge} onTapRight={handleTapRightEdge} />
          </View>
        </PanGestureHandler>

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
            onSave={handleSaveStudyWord}
            onClose={handleCloseSheet}
          />

          <BookNavigationSheet
            visible={navVisible}
            initialTab={navInitialTab}
            currentIndex={Math.max(0, currentPage - 1)}
            total={totalPages}
            tocItems={tocItems}
            onClose={() => setNavVisible(false)}
            onGoToIndex={(idx) => {
              let locs = Array.isArray(locationCfis) ? locationCfis : [];
              if (locs.length === 0) {
                const fromCtx = getLocations?.();
                if (Array.isArray(fromCtx) && fromCtx.length > 0) {
                  locs = fromCtx as string[];
                  setLocationCfis(locs);
                }
              }
              if (locs.length === 0) {
                logger.info('Navigate: locations not ready yet - cannot go to page', { idx, totalPages });
                Alert.alert('Pages still loading', 'Please try again in a moment.');
                return;
              }

              const perPage = Math.max(8, Math.min(200, avgLocsPerPageRef.current));
              const mapped = Math.round(idx * perPage);
              const clamped = Math.max(0, Math.min(mapped, locs.length - 1));
              const cfi = locs[clamped];

              logger.info('Navigate: go to page', {
                pageIndex0: idx,
                totalPages,
                perPage,
                mappedLocIndex: clamped,
                cfiPreview: typeof cfi === 'string' ? cfi.slice(0, 32) : null,
              });

              try {
                goToLocation(cfi);
              } catch (e) {
                logger.error('Navigate: goToLocation failed', e);
              }
            }}
            onGoToHref={(href) => {
              const raw = typeof href === 'string' ? href : '';
              const noHash = raw.split('#')[0] ?? raw;
              const trimmed = raw.trim();
              const candidates = Array.from(
                new Set(
                  [trimmed, noHash, trimmed.startsWith('/') ? trimmed.slice(1) : trimmed, noHash.startsWith('/') ? noHash.slice(1) : noHash]
                    .filter((x) => typeof x === 'string' && x.length > 0)
                )
              );

              logger.info('Navigate: go to chapter', {
                href: trimmed,
                candidates,
                currentHref: currentLocation?.start?.href ?? null,
              });

              // Try goToLocation first (epubjs rendition.display usually supports href strings even though typed as cfi)
              for (const c of candidates) {
                try {
                  goToLocation(c as any);
                  return;
                } catch (e) {
                  logger.warn('Navigate: goToLocation candidate failed', { candidate: c });
                }
              }

              // Last resort: inject a display() call into the webview template (best-effort).
              // The core template defines `book`, `rendition`, and `getCfiFromHref(book, href)` in JS scope.
              const safeHref = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              injectJavascript?.(
                `(function(){try{var href='${safeHref}';` +
                  `if(typeof getCfiFromHref==='function' && typeof book!=='undefined' && book){` +
                  `var cfi=getCfiFromHref(book, href); if(cfi){ rendition.display(cfi); return; }}` +
                  `if(typeof rendition!=='undefined' && rendition && rendition.display){ rendition.display(href); }` +
                  `}catch(e){}})();`
              );
            }}
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
      </View>
    </GestureHandlerRootView>
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

