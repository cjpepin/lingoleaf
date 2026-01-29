/**
 * OnboardingWrapper
 * Shows onboarding modal on first launch and saves user preferences
 */

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingModal } from './OnboardingModal';
import { useAuthStore } from '@/state/useAuthStore';
import { upsertUserSettings } from '@/supabase/queries';
import { logger } from '@/utils/logger';

const ONBOARDING_KEY = '@lingoleaf:onboarding_completed';

interface Props {
  children: React.ReactNode;
}

export function OnboardingWrapper({ children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setShowOnboarding(true);
      }
    } catch (error) {
      logger.error('Failed to check onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (data: { nativeLang: string; goalLangs: string[] }) => {
    try {
      // Save to user settings if logged in
      if (user) {
        await upsertUserSettings({
          user_id: user.id,
          native_lang: data.nativeLang,
          goal_langs: data.goalLangs,
          target_lang: data.goalLangs[0] || 'en', // Default to first goal language
        });
      }

      // Mark onboarding as completed
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
      logger.info('Onboarding completed', data);
    } catch (error) {
      logger.error('Failed to complete onboarding:', error);
      // Still close the modal even if save fails
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
      logger.info('Onboarding skipped');
    } catch (error) {
      logger.error('Failed to skip onboarding:', error);
    }
  };

  if (loading) {
    return null; // Or a splash screen
  }

  return (
    <>
      {children}
      <OnboardingModal visible={showOnboarding} onComplete={handleComplete} onSkip={handleSkip} />
    </>
  );
}

