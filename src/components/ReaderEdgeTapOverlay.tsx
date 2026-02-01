/**
 * ReaderEdgeTapOverlay
 *
 * Transparent overlay that captures taps on the far left/right edges
 * to page backward/forward. Center remains pass-through for selection.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

const EDGE_WIDTH = 44; // Fixed px for reliable tap target, ~10% on typical phones

interface Props {
  onTapLeft: () => void;
  onTapRight: () => void;
}

export function ReaderEdgeTapOverlay({ onTapLeft, onTapRight }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        style={styles.left}
        onPress={onTapLeft}
        hitSlop={{ top: 0, bottom: 0, left: 0, right: 8 }}
      />
      <Pressable
        style={styles.right}
        onPress={onTapRight}
        hitSlop={{ top: 0, bottom: 0, left: 8, right: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  left: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_WIDTH,
  },
  right: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: EDGE_WIDTH,
  },
});


