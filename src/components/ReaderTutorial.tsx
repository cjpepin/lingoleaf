/**
 * ReaderTutorial
 *
 * Wrapper that checks AsyncStorage and shows ReaderTutorialModal
 * on first book open. Keeps READER_TUTORIAL_KEY export for Profile replay.
 */

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReaderTutorialModal } from './ReaderTutorialModal';

const READER_TUTORIAL_KEY = '@lingoleaf:reader_tutorial_seen';
export { READER_TUTORIAL_KEY };

export function ReaderTutorial() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(READER_TUTORIAL_KEY).then((val) => {
      if (!cancelled && !val) {
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 600);
      }
      if (!cancelled) setChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  const markSeen = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(READER_TUTORIAL_KEY, 'true');
    } catch {
      // non-critical
    }
  };

  if (!checked || !visible) return null;

  return (
    <ReaderTutorialModal
      visible={visible}
      onComplete={markSeen}
      onSkip={markSeen}
    />
  );
}
