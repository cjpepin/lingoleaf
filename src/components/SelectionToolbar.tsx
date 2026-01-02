/**
 * SelectionToolbar
 * Floating popup for selected text actions
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, typography } from '@/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOOLBAR_WIDTH = 240;
const TOOLBAR_HEIGHT = 44;
const BUFFER = 4;
const ARROW_SIZE = 8;

interface Props {
  onHighlight: () => void;
  onTranslate: () => void;
  onClose: () => void;
  selectionBounds?: { x: number; y: number; width: number; height: number };
}

export function SelectionToolbar({ onHighlight, onTranslate, onClose, selectionBounds }: Props) {
  const position = useMemo(() => {
    if (!selectionBounds) {
      // Default to center-top if no selection bounds
      return {
        top: 100,
        left: SCREEN_WIDTH / 2 - TOOLBAR_WIDTH / 2,
        arrowPosition: 'top' as const,
      };
    }

    const { x, y, width, height } = selectionBounds;
    const selectionCenterX = x + width / 2;
    const selectionBottom = y + height;
    const selectionTop = y;

    let top = 0;
    let left = selectionCenterX - TOOLBAR_WIDTH / 2;
    let arrowPosition: 'top' | 'bottom' = 'bottom';

    // Try to position above selection
    if (selectionTop - TOOLBAR_HEIGHT - ARROW_SIZE - BUFFER > 0) {
      top = selectionTop - TOOLBAR_HEIGHT - ARROW_SIZE - BUFFER;
      arrowPosition = 'bottom';
    }
    // Otherwise position below selection
    else if (selectionBottom + TOOLBAR_HEIGHT + ARROW_SIZE + BUFFER < SCREEN_HEIGHT) {
      top = selectionBottom + ARROW_SIZE + BUFFER;
      arrowPosition = 'top';
    }
    // Fallback: position above with minimal spacing
    else {
      top = Math.max(BUFFER, selectionTop - TOOLBAR_HEIGHT - ARROW_SIZE);
      arrowPosition = 'bottom';
    }

    // Ensure toolbar stays within horizontal bounds
    left = Math.max(BUFFER, Math.min(left, SCREEN_WIDTH - TOOLBAR_WIDTH - BUFFER));

    return { top, left, arrowPosition };
  }, [selectionBounds]);

  return (
    <View style={[styles.container, { top: position.top, left: position.left }]}>
      {position.arrowPosition === 'top' && <View style={styles.arrowTop} />}
      <View style={styles.content}>
        <TouchableOpacity style={styles.button} onPress={onHighlight}>
          <Text style={styles.buttonText}>💡 Highlight</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.button} onPress={onTranslate}>
          <Text style={styles.buttonText}>🌐 Translate</Text>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
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

