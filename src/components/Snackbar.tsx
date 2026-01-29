/**
 * Snackbar
 * Toast-style notification that appears at the bottom of the screen
 */

import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

export function Snackbar({ visible, message, type = 'info', duration = 3000, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(100)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();

      // Auto-dismiss after duration
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onDismiss?.();
      }, duration);
    } else {
      // Slide down
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, duration, onDismiss, translateY]);

  if (!visible) return null;

  const backgroundColor =
    type === 'success' ? colors.success : type === 'error' ? colors.error : colors.surface;
  
  const textColor = type === 'info' ? colors.text : '#FFFFFF';

  return (
    <Modal transparent visible={visible} animationType="none" pointerEvents="box-none">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <Animated.View
          style={[
            styles.container,
            { 
              backgroundColor, 
              transform: [{ translateY }],
              bottom: Math.max(insets.bottom, spacing.md) + spacing.xl,
            },
          ]}
        >
          <Text style={[styles.message, { color: textColor }]}>{message}</Text>
        </Animated.View>
      </TouchableOpacity>
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
    alignSelf: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    fontWeight: '500',
  },
});

