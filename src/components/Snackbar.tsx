/**
 * Snackbar
 * Toast-style notification that appears at the bottom of the screen
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
  /** When true, render without Modal so touches pass through to content below (e.g. turn pages while snackbar visible) */
  passThrough?: boolean;
}

export function Snackbar({ visible, message, type = 'info', duration = 3000, onDismiss, passThrough = false }: Props) {
  const translateY = useRef(new Animated.Value(100)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  const insets = useSafeAreaInsets();

  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onDismissRef.current?.();
      }, duration);
    } else {
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, duration, translateY]);

  if (!visible) return null;

  const backgroundColor =
    type === 'success' ? colors.success : type === 'error' ? colors.error : colors.surface;
  const textColor = type === 'info' ? colors.text : '#FFFFFF';
  const bottomInset = Math.max(insets.bottom, spacing.md) + spacing.xl;

  if (passThrough) {
    return (
      <View style={styles.overlayPassThrough} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.container,
            { backgroundColor, bottom: bottomInset, transform: [{ translateY }] },
          ]}
          pointerEvents="auto"
        >
          <Pressable style={styles.pressable} onPress={onDismiss}>
            <Text style={[styles.message, { color: textColor }]}>{message}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" pointerEvents="box-none">
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.container,
            { backgroundColor, bottom: bottomInset, transform: [{ translateY }] },
          ]}
        >
          <Pressable style={styles.pressable} onPress={onDismiss}>
            <Text style={[styles.message, { color: textColor }]}>{message}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  overlayPassThrough: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: SCREEN_WIDTH - spacing.md * 2,
    minHeight: 48,
    alignSelf: 'center',
  },
  pressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    fontWeight: '500',
    flexShrink: 0,
  },
});

