/**
 * HomeTutorial
 *
 * Wrapper that checks AsyncStorage and shows HomeTutorialModal
 * on first Home tab visit. Keeps HOME_TUTORIAL_KEY export for Profile replay.
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/state/useAuthStore';
import { HomeTutorialModal } from './HomeTutorialModal';
import { hasSeenTutorial, markTutorialSeen } from '@/utils/tutorialSeen';

const HOME_TUTORIAL_KEY = '@lingoleaf:home_tutorial_seen';
export { HOME_TUTORIAL_KEY };

interface Props {
  ready: boolean;
}

export function HomeTutorial({ ready }: Props) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.loading);
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready || authLoading) {
      setVisible(false);
      setChecked(false);
      return;
    }

    setVisible(false);
    setChecked(false);

    let cancelled = false;
    hasSeenTutorial(HOME_TUTORIAL_KEY, userId).then((seen) => {
      if (!cancelled && !seen) {
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 600);
      } else if (!cancelled) {
        setVisible(false);
      }
      if (!cancelled) setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, ready, userId]);

  const markSeen = async () => {
    setVisible(false);
    try {
      await markTutorialSeen(HOME_TUTORIAL_KEY, userId);
    } catch {
      // non-critical
    }
  };

  if (!checked || !visible) return null;

  return (
    <HomeTutorialModal
      visible={visible}
      onComplete={markSeen}
      onSkip={markSeen}
    />
  );
}
