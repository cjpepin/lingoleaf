/**
 * SelectionToolbar
 * Floating popup for selected text actions
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOOLBAR_WIDTH = 240;
const TOOLBAR_HEIGHT = 44;
const GAP_ABOVE_SELECTION = 10;
const HORIZONTAL_PADDING = 8;
const ARROW_SIZE = 8;

interface Props {
  onHighlight: () => void;
  onTranslate: () => void;
  onClose: () => void;
  selectionBounds?: { x: number; y: number; width: number; height: number };
  /** Offset to add to selection coords (e.g. reader area's top-left in container) */
  readerOffset?: { x: number; y: number };
}

export function SelectionToolbar({ onHighlight, onTranslate, onClose, selectionBounds, readerOffset }: Props) {
  const position = useMemo(() => {
    if (!selectionBounds) {
      return {
        top: 100,
        left: SCREEN_WIDTH / 2 - TOOLBAR_WIDTH / 2,
        arrowPosition: 'top' as const,
      };
    }

    const ox = readerOffset?.x ?? 0;
    const oy = readerOffset?.y ?? 0;
    const { x, y, width, height } = selectionBounds;
    const selectionCenterX = ox + x + width / 2;
    const selectionBottom = oy + y + height;
    const selectionTop = oy + y;

    // Center toolbar horizontally on selection
    let left = selectionCenterX - TOOLBAR_WIDTH / 2;
    // Clamp to keep on screen
    left = Math.max(HORIZONTAL_PADDING, Math.min(left, SCREEN_WIDTH - TOOLBAR_WIDTH - HORIZONTAL_PADDING));

    // Prefer above selection, 10px gap. Toolbar + arrow sits above selection.
    const spaceAbove = selectionTop;
    const spaceBelow = SCREEN_HEIGHT - selectionBottom;
    const toolbarWithArrow = TOOLBAR_HEIGHT + ARROW_SIZE + GAP_ABOVE_SELECTION;

    let top: number;
    let arrowPosition: 'top' | 'bottom' = 'bottom';

    if (spaceAbove >= toolbarWithArrow) {
      // Position above: bottom of arrow is 10px above selection top
      top = selectionTop - TOOLBAR_HEIGHT - ARROW_SIZE - GAP_ABOVE_SELECTION;
      arrowPosition = 'bottom';
    } else if (spaceBelow >= toolbarWithArrow) {
      // Position below: top of toolbar is 10px below selection bottom
      top = selectionBottom + GAP_ABOVE_SELECTION + ARROW_SIZE;
      arrowPosition = 'top';
    } else {
      // Fallback: above with minimal clearance
      top = Math.max(HORIZONTAL_PADDING, selectionTop - TOOLBAR_HEIGHT - ARROW_SIZE - GAP_ABOVE_SELECTION);
      arrowPosition = 'bottom';
    }

    return { top, left, arrowPosition };
  }, [selectionBounds, readerOffset]);

  return (
    <View style={[styles.container, { top: position.top, left: position.left }]}>
      {position.arrowPosition === 'top' && <View style={styles.arrowTop} />}
      <View style={styles.content}>
        <TouchableOpacity style={styles.button} onPress={onHighlight}>
          <Feather name="edit-3" size={16} color={colors.text} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Highlight</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.button} onPress={onTranslate}>
          <Feather name="globe" size={16} color={colors.text} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Translate</Text>
        </TouchableOpacity>
      </View>
      {position.arrowPosition === 'bottom' && <View style={styles.arrowBottom} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
    width: TOOLBAR_WIDTH,
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
    borderBottomColor: colors.surface,
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
    borderTopColor: colors.surface,
    alignSelf: 'center',
    marginTop: -1,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: TOOLBAR_HEIGHT,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  buttonIcon: {
    opacity: 0.9,
  },
  buttonText: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
});

