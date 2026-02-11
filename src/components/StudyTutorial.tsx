/**
 * StudyTutorial
 *
 * Wrapper that checks AsyncStorage and shows StudyTutorialModal
 * on first Study tab visit. Keeps STUDY_TUTORIAL_KEY export for Profile replay.
 */

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StudyTutorialModal } from './StudyTutorialModal';

const STUDY_TUTORIAL_KEY = '@lingoleaf:study_tutorial_seen';
export { STUDY_TUTORIAL_KEY };

interface Props {
  ready: boolean;
}

export function StudyTutorial({ ready }: Props) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    AsyncStorage.getItem(STUDY_TUTORIAL_KEY).then((val) => {
      if (!cancelled && !val) {
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 600);
      }
      if (!cancelled) setChecked(true);
    });
    return () => { cancelled = true; };
  }, [ready]);

  const markSeen = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STUDY_TUTORIAL_KEY, 'true');
    } catch {
      // non-critical
    }
  };

  if (!checked || !visible) return null;

  return (
    <StudyTutorialModal
      visible={visible}
      onComplete={markSeen}
      onSkip={markSeen}
    />
  );
}
