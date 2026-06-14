/**
 * Tutorial overlay shell — Modal on native, in-tree absolute layer in portfolio embed
 * so walkthrough content stays clipped inside the demo iframe.
 */

import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { isEmbedMode } from '@/demo/config';

interface Props {
  visible: boolean;
  children: React.ReactNode;
}

export function TutorialShell({ visible, children }: Props) {
  if (!visible) return null;

  if (isEmbedMode()) {
    return (
      <View style={styles.embedOverlay} accessibilityViewIsModal>
        {children}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});
