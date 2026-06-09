/**
 * App entry point
 * Initializes auth and renders navigation
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, Text, StyleSheet, Alert } from 'react-native';
import { ReaderProvider } from '@epubjs-react-native/core';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/state/useAuthStore';
import { useAppLangStore } from './src/state/useAppLangStore';
import { OnboardingWrapper } from './src/components/OnboardingWrapper';
import mobileAds from 'react-native-google-mobile-ads';
import { logger } from './src/utils/logger';
import { supabaseConfigured, supabase } from './src/supabase/client';
import { colors, spacing, typography } from './src/theme';
import * as Linking from 'expo-linking';
import { analyticsClient, identify, reset, setSuperProperties, track } from './src/analytics/client';
import { PremiumProvider } from './src/premium/PremiumProvider';
import { fetchUserSettings } from './src/supabase/queries';
import { initializeNotificationHandler, syncDailyGoalReminder } from './src/notifications/dailyGoalReminder';
import { t as translate } from './src/i18n/translations';
import { parseTrustedAuthCallback, redactAuthTokens } from './src/utils/authDeepLink';
import { clearPendingEmailConfirmation } from './src/utils/pendingEmailConfirmation';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const appLang = useAppLangStore((state) => state.appLang);

  useEffect(() => {
    useAppLangStore.getState().hydrateFromStorage();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      logger.error('Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY for production builds.');
      return;
    }
    initialize();
  }, []);

  useEffect(() => {
    void analyticsClient.init();
    initializeNotificationHandler();
  }, []);

  useEffect(() => {
    const appStartAt = Date.now();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background' && nextState !== 'inactive') return;
      track('session_ended', {
        duration_ms: Math.max(0, Date.now() - appStartAt),
      });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setSuperProperties({ is_guest: isGuest });
    if (user?.id) {
      identify(user.id, { is_guest: isGuest });
      return;
    }
    identify(null);
    void reset();
  }, [isGuest, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      try {
        const settings = await fetchUserSettings(user.id);
        if (!settings || canceled) return;
        await syncDailyGoalReminder({
          enabled: settings.daily_goal_reminder_enabled === true,
          hour: settings.daily_goal_reminder_hour ?? 20,
          minute: settings.daily_goal_reminder_minute ?? 0,
          title: 'LingoLeaf',
          body: translate(appLang, 'notifications.dailyGoalBody'),
          requestPermissionIfNeeded: false,
        });
      } catch (error) {
        logger.warn('Failed syncing daily goal reminder', error);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [appLang, user?.id]);

  useEffect(() => {
    // Ensure AdMob is initialized (some setups won't render ads until init completes).
    mobileAds()
      .initialize()
      .then((s) => logger.info('MobileAds initialized', { status: s }))
      .catch((e) => logger.warn('MobileAds init failed', e));
  }, []);

  useEffect(() => {
    // Handle deep links for email confirmation
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      const safeUrl = redactAuthTokens(url);
      logger.info('Deep link received:', safeUrl);

      const tokens = parseTrustedAuthCallback(url);
      if (!tokens) {
        if (url.includes('access_token=') || url.includes('refresh_token=')) {
          logger.warn('Ignoring untrusted auth callback URL', safeUrl);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });

        if (error) {
          logger.error('Failed to set session from URL:', error);
          Alert.alert('Authentication Error', 'Failed to confirm your email. Please try again.');
          return;
        }

        if (data.session) {
          await clearPendingEmailConfirmation(data.session.user.email ?? undefined);
          logger.info('Email confirmed, session established');
          Alert.alert('Email Confirmed!', 'Your account has been verified. You can now use all features.');
        }
      } catch (e) {
        logger.error('Deep link auth error:', e);
      }
    };

    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  if (!supabaseConfigured) {
    return (
      <View style={styles.configContainer}>
        <StatusBar style="dark" />
        <Text style={styles.configTitle}>App misconfigured</Text>
        <Text style={styles.configBody}>
          Missing Supabase env vars. Set{'\n'}
          EXPO_PUBLIC_SUPABASE_URL and{'\n'}
          EXPO_PUBLIC_SUPABASE_KEY{'\n'}
          for the production build.
        </Text>
      </View>
    );
  }

  return (
    <ReaderProvider>
      <StatusBar style="dark" />
      <PremiumProvider>
        <OnboardingWrapper>
          <RootNavigator />
        </OnboardingWrapper>
      </PremiumProvider>
    </ReaderProvider>
  );
}

const styles = StyleSheet.create({
  configContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  configTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  configBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
