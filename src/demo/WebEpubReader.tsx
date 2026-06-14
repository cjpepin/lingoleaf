/**
 * Browser EPUB renderer using epubjs (web demo only).
 * Matches native ReaderScreen: edge taps, center-tap nav, selection toolbar, highlights.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import ePub from 'epubjs';
import type Book from 'epubjs/types/book';

type EpubRendition = ReturnType<Book['renderTo']>;
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { loadEpubSourceForWeb } from '@/demo/demoApi';
import {
  WEB_READER_INJECTED_JAVASCRIPT,
  type WebReaderBridgeMessage,
} from '@/demo/webReaderInject';
import { ReaderEdgeTapOverlay } from '@/components/ReaderEdgeTapOverlay';
import { ReaderOverlays } from '@/components/ReaderOverlays';
import { ReaderNavigationOverlay } from '@/components/ReaderNavigationOverlay';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { TranslateSheet } from '@/components/TranslateSheet';
import { HighlightActionPopup, type HighlightColor } from '@/components/HighlightActionPopup';
import { Snackbar } from '@/components/Snackbar';
import {
  addUserBookHighlight,
  createStudyWord,
  deleteUserBookHighlight,
  fetchMostRecentVocabList,
  fetchUserBook,
  fetchVocabLists,
  translateText,
  updateUserBookHighlightColor,
  updateUserBookHighlightTranslation,
} from '@/supabase/queries';
import type { UserBookHighlight, VocabList } from '@/supabase/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useStudyStore } from '@/state/useStudyStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { normalizeText, validateSelectionLength, MAX_SELECTION_LENGTH } from '@/utils/normalize';
import { useReaderSettingsStore } from '@/state/useReaderSettingsStore';

interface Props {
  src: string;
  title?: string;
  bookId?: string;
  sourceLang?: string;
  onBack?: () => void;
}

interface Selection {
  text: string;
  cfiRange: string;
  position?: { x: number; y: number; width: number; height: number };
  context?: string | null;
  committed?: boolean;
}

type ViewportBounds = { x: number; y: number; width: number; height: number };

function resolveViewportBoundsForCfi(
  cfiRange: string,
  hostEl: HTMLElement | null,
  rendition: EpubRendition | null,
): ViewportBounds | undefined {
  if (!hostEl || !rendition) return undefined;
  try {
    const range = rendition.getRange(cfiRange);
    if (!range) return undefined;
    const rect = range.getBoundingClientRect();
    const iframe = hostEl.querySelector('iframe');
    const iframeRect = iframe?.getBoundingClientRect();
    return {
      x: rect.x + (iframeRect?.left ?? 0),
      y: rect.y + (iframeRect?.top ?? 0),
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return undefined;
  }
}

function annotationHex(color: string): string {
  return color === 'yellow' ? colors.annotationYellow : color === 'pink' ? colors.annotationPink : colors.annotationMint;
}

export function WebEpubReader({ src, title, bookId, sourceLang = 'es', onBack }: Props) {
  const t = useTranslation();
  const rootRef = useRef<View | null>(null);
  const hostRef = useRef<View | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const pendingCenterTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHighlightTapAt = useRef(0);
  const selectionJustMade = useRef(false);
  const tapNavJustMade = useRef(false);
  const navProgress = useRef(new Animated.Value(0)).current;

  const user = useAuthStore((state) => state.user);
  const targetLang = useSettingsStore((state) => state.targetLang);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [navigationMode, setNavigationMode] = useState(false);
  const [highlights, setHighlights] = useState<UserBookHighlight[]>([]);
  const [tocItems, setTocItems] = useState<Array<{ label: string; href: string }>>([]);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showTranslateSheet, setShowTranslateSheet] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [vocabLists, setVocabLists] = useState<VocabList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<
    (UserBookHighlight & { bounds?: { x: number; y: number; width: number; height: number } }) | null
  >(null);
  const [highlightTranslating, setHighlightTranslating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  const anchorPopupsToViewport = Platform.OS === 'web';
  const popupReaderOffset = useMemo(() => ({ x: 0, y: 0 }), []);

  const gesturesEnabled = !navigationMode && !selection && !showTranslateSheet && !loading && !error;

  const turn = useCallback((direction: 'prev' | 'next') => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    tapNavJustMade.current = true;
    setTimeout(() => {
      tapNavJustMade.current = false;
    }, 250);
    setPageLoading(false);
    void (direction === 'prev' ? rendition.prev() : rendition.next());
  }, []);

  const applyHighlightsToRendition = useCallback((items: UserBookHighlight[]) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    items.forEach((h) => {
      if (!h.cfi_range || h.cfi_range.startsWith('demo-')) return;
      try {
        rendition.annotations.remove(h.cfi_range, 'highlight');
        rendition.annotations.highlight(
          h.cfi_range,
          { id: h.id },
          () => {},
          h.id,
          { fill: annotationHex(h.color), 'fill-opacity': '0.4' },
        );
      } catch (err) {
        logger.warn('Failed to apply highlight annotation', err);
      }
    });
  }, []);

  const toggleNavigationMode = useCallback(() => {
    if (navigationMode) {
      Animated.spring(navProgress, { toValue: 0, useNativeDriver: false, tension: 65, friction: 10 }).start(() => {
        setNavigationMode(false);
      });
      return;
    }
    setNavigationMode(true);
    requestAnimationFrame(() => {
      Animated.spring(navProgress, { toValue: 1, useNativeDriver: false, tension: 72, friction: 12 }).start();
    });
  }, [navProgress, navigationMode]);

  const handleBridgeMessage = useCallback(
    (message: WebReaderBridgeMessage) => {
      if (message.type === 'llSwipe') {
        if (selection || showTranslateSheet || selectionJustMade.current) return;
        if (navigationMode) return;
        if (message.direction === 'prev') turn('prev');
        if (message.direction === 'next') turn('next');
        return;
      }

      if (message.type === 'llCenterTap') {
        if (pendingCenterTapRef.current) clearTimeout(pendingCenterTapRef.current);
        pendingCenterTapRef.current = setTimeout(() => {
          pendingCenterTapRef.current = null;
          if (Date.now() - lastHighlightTapAt.current < 400) return;
          if (!selection && !showTranslateSheet) toggleNavigationMode();
        }, 80);
        return;
      }

      if (message.type === 'llSelectionCleared') {
        if (selectionJustMade.current) return;
        setSelection(null);
        setShowTranslateSheet(false);
        setTranslation(null);
        setTranslateError(null);
        setTranslating(false);
        return;
      }

      if (message.type === 'llSelectionCommitted') {
        // Web reader uses epubjs "selected" for CFI + viewport bounds; injected commits race and misplace popups.
        return;
      }

      if (message.type === 'llHighlightClicked') {
        if (pendingCenterTapRef.current) {
          clearTimeout(pendingCenterTapRef.current);
          pendingCenterTapRef.current = null;
        }
        lastHighlightTapAt.current = Date.now();
        const highlight = highlights.find((h) => h.id === message.highlightId || h.cfi_range === message.cfi);
        if (highlight) {
          const hostEl = hostRef.current as unknown as HTMLElement | null;
          const boundsFromCfi = message.cfi
            ? resolveViewportBoundsForCfi(message.cfi, hostEl, renditionRef.current)
            : undefined;
          setActiveHighlight({
            ...highlight,
            bounds: boundsFromCfi ?? message.rect,
          });
        }
      }
    },
    [highlights, navigationMode, selection, showTranslateSheet, toggleNavigationMode, turn],
  );

  useEffect(() => {
    const onMessage = (message: WebReaderBridgeMessage) => {
      handleBridgeMessage(message);
    };
    window.__llWebReaderOnMessage = onMessage;
    const onCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<WebReaderBridgeMessage>).detail;
      if (detail) onMessage(detail);
    };
    window.addEventListener('ll-web-reader-message', onCustomEvent);
    return () => {
      delete window.__llWebReaderOnMessage;
      window.removeEventListener('ll-web-reader-message', onCustomEvent);
    };
  }, [handleBridgeMessage]);

  useEffect(() => {
    if (!gesturesEnabled) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        turn('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        turn('next');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gesturesEnabled, turn]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const lists = await fetchVocabLists(user.id);
        setVocabLists(lists);
        const recent = await fetchMostRecentVocabList(user.id);
        if (recent?.id) setSelectedListId(recent.id);
        else if (lists[0]?.id) setSelectedListId(lists[0].id);
      } catch (err) {
        logger.warn('Failed to load vocab lists for web reader', err);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    let disposed = false;
    let book: Book | null = null;

    async function mountReader(): Promise<void> {
      const node = hostRef.current as unknown as HTMLElement | null;
      if (!node) return;

      try {
        setLoading(true);
        setError(null);
        const bookSource = await loadEpubSourceForWeb(src);
        book = ePub(bookSource);
        bookRef.current = book;

        const navigation = await book.loaded.navigation;
        const toc: Array<{ label: string; href: string }> = [];
        const walk = (items: Array<{ label?: string; href?: string; subitems?: unknown[] }>) => {
          items.forEach((item) => {
            if (item.href) toc.push({ label: item.label ?? '', href: item.href });
            if (Array.isArray(item.subitems)) walk(item.subitems as Array<{ label?: string; href?: string; subitems?: unknown[] }>);
          });
        };
        walk(navigation.toc ?? []);
        if (!disposed) setTocItems(toc);

        const rendition = book.renderTo(node, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          manager: 'default',
          spread: 'none',
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        const injectReaderGestures = (doc: Document): void => {
          try {
            const frame = doc.defaultView?.frameElement as HTMLIFrameElement | null;
            if (frame) {
              const sandbox = frame.getAttribute('sandbox') ?? '';
              if (!sandbox.includes('allow-scripts')) {
                frame.setAttribute('sandbox', `${sandbox} allow-scripts`.trim());
              }
            }
          } catch (err) {
            logger.warn('Failed to patch reader iframe sandbox', err);
          }
          const markedDoc = doc as Document & { __llInjected?: boolean };
          if (markedDoc.__llInjected) return;
          const script = doc.createElement('script');
          script.textContent = WEB_READER_INJECTED_JAVASCRIPT;
          doc.head.appendChild(script);
          markedDoc.__llInjected = true;
        };

        rendition.hooks.content.register((contents: { document: Document }) => {
          injectReaderGestures(contents.document);
        });

        rendition.on('relocated', (location: {
          start?: { displayed?: { page?: number; total?: number }; href?: string };
        }) => {
          const page = location.start?.displayed?.page;
          const total = location.start?.displayed?.total;
          if (page && total) {
            setCurrentPage(page);
            setTotalPages(total);
            setPageLoading(false);
          }
          const href = location.start?.href;
          if (href) {
            const chapter = toc.find((c) => c.href === href || href.endsWith(c.href));
            setCurrentChapter(chapter?.label ?? null);
          }
        });

        rendition.on('selected', (cfiRange: string) => {
          try {
            const range = rendition.getRange(cfiRange);
            const text = range?.toString()?.trim() ?? '';
            if (!text || !range) return;
            const rect = range.getBoundingClientRect();
            const iframe = node.querySelector('iframe');
            const iframeRect = iframe?.getBoundingClientRect();
            const ox = iframeRect?.left ?? 0;
            const oy = iframeRect?.top ?? 0;
            setSelection({
              text,
              cfiRange,
              position: { x: rect.x + ox, y: rect.y + oy, width: rect.width, height: rect.height },
              committed: true,
            });
            selectionJustMade.current = true;
            setTimeout(() => {
              selectionJustMade.current = false;
            }, 300);
          } catch (err) {
            logger.warn('Failed to resolve selection bounds', err);
          }
        });

        rendition.on('markClicked', (cfiRange: string, data: { id?: string }) => {
          if (pendingCenterTapRef.current) {
            clearTimeout(pendingCenterTapRef.current);
            pendingCenterTapRef.current = null;
          }
          lastHighlightTapAt.current = Date.now();
          const bounds = resolveViewportBoundsForCfi(cfiRange, node, rendition);
          const highlight = highlightsRef.current.find(
            (h) => h.id === data?.id || h.cfi_range === cfiRange,
          );
          if (highlight) {
            setActiveHighlight({ ...highlight, bounds });
          }
        });

        await rendition.display();

        if (bookId && user?.id) {
          const userBook = await fetchUserBook(user.id, bookId);
          const saved = Array.isArray(userBook?.highlights) ? userBook.highlights : [];
          if (!disposed) {
            setHighlights(saved);
            applyHighlightsToRendition(saved);
          }
        }

        try {
          await book.locations.generate(1024);
        } catch (err) {
          logger.warn('Failed to generate locations', err);
        }

        if (!disposed) setLoading(false);
      } catch (err) {
        logger.error('Web EPUB reader failed', err);
        if (!disposed) {
          const message =
            err instanceof Error && err.message.includes('Demo EPUB')
              ? err.message
              : 'Could not load this book in the web demo.';
          setError(message);
          setLoading(false);
        }
      }
    }

    void mountReader();

    return () => {
      disposed = true;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      void book?.destroy();
      bookRef.current = null;
    };
  }, [applyHighlightsToRendition, bookId, src, user?.id]);

  useEffect(() => {
    applyHighlightsToRendition(highlights);
  }, [applyHighlightsToRendition, highlights]);

  const handleHighlight = useCallback(async () => {
    if (!selection?.text || !user?.id || !bookId) return;
    if (!selection.cfiRange) {
      Alert.alert(t('reader.highlightUnavailableTitle'), t('reader.highlightUnavailable'));
      return;
    }
    const highlightColor = useReaderSettingsStore.getState().highlightColor;
    const translated = translation ?? null;
    const newHighlight: UserBookHighlight = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cfi_range: selection.cfiRange || `demo-${Date.now()}`,
      selected_text: selection.text,
      created_at: new Date().toISOString(),
      color: highlightColor,
      translation: translated ?? undefined,
      page: currentPage > 0 ? currentPage : undefined,
    };

    try {
      if (selection.cfiRange && renditionRef.current) {
        renditionRef.current.annotations.highlight(
          selection.cfiRange,
          { id: newHighlight.id },
          () => {},
          newHighlight.id,
          { fill: annotationHex(highlightColor), 'fill-opacity': '0.4' },
        );
      }
      setHighlights((prev) => [...prev, newHighlight]);
      await addUserBookHighlight(user.id, bookId, newHighlight);
      setSelection(null);
    } catch (err) {
      logger.error('Failed to save highlight', err);
      Alert.alert(t('common.error'), t('reader.failedToSaveHighlight'));
    }
  }, [bookId, currentPage, selection, t, translation, user?.id]);

  const handleTranslate = useCallback(async () => {
    if (!selection?.text) return;
    if (!validateSelectionLength(selection.text, MAX_SELECTION_LENGTH)) {
      Alert.alert(t('reader.selectionTooLongTitle'), t('reader.selectionTooLong', { max: MAX_SELECTION_LENGTH }));
      return;
    }
    setShowTranslateSheet(true);
    setTranslating(true);
    setTranslateError(null);
    setTranslation(null);
    try {
      const response = await translateText({
        source_lang: sourceLang,
        target_lang: targetLang,
        text: selection.text,
        context: selection.context ?? undefined,
        neutralize_pronouns: true,
      });
      setTranslation(response.same_language ? selection.text : response.translation);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : t('msg.translationFailed'));
    } finally {
      setTranslating(false);
    }
  }, [selection, sourceLang, targetLang, t]);

  const handleSaveStudyWord = useCallback(async () => {
    if (!selection?.text || !translation || !user?.id || !bookId || !selectedListId) {
      setSnackbar({ visible: true, message: t('msg.chooseList'), type: 'error' });
      return;
    }
    try {
      const newWord = await createStudyWord({
        user_id: user.id,
        book_id: bookId,
        list_id: selectedListId,
        source_lang: sourceLang,
        target_lang: targetLang,
        term: selection.text,
        term_normalized: normalizeText(selection.text),
        translation,
        context_snippet: selection.context ?? null,
      });

      useStudyStore.getState().upsertWordInCache(selectedListId, newWord);

      if (selection.cfiRange) {
        const highlightColor = useReaderSettingsStore.getState().highlightColor;
        const newHighlight: UserBookHighlight = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          cfi_range: selection.cfiRange,
          selected_text: selection.text,
          created_at: new Date().toISOString(),
          color: highlightColor,
          translation,
          page: currentPage > 0 ? currentPage : undefined,
        };
        renditionRef.current?.annotations.highlight(
          selection.cfiRange,
          { id: newHighlight.id },
          () => {},
          newHighlight.id,
          { fill: annotationHex(highlightColor), 'fill-opacity': '0.4' },
        );
        setHighlights((prev) => [...prev, newHighlight]);
        await addUserBookHighlight(user.id, bookId, newHighlight);
      }

      setShowTranslateSheet(false);
      setSelection(null);
      setSnackbar({ visible: true, message: t('msg.addedToList'), type: 'success' });
    } catch (err) {
      logger.error('Failed to save study word', err);
      setSnackbar({ visible: true, message: t('common.error'), type: 'error' });
    }
  }, [bookId, currentPage, selectedListId, selection, sourceLang, t, targetLang, translation, user?.id]);

  const handleTranslateFromPopup = useCallback(async () => {
    if (!activeHighlight || !user?.id || !bookId) return;
    setHighlightTranslating(true);
    try {
      const response = await translateText({
        source_lang: sourceLang,
        target_lang: targetLang,
        text: activeHighlight.selected_text,
        neutralize_pronouns: true,
      });
      const newTranslation = response.same_language ? activeHighlight.selected_text : response.translation;
      await updateUserBookHighlightTranslation(user.id, bookId, activeHighlight.id, newTranslation);
      setHighlights((prev) =>
        prev.map((h) => (h.id === activeHighlight.id ? { ...h, translation: newTranslation } : h)),
      );
      setActiveHighlight((prev) => (prev?.id === activeHighlight.id ? { ...prev, translation: newTranslation } : null));
    } catch (err) {
      logger.error('Failed to translate highlight', err);
      setSnackbar({ visible: true, message: t('msg.translationFailed'), type: 'error' });
    } finally {
      setHighlightTranslating(false);
    }
  }, [activeHighlight, bookId, sourceLang, targetLang, t, user?.id]);

  const handleGoToPage = useCallback((page: number) => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition || page < 1) return;
    try {
      const cfi = book.locations.cfiFromLocation(page - 1);
      if (cfi) void rendition.display(cfi);
    } catch (err) {
      logger.warn('Failed to go to page', err);
    }
  }, []);

  const handleGoToHref = useCallback((href: string) => {
    const rendition = renditionRef.current;
    if (!rendition || !href) return;
    void rendition.display(href);
  }, []);

  const handleDeleteHighlight = useCallback(
    async (h: UserBookHighlight) => {
      if (!user?.id || !bookId) return;
      try {
        renditionRef.current?.annotations.remove(h.cfi_range, 'highlight');
        setHighlights((prev) => prev.filter((x) => x.id !== h.id));
        await deleteUserBookHighlight(user.id, bookId, h.id);
        setActiveHighlight(null);
      } catch (err) {
        logger.error('Failed to delete highlight', err);
        setSnackbar({ visible: true, message: t('reader.failedToDeleteHighlight'), type: 'error' });
      }
    },
    [bookId, t, user?.id],
  );

  const handleChangeHighlightColor = useCallback(
    async (h: UserBookHighlight, newColor: HighlightColor) => {
      if (!user?.id || !bookId) return;
      try {
        renditionRef.current?.annotations.remove(h.cfi_range, 'highlight');
        renditionRef.current?.annotations.highlight(
          h.cfi_range,
          { id: h.id },
          () => {},
          h.id,
          { fill: annotationHex(newColor), 'fill-opacity': '0.4' },
        );
        setHighlights((prev) => prev.map((x) => (x.id === h.id ? { ...x, color: newColor } : x)));
        setActiveHighlight((prev) => (prev?.id === h.id ? { ...prev, color: newColor } : null));
        await updateUserBookHighlightColor(user.id, bookId, h.id, newColor);
      } catch (err) {
        logger.error('Failed to update highlight color', err);
      }
    },
    [bookId, user?.id],
  );

  const panelTranslateY = navProgress.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const panelOpacity = navProgress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.7, 1] });
  const dimOpacity = navProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });
  const readerScale = navProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const readerTranslateY = navProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });

  const accessibleLists = useMemo(() => vocabLists, [vocabLists]);

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={styles.headerBar}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.headerIconBtn}>
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? ''}
        </Text>
        <View style={styles.headerIconBtn} />
      </View>

      <Animated.View
        style={[
          styles.readerWrapper,
          { transform: [{ scale: readerScale }, { translateY: readerTranslateY }] },
        ]}
        pointerEvents={navigationMode ? 'none' : 'auto'}
      >
        <ReaderEdgeTapOverlay
          onTapLeft={() => {
            if (selection || showTranslateSheet || selectionJustMade.current || navigationMode) return;
            turn('prev');
          }}
          onTapRight={() => {
            if (selection || showTranslateSheet || selectionJustMade.current || navigationMode) return;
            turn('next');
          }}
        >
          <View style={styles.readerHostWrap}>
            <View style={styles.readerHost} ref={hostRef} />
          </View>
        </ReaderEdgeTapOverlay>

        {!navigationMode && (
          <ReaderOverlays currentPage={currentPage} totalPages={totalPages} pageLoading={pageLoading} />
        )}

        {gesturesEnabled ? (
          <View style={styles.gestureLayer} pointerEvents="box-none">
            <Pressable
              style={styles.gestureEdgeLeft}
              onPress={() => {
                if (selectionJustMade.current) return;
                turn('prev');
              }}
            />
            <View style={styles.gestureCenter} pointerEvents="none" />
            <Pressable
              style={styles.gestureEdgeRight}
              onPress={() => {
                if (selectionJustMade.current) return;
                turn('next');
              }}
            />
          </View>
        ) : null}
      </Animated.View>

      {selection?.committed && !showTranslateSheet && (
        <SelectionToolbar
          onHighlight={() => void handleHighlight()}
          onTranslate={() => void handleTranslate()}
          selectionBounds={selection.position}
          readerOffset={popupReaderOffset}
          anchorToViewport={anchorPopupsToViewport}
        />
      )}

      <TranslateSheet
        visible={showTranslateSheet}
        term={selection?.text || ''}
        translation={translation}
        loading={translating}
        error={translateError}
        selectedListName={accessibleLists.find((l) => l.id === selectedListId)?.name ?? null}
        onSelectList={() => setListPickerVisible(true)}
        listPickerVisible={listPickerVisible}
        lists={accessibleLists}
        selectedListId={selectedListId}
        onPickList={(id) => {
          setSelectedListId(id);
          setListPickerVisible(false);
        }}
        onCloseListPicker={() => setListPickerVisible(false)}
        onSave={() => void handleSaveStudyWord()}
        onClose={() => {
          setShowTranslateSheet(false);
          setSelection(null);
        }}
      />

      {navigationMode && (
        <>
          <Animated.View style={[styles.navDimOverlay, { opacity: dimOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleNavigationMode} />
          </Animated.View>
          <Animated.View
            style={[
              styles.navPanel,
              { opacity: panelOpacity, transform: [{ translateY: panelTranslateY }] },
            ]}
          >
            <ReaderNavigationOverlay
              currentPage={currentPage}
              totalPages={totalPages}
              currentChapter={currentChapter}
              tocItems={tocItems}
              highlights={highlights}
              canGoBack={false}
              onGoToPage={handleGoToPage}
              onGoToHref={handleGoToHref}
              onGoBack={() => {}}
              onJumpToHighlight={(cfi) => {
                if (cfi) void renditionRef.current?.display(cfi);
                toggleNavigationMode();
              }}
              onDeleteHighlight={(h) => void handleDeleteHighlight(h)}
              onClose={toggleNavigationMode}
            />
          </Animated.View>
        </>
      )}

      <HighlightActionPopup
        visible={!!activeHighlight}
        currentColor={(activeHighlight?.color as HighlightColor) ?? 'mint'}
        highlightBounds={activeHighlight?.bounds}
        readerOffset={popupReaderOffset}
        anchorToViewport={anchorPopupsToViewport}
        selectedText={activeHighlight?.selected_text}
        translation={activeHighlight?.translation}
        translating={highlightTranslating}
        onTranslate={() => void handleTranslateFromPopup()}
        onSaveToVocab={() => {
          if (!activeHighlight) return;
          setSelection({
            text: activeHighlight.selected_text,
            cfiRange: activeHighlight.cfi_range,
            committed: true,
          });
          setTranslation(activeHighlight.translation ?? null);
          setShowTranslateSheet(true);
          setActiveHighlight(null);
        }}
        onChangeColor={(color) => {
          if (activeHighlight) void handleChangeHighlightColor(activeHighlight, color);
        }}
        onDelete={() => {
          if (activeHighlight) void handleDeleteHighlight(activeHighlight);
        }}
        onClose={() => setActiveHighlight(null)}
      />

      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
      />

      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconBtn: {
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
  readerWrapper: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  readerHostWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  readerHost: {
    ...StyleSheet.absoluteFillObject,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 8,
  },
  gestureEdgeLeft: {
    width: 56,
    alignSelf: 'stretch',
  },
  gestureCenter: {
    flex: 1,
    minWidth: 0,
  },
  gestureEdgeRight: {
    width: 56,
    alignSelf: 'stretch',
  },
  navDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  navPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    zIndex: 11,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    zIndex: 20,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
});
