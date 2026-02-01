/**
 * OverlayModal
 *
 * Reusable modal shell:
 * - dimmed overlay
 * - tappable backdrop to close
 * - card container for content
 */

import React from 'react';
import { Modal, View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayStyle?: ViewStyle;
  cardStyle?: ViewStyle;
  dismissOnBackdropPress?: boolean;
}

export function OverlayModal({
  visible,
  onClose,
  children,
  overlayStyle,
  cardStyle,
  dismissOnBackdropPress = true,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, overlayStyle]}>
        {dismissOnBackdropPress ? (
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
        ) : null}
        <View style={[styles.card, cardStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    zIndex: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    maxHeight: '85%',
    zIndex: 1,
    elevation: 1,
  },
});


