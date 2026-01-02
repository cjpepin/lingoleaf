/**
 * ReaderScreen
 * EPUB reader with selection, highlight, and translation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
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
import { ReaderHighlightsModal } from '@/components/ReaderHighlightsModal';
import { useAuthStore } from '@/state/useAuthStore';
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
} from '@/supabase/queries';
import type { Book, VocabList, UserBookHighlight } from '@/supabase/types';
import { normalizeText, validateSelectionLength, MAX_SELECTION_LENGTH } from '@/utils/normalize';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';

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
  const { user } = useAuthStore();
  const { targetLang } = useSettingsStore();
  
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
  const [highlightsVisible, setHighlightsVisible] = useState(false);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [navVisible, setNavVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [locationCfis, setLocationCfis] = useState<string[]>([]);
  const [lastTouchPosition, setLastTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [initialLocation, setInitialLocation] = useState<string | undefined>(undefined);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [readingProgressEnabled, setReadingProgressEnabled] = useState(true);
  const [readerReady, setReaderReady] = useState(false);

  // Map CFIs to indices so we can have a stable "page number" based on onLocationsReady CFIs
  const cfiToIndexRef = useRef<Map<string, number>>(new Map());
  
  // Get reader navigation methods
  const {
    goNext,
    goPrevious,
    goToLocation,
    currentLocation,
    totalLocations,
    locations,
    toc,
    addAnnotation,
    removeAnnotationByCfi,
  } = useReader();
  const panRef = useRef(null);

  useEffect(() => {
    const locArray: string[] = Array.isArray(locationCfis) ? locationCfis : [];
    const map = new Map<string, number>();
    locArray.forEach((cfi, i) => {
      map.set(cfi, i);
    });
    cfiToIndexRef.current = map;

    if (locArray.length > 0) {
      setTotalPages(locArray.length);
    }
  }, [locationCfis]);
  
  // Track when selection just happened to prevent immediate clearing
  const selectionJustMade = useRef(false);
  const lastSelectionSource = useRef<'epubjs' | 'fallback' | null>(null);
  const tapNavJustMade = useRef(false);
  const lastSavedCfi = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadReadingProgress = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchUserBook(user.id, bookId);
      const lastCfi = data?.last_cfi ?? null;
      const savedHighlights = data?.highlights ?? [];
      logger.info('📌 Loaded reading progress', { bookId, hasProgress: Boolean(lastCfi) });
      if (lastCfi) setInitialLocation(lastCfi);
      if (highlightsEnabled) setHighlights(savedHighlights);
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
    } finally {
      setProgressLoaded(true);
    }
  }, [bookId, highlightsEnabled, user]);

  useEffect(() => {
    // Load progress when we have a user (RLS protected)
    if (user) {
      loadReadingProgress();
    }
  }, [loadReadingProgress, user]);

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
    if (!cfi || !user || !readingProgressEnabled) return;
    if (lastSavedCfi.current === cfi) return;

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
      if (cfi && user) {
        // Fire and forget
        void flushReadingProgress(cfi);
      }
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
      setSelection(null);
    } catch (error) {
      logger.error('Failed to save highlight:', error);
      Alert.alert('Error', 'Failed to save highlight');
    }
  }, [addAnnotation, addUserBookHighlight, book, highlightsEnabled, removeAnnotationByCfi, selection, user]);

  const handleJumpToHighlight = useCallback((cfiRange: string) => {
    if (!cfiRange) return;
    try {
      goToLocation?.(cfiRange);
    } catch (e) {}
    setHighlightsVisible(false);
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
      setShowTranslateSheet(false);
      setSelection(null);
    } catch (error) {
      logger.error('Failed to save study word:', error);
      Alert.alert('Error', 'Failed to save word');
    }
  }, [book, selectedListId, selection, targetLang, translation, user]);

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
    if (!selection && !showTranslateSheet && !highlightsVisible) {
      setNavVisible((prev) => !prev);
      logger.debug('Single tap - toggling navigation', { next: !navVisible });
      return;
    }

    // Otherwise clear selection when tapping
    logger.debug('Single tap', selection ? '- clearing selection' : '- no selection');
    setSelection(null);
    setShowTranslateSheet(false);
  }, [highlightsVisible, navVisible, selection, showTranslateSheet]);

  const handleReaderLongPress = useCallback(() => {
    logger.info('📱 Long press detected');
  }, []);

  const handleReaderReady = useCallback((readyTotalLocations: number, readyLocation: Location, readyProgress: number) => {
    const idx = readyLocation?.start?.location;
    const cfi = readyLocation?.start?.cfi;
    const nextTotal = typeof readyTotalLocations === 'number' ? readyTotalLocations : 0;
    const nextPage = typeof idx === 'number' ? idx + 1 : 1;

    logger.info('✅ Reader ready', {
      totalLocations: nextTotal,
      startLocationIndex: idx,
      progress: readyProgress,
      displayed: readyLocation?.start?.displayed,
    });

    // Prefer locations[]-based page numbers when available (matches Go To Page)
    const locIdx = cfi ? cfiToIndexRef.current.get(cfi) : undefined;
    if (typeof locIdx === 'number') {
      setCurrentPage(locIdx + 1);
    } else {
      if (nextTotal > 0 && totalPages === 0) setTotalPages(nextTotal);
      setCurrentPage(Math.max(1, nextPage));
    }
    setReaderReady(true);

    if (cfi) {
      // Save immediately on ready (covers cases where user opens and closes quickly)
      scheduleSaveReadingProgress(cfi);
    }
  }, [scheduleSaveReadingProgress, totalPages]);

  const handleLocationChange = useCallback((
    totalLocs: number,
    loc: Location,
    progress: number,
    currentSection: Section | null
  ) => {
    const idx = loc?.start?.location;
    const cfi = loc?.start?.cfi;
    const nextTotal = typeof totalLocs === 'number' ? totalLocs : 0;
    const nextPage = typeof idx === 'number' ? idx + 1 : 1;

    let pageForLog: number | null = null;

    // Prefer locations[]-based index so Navigate's "Go to page" matches the reader counter
    const locIdx = cfi ? cfiToIndexRef.current.get(cfi) : undefined;
    if (typeof locIdx === 'number') {
      pageForLog = locIdx + 1;
      setCurrentPage(pageForLog);
      if (locationCfis.length > 0) setTotalPages(locationCfis.length);
    } else {
      // Fallback when CFIs haven't been indexed yet
      if (nextTotal > 0 && totalPages === 0) setTotalPages(nextTotal);
      const clamped = nextTotal > 0 ? Math.max(1, Math.min(nextPage, nextTotal)) : Math.max(1, nextPage);
      pageForLog = clamped;
      setCurrentPage(clamped);
    }

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
  }, [locationCfis.length, scheduleSaveReadingProgress, totalPages]);

  const handleLocationsReady = useCallback((epubKey: string, locs: string[]) => {
    logger.info('📍 Locations ready:', { epubKey, totalLocations: locs.length });
    // Use actual locations array length as our canonical "page" count for Navigate + Go To Page
    if (locs.length > 0) setTotalPages(locs.length);
    setLocationCfis(locs);
    setCurrentPage(prev => Math.max(1, prev));
  }, []);

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

    logger.info('👈 Tap left edge - previous page');
    goPrevious?.();
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

    logger.info('👉 Tap right edge - next page');
    goNext?.();
  }, [goNext, navVisible, selection, showTranslateSheet]);

  // Update page from currentLocation
  useEffect(() => {
    // Fallback: if callbacks ever fail, keep counter in sync with reader context.
    const cfi = currentLocation?.start?.cfi;
    const locIdx = cfi ? cfiToIndexRef.current.get(cfi) : undefined;
    if (typeof locIdx === 'number') {
      setCurrentPage(locIdx + 1);
      if (locationCfis.length > 0) setTotalPages(locationCfis.length);
      return;
    }

    const idx = currentLocation?.start?.location;
    if (typeof idx === 'number') {
      const pageNum = idx + 1;
      if (totalLocations > 0 && totalPages === 0) setTotalPages(totalLocations);
      setCurrentPage(pageNum);
    }
  }, [currentLocation, locationCfis.length, totalLocations, totalPages]);

  if (!book) {
    return <View style={styles.container} />;
  }

  // Ensure we have a saved starting point before mounting the Reader.
  // Reader uses `initialLocation` during its onReady flow; changing it after mount can be unreliable.
  if (user && !progressLoaded) {
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
          highlightsCount={highlights.length}
          onPressHighlights={() => {
            if (!highlightsEnabled) {
              Alert.alert('Highlights Unavailable', 'Please apply the DB migration to enable persistent highlights.');
              return;
            }
            setHighlightsVisible(true);
          }}
          onPressNavigate={() => setNavVisible(true)}
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
            currentIndex={Math.max(0, currentPage - 1)}
            total={totalPages}
            tocItems={tocItems}
            onClose={() => setNavVisible(false)}
            onGoToIndex={(idx) => {
              if (locationCfis.length === 0) {
                logger.debug('Navigate: locations not ready yet - ignoring Go To Page');
                return;
              }
              const clamped = Math.max(0, Math.min(idx, locationCfis.length - 1));
              const cfi = locationCfis[clamped];
              goToLocation?.(cfi);
            }}
            onGoToHref={(href) => {
              goToLocation?.(href as any);
            }}
          />

          <ReaderHighlightsModal
            visible={highlightsVisible}
            highlights={highlights}
            onClose={() => setHighlightsVisible(false)}
            onJumpToCfiRange={(cfiRange) => handleJumpToHighlight(cfiRange)}
            onDelete={handleDeleteHighlight}
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

