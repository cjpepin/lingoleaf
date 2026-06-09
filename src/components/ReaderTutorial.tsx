/**
 * ReaderTutorial
 *
 * Wrapper that checks AsyncStorage and shows ReaderTutorialModal
 * on first book open. Keeps READER_TUTORIAL_KEY export for Profile replay.
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/state/useAuthStore';
import { ReaderTutorialModal } from './ReaderTutorialModal';
import { hasSeenTutorial, markTutorialSeen } from '@/utils/tutorialSeen';
import { hasReadingHistory } from '@/supabase/queries';

const READER_TUTORIAL_KEY = '@lingoleaf:reader_tutorial_seen';
export { READER_TUTORIAL_KEY };

export function ReaderTutorial() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.loading);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) {
      setVisible(false);
      setChecked(false);
      return;
    }

    setVisible(false);
    setChecked(false);

    let cancelled = false;
    hasSeenTutorial(READER_TUTORIAL_KEY, userId).then(async (seen) => {
      if (!cancelled && !seen && userId && !isGuest) {
        try {
          const hasHistory = await hasReadingHistory(userId);
          if (hasHistory) {
            await markTutorialSeen(READER_TUTORIAL_KEY, userId);
            if (!cancelled) {
              setVisible(false);
              setChecked(true);
            }
            return;
          }
        } catch {
          // non-critical; fallback to local tutorial key behavior
        }
      }

      if (!cancelled && !seen) {
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 600);
      } else if (!cancelled) {
        setVisible(false);
      }
      if (!cancelled) setChecked(true);
    });
    return () => { cancelled = true; };
  }, [authLoading, isGuest, userId]);

  const markSeen = async () => {
    setVisible(false);
    try {
      await markTutorialSeen(READER_TUTORIAL_KEY, userId);
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
