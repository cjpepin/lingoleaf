/**
 * ReaderEdgeTapOverlay
 *
 * Transparent overlay that captures taps on the left/right edges
 * to page backward/forward without blocking center interactions.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

interface Props {
  onTapLeft: () => void;
  onTapRight: () => void;
}

export function ReaderEdgeTapOverlay({ onTapLeft, onTapRight }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable style={styles.left} onPress={onTapLeft} />
      <Pressable style={styles.right} onPress={onTapRight} />
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
    zIndex: 5,
  },
  left: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '5%',
  },
  right: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '5%',
  },
});


