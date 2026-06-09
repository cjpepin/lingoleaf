/**
 * HighlightActionPopup
 *
 * Positioned popup for changing highlight color or deleting a highlight.
 * Optionally shows selected text, translation (or Translate button), and Save to vocab.
 * Shows 3 color circles (mint, yellow, pink) with a check on the active one, plus trash.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';

export type HighlightColor = 'mint' | 'yellow' | 'pink';

/** Softer border/check color per highlight — avoids a harsh black ring */
const ACTIVE_RING: Record<HighlightColor, string> = {
  mint: '#3CA874',
  yellow: '#C9A020',
  pink: '#C2607A',
};

interface Props {
  visible: boolean;
  currentColor: HighlightColor;
  /** Bounding rect of the highlight in the reader's coordinate space */
  highlightBounds?: { x: number; y: number; width: number; height: number };
  /** Reader area offset (same value passed to SelectionToolbar) */
  readerOffset?: { x: number; y: number };
  /** Highlight text (for translation section) */
  selectedText?: string;
  /** Translation if available; when set, show it and "Save to list" */
  translation?: string | null;
  /** True while translating from popup */
  translating?: boolean;
  onTranslate?: () => void;
  onSaveToVocab?: () => void;
  onChangeColor: (color: HighlightColor) => void;
  onDelete: () => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POPUP_WIDTH = 260;
const COLOR_ROW_HEIGHT = 48;
const POPUP_HEIGHT = COLOR_ROW_HEIGHT;
const GAP = 10;
const ARROW_SIZE = 8;
const H_PAD = 8;

const COLOR_OPTIONS: { value: HighlightColor; hex: string }[] = [
  { value: 'mint', hex: colors.annotationMint },
  { value: 'yellow', hex: colors.annotationYellow },
  { value: 'pink', hex: colors.annotationPink },
];

const TRANSLATION_SECTION_HEIGHT = 88;

export function HighlightActionPopup({
  visible,
  currentColor,
  highlightBounds,
  readerOffset,
  selectedText,
  translation,
  translating = false,
  onTranslate,
  onSaveToVocab,
  onChangeColor,
  onDelete,
  onClose,
}: Props) {
  const t = useTranslation();
  const hasTranslationSection = Boolean(selectedText && (onTranslate || onSaveToVocab));
  const totalPopupHeight = POPUP_HEIGHT + (hasTranslationSection ? TRANSLATION_SECTION_HEIGHT + spacing.xs : 0);

  const position = useMemo(() => {
    if (!highlightBounds) {
      return {
        top: SCREEN_HEIGHT / 2 - totalPopupHeight / 2,
        left: SCREEN_WIDTH / 2 - POPUP_WIDTH / 2,
        arrowPosition: 'bottom' as const,
      };
    }

    const ox = readerOffset?.x ?? 0;
    const oy = readerOffset?.y ?? 0;
    const { x, y, width, height } = highlightBounds;
    const centerX = ox + x + width / 2;
    const selTop = oy + y;
    const selBottom = oy + y + height;

    let left = centerX - POPUP_WIDTH / 2;
    left = Math.max(H_PAD, Math.min(left, SCREEN_WIDTH - POPUP_WIDTH - H_PAD));

    const totalAbove = totalPopupHeight + ARROW_SIZE + GAP;
    const spaceAbove = selTop;
    const spaceBelow = SCREEN_HEIGHT - selBottom;
    let top: number;
    let arrowPosition: 'top' | 'bottom' = 'bottom';

    const minSpaceBelow = totalPopupHeight + ARROW_SIZE + GAP;
    // Require buffer above so popup never overlaps highlight when placed above
    const spaceAboveWithBuffer = totalAbove + GAP;
    if (spaceAbove >= spaceAboveWithBuffer) {
      top = selTop - totalPopupHeight - ARROW_SIZE - GAP;
      arrowPosition = 'bottom';
    } else if (spaceBelow >= minSpaceBelow) {
      // Not enough space above or highlight near top → show below with arrow up
      top = selBottom + GAP + ARROW_SIZE;
      arrowPosition = 'top';
    } else {
      top = Math.max(H_PAD, selTop - totalPopupHeight - ARROW_SIZE - GAP);
      arrowPosition = 'bottom';
    }

    top = Math.max(H_PAD, Math.min(top, SCREEN_HEIGHT - totalPopupHeight - ARROW_SIZE - H_PAD));

    return { top, left, arrowPosition };
  }, [highlightBounds, readerOffset, totalPopupHeight]);

  if (!visible) return null;

  const contentStyle = [
    styles.content,
    hasTranslationSection && styles.contentNoTopRadius,
    position.arrowPosition === 'bottom' && styles.contentNoBottomBorder,
    position.arrowPosition === 'top' && styles.contentNoTopBorder,
  ];

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.container, { top: position.top, left: position.left }]}>
        {position.arrowPosition === 'top' && <View style={styles.arrowTop} />}
        {hasTranslationSection && (
          <View style={styles.translationSection}>
            <Text style={styles.selectedText} numberOfLines={2}>{selectedText}</Text>
            {translation != null && translation !== '' ? (
              <>
                <Text style={styles.translationText} numberOfLines={2}>{translation}</Text>
                {onSaveToVocab && (
                  <Pressable style={styles.saveButton} onPress={onSaveToVocab}>
                    <Text style={styles.saveButtonText}>{t('translate.saveToList')}</Text>
                  </Pressable>
                )}
              </>
            ) : onTranslate ? (
              <Pressable
                style={styles.translateButton}
                onPress={onTranslate}
                disabled={translating}
              >
                {translating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.translateButtonText}>{t('reader.translate')}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={contentStyle}>
          {COLOR_OPTIONS.map((opt) => {
            const isActive = opt.value === currentColor;
            const ringColor = ACTIVE_RING[opt.value];
            return (
              <Pressable
                key={opt.value}
                style={[styles.colorCircle, { backgroundColor: opt.hex }, isActive && { borderColor: ringColor }]}
                onPress={() => onChangeColor(opt.value)}
              >
                {isActive ? <Feather name="check" size={16} color={ringColor} /> : null}
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Feather name="trash-2" size={16} color={colors.error} />
          </Pressable>
        </View>
        {position.arrowPosition === 'bottom' && <View style={styles.arrowBottom} />}
      </View>
    </>
  );
}

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    zIndex: 1000,
    width: POPUP_WIDTH,
  },
  arrowTop: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    alignSelf: 'center',
    marginBottom: -1,
  },
  arrowBottom: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    alignSelf: 'center',
    marginTop: -1,
  },
  contentNoBottomBorder: {
    borderBottomWidth: 0,
  },
  contentNoTopBorder: {
    borderTopWidth: 0,
  },
  translationSection: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  selectedText: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  translationText: {
    ...typography.bodySmall,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  saveButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  saveButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  translateButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    minWidth: 80,
    alignItems: 'center',
  },
  translateButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  contentNoTopRadius: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: POPUP_HEIGHT,
    justifyContent: 'center',
  },
  colorCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  divider: {
    width: 1,
    height: CIRCLE_SIZE,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  deleteButton: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
