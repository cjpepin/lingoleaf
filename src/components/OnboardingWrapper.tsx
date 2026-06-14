/**
 * OnboardingWrapper
 * Shows onboarding modal on first launch and saves user preferences
 */

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingModal } from './OnboardingModal';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { upsertUserSettings } from '@/supabase/queries';
import { logger } from '@/utils/logger';
import { track } from '@/analytics/client';
import { syncDailyGoalReminder } from '@/notifications/dailyGoalReminder';
import { useTranslation } from '@/i18n/useTranslation';
import { defaultSubGoals, type GoalKey, normalizePrimaryGoal, normalizeSubGoals } from '@/utils/goalHierarchy';
import { isShowcaseMode } from '@/demo/config';

const ONBOARDING_KEY = '@lingoleaf:onboarding_completed';
const TERMS_ACCEPTED_KEY = '@lingoleaf:terms_accepted_at';

interface Props {
  children: React.ReactNode;
}

export function OnboardingWrapper({ children }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const setTargetLang = useSettingsStore((s) => s.setTargetLang);
  const t = useTranslation();

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      if (isShowcaseMode()) {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
        setShowOnboarding(false);
        return;
      }

      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setShowOnboarding(true);
        track('onboarding_started', { source: 'onboarding_modal' });
      }
    } catch (error) {
      logger.error('Failed to check onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (data: {
    nativeLang: string;
    goalLangs: string[];
    dailyGoalMinutes?: number;
    dailyWordsSavedGoal?: number;
    dailyWordsLearnedGoal?: number;
    dailyGoalReminderEnabled?: boolean;
    primaryGoal?: 'reading_minutes' | 'words_saved' | 'words_learned';
    goalPriority?: Array<'reading_minutes' | 'words_saved' | 'words_learned'>;
  }) => {
    const dailyGoalMinutes = data.dailyGoalMinutes ?? 10;
    const dailyWordsSavedGoal = data.dailyWordsSavedGoal ?? 10;
    const dailyWordsLearnedGoal = data.dailyWordsLearnedGoal ?? 5;
    const dailyGoalReminderEnabled = data.dailyGoalReminderEnabled ?? true;
    const primaryGoal: GoalKey = normalizePrimaryGoal(data.primaryGoal);
    const goalPriority: GoalKey[] = Array.isArray(data.goalPriority)
      ? normalizeSubGoals(data.goalPriority, primaryGoal)
      : defaultSubGoals(primaryGoal);
    try {
      // Save to user settings if logged in
      if (user) {
        await upsertUserSettings({
          user_id: user.id,
          native_lang: data.nativeLang,
          known_langs: [data.nativeLang],
          known_lang_levels: { [data.nativeLang]: 'native' },
          goal_langs: data.goalLangs,
          goal_lang_levels: Object.fromEntries((data.goalLangs || []).map((code: string) => [code, 'A1'])),
          daily_reading_goal_minutes: dailyGoalMinutes,
          daily_words_saved_goal: dailyWordsSavedGoal,
          daily_words_learned_goal: dailyWordsLearnedGoal,
          daily_goal_reminder_enabled: dailyGoalReminderEnabled,
          daily_goal_reminder_hour: 20,
          daily_goal_reminder_minute: 0,
          primary_goal: primaryGoal,
          goal_priority: goalPriority,
          target_lang: data.nativeLang,
        });
      }
      setTargetLang(data.nativeLang);
      track('goal_set', {
        minutes: dailyGoalMinutes,
        minutes_per_day: dailyGoalMinutes,
        source: 'onboarding_modal',
        primary_goal: primaryGoal,
        goal_priority: goalPriority.join(','),
      });
      track('onboarding_completed', { source: 'onboarding_modal' });

      const reminderBodies = [
        t('notifications.dailyGoalBody'),
        t('notifications.dailyGoalBodyAlt1'),
        t('notifications.dailyGoalBodyAlt2'),
        t('notifications.dailyGoalBodyAlt3'),
        t('notifications.dailyGoalBodyAlt4'),
      ];
      await syncDailyGoalReminder({
        enabled: dailyGoalReminderEnabled,
        hour: 20,
        minute: 0,
        title: t('app.title'),
        body: reminderBodies[0],
        bodyOptions: reminderBodies,
        requestPermissionIfNeeded: false,
      });

      // Record terms acceptance (user cannot complete onboarding without accepting)
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
      // Mark onboarding as completed
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
      logger.info('Onboarding completed', data);
    } catch (error) {
      logger.error('Failed to complete onboarding:', error);
      // Still close the modal even if save fails (terms were accepted in UI)
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    }
  };

  const handleSkip = async () => {
    logger.warn('Onboarding skip blocked because terms acceptance is required');
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
