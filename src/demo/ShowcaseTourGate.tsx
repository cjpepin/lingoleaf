/**
 * Portfolio embed guided tour — auto-plays ReaderTutorialModal in showcase mode.
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReaderTutorialModal } from '@/components/ReaderTutorialModal';
import { isEmbedMode, isShowcaseMode } from '@/demo/config';

interface Props {
  children: React.ReactNode;
}

export function ShowcaseTourGate({ children }: Props) {
  const showcaseActive = isShowcaseMode() && isEmbedMode();
  const [tourVisible, setTourVisible] = useState(showcaseActive);

  if (!showcaseActive) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      {children}
      <ReaderTutorialModal
        visible={tourVisible}
        onComplete={() => setTourVisible(false)}
        onSkip={() => setTourVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
