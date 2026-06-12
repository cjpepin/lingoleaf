/**
 * Browser EPUB renderer using epubjs (web demo only).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import ePub from 'epubjs';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { isWebDemo } from '@/demo/config';
import { loadEpubSourceForWeb } from '@/demo/demoApi';
import {
  addUserBookHighlight,
  createStudyWord,
  translateText,
} from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';

interface Props {
  src: string;
  title?: string;
  bookId?: string;
  sourceLang?: string;
  targetLang?: string;
}

export function WebEpubReader({ src, title, bookId, sourceLang = 'es', targetLang = 'en' }: Props) {
  const hostRef = useRef<View | null>(null);
  const renditionRef = useRef<{ prev: () => Promise<void>; next: () => Promise<void>; destroy: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [selection, setSelection] = useState<string>('');
  const [translation, setTranslation] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let disposed = false;
    let book: ePub.Book | null = null;
    let selectionHandler: (() => void) | null = null;

    async function mountReader(): Promise<void> {
      const node = hostRef.current as unknown as HTMLElement | null;
      if (!node) return;

      try {
        setLoading(true);
        setError(null);
        const bookSource = await loadEpubSourceForWeb(src);
        book = ePub(bookSource);
        const rendition = book.renderTo(node, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          manager: 'default',
        });
        renditionRef.current = rendition;
        rendition.on('relocated', (location: { start?: { displayed?: { page?: number; total?: number } } }) => {
          const page = location.start?.displayed?.page;
          const total = location.start?.displayed?.total;
          if (page && total) setLocationLabel(`${page} / ${total}`);
        });
        await rendition.display();

        if (isWebDemo()) {
          selectionHandler = () => {
            const selected = window.getSelection()?.toString().trim() ?? '';
            setSelection(selected);
            setTranslation(null);
            setActionMessage(null);
          };
          document.addEventListener('selectionchange', selectionHandler);
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
      if (selectionHandler) {
        document.removeEventListener('selectionchange', selectionHandler);
      }
      renditionRef.current?.destroy();
      renditionRef.current = null;
      void book?.destroy();
    };
  }, [src]);

  const turn = (direction: 'prev' | 'next') => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    void (direction === 'prev' ? rendition.prev() : rendition.next());
  };

  const handleTranslate = async () => {
    if (!selection.trim()) return;
    setTranslating(true);
    setActionMessage(null);
    try {
      const response = await translateText({
        source_lang: sourceLang,
        target_lang: targetLang,
        text: selection.trim(),
      });
      setTranslation(response.translation);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSaveWord = async () => {
    if (!user?.id || !bookId || !selection.trim()) return;
    setActionMessage(null);
    try {
      const translated =
        translation ??
        (
          await translateText({
            source_lang: sourceLang,
            target_lang: targetLang,
            text: selection.trim(),
          })
        ).translation;

      await createStudyWord({
        user_id: user.id,
        book_id: bookId,
        list_id: null,
        source_lang: sourceLang,
        target_lang: targetLang,
        term: selection.trim(),
        term_normalized: selection.trim().toLowerCase(),
        translation: translated,
        context_snippet: selection.trim(),
      });

      await addUserBookHighlight(user.id, bookId, {
        id: `demo-highlight-${Date.now()}`,
        cfi_range: `demo-${Date.now()}`,
        selected_text: selection.trim(),
        created_at: new Date().toISOString(),
        color: '#B8E6C8',
        translation: translated,
      });

      setActionMessage('Saved locally in this browser demo.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Could not save word.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title} numberOfLines={1}>{title ?? 'Reader'}</Text>
        <Text style={styles.page}>{locationLabel}</Text>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={() => turn('prev')}>
            <Text style={styles.buttonText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => turn('next')}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isWebDemo() && selection ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText} numberOfLines={2}>{selection}</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => void handleTranslate()} disabled={translating}>
              <Text style={styles.actionButtonText}>{translating ? 'Translating…' : 'Translate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => void handleSaveWord()}>
              <Text style={styles.actionButtonText}>Save word</Text>
            </TouchableOpacity>
          </View>
          {translation ? <Text style={styles.translationText}>{translation}</Text> : null}
          {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
        </View>
      ) : null}

      <View style={styles.readerHost} ref={hostRef} />
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
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  page: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  buttonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  selectionBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.highlightMint,
    gap: spacing.xs,
  },
  selectionText: {
    ...typography.body,
    color: colors.text,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  translationText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  actionMessage: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  readerHost: {
    flex: 1,
    minHeight: 420,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
});
