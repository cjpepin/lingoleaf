/**
 * ReaderEdgeTapOverlay
 *
 * Renders the reader in the center with narrow left/right strips for tap-to-turn.
 * Strips are beside the reader (not on top), so the full reader area is selectable—
 * words at the left/right margin of the page can be selected on long-press.
 */

import React, { useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

export const READER_EDGE_WIDTH = 28; // Tap-to-turn strips beside reader; center is 100% selectable
const SHORT_TAP_MS = 280;

interface Props {
  onTapLeft: () => void;
  onTapRight: () => void;
  children: React.ReactNode;
}

export function ReaderEdgeTapOverlay({ onTapLeft, onTapRight, children }: Props) {
  const pressStartRef = useRef<number>(0);

  const handlePressIn = useCallback(() => {
    pressStartRef.current = Date.now();
  }, []);

  const isShortTap = useCallback(() => {
    const startedAt = pressStartRef.current;
    if (startedAt <= 0) return true;
    return Date.now() - startedAt <= SHORT_TAP_MS;
  }, []);

  const handlePressLeft = useCallback(() => {
    if (isShortTap()) onTapLeft();
    pressStartRef.current = 0;
  }, [isShortTap, onTapLeft]);

  const handlePressRight = useCallback(() => {
    if (isShortTap()) onTapRight();
    pressStartRef.current = 0;
  }, [isShortTap, onTapRight]);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.left}
        onPressIn={handlePressIn}
        onPress={handlePressLeft}
        hitSlop={{ top: 0, bottom: 0, left: 0, right: 4 }}
      />
      <View style={styles.center}>{children}</View>
      <Pressable
        style={styles.right}
        onPressIn={handlePressIn}
        onPress={handlePressRight}
        hitSlop={{ top: 0, bottom: 0, left: 4, right: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  left: {
    width: READER_EDGE_WIDTH,
    alignSelf: 'stretch',
    zIndex: 4,
  },
  center: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  right: {
    width: READER_EDGE_WIDTH,
    alignSelf: 'stretch',
    zIndex: 4,
  },
});


