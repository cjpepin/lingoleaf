/**
 * App entry point
 * Initializes auth and renders navigation
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ReaderProvider } from '@epubjs-react-native/core';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/state/useAuthStore';
import { useAppLangStore } from './src/state/useAppLangStore';
import { OnboardingWrapper } from './src/components/OnboardingWrapper';
import { DemoBanner } from './src/components/DemoBanner';
import { WebDemoDeviceFrame } from './src/demo/WebDemoDeviceFrame';
import { isWebDemo, isWebPlatform, isDemoMode, isEmbedMode } from './src/demo/config';
import { useWebDemoFontsReady } from './src/demo/useWebDemoFonts';
import { AppLoadingSplash } from './src/components/AppLoadingSplash';
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

function AppShell() {
  const fontsReady = useWebDemoFontsReady();
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const appLang = useAppLangStore((state) => state.appLang);

  useEffect(() => {
    useAppLangStore.getState().hydrateFromStorage();
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      initialize();
      return;
    }
    if (!supabaseConfigured) {
      logger.error('Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY for production builds.');
      return;
    }
    initialize();
  }, []);

  useEffect(() => {
    if (isWebPlatform()) return;
    void analyticsClient.init();
    initializeNotificationHandler();
  }, []);

  useEffect(() => {
    if (isWebPlatform()) return;
    const { AppState } = require('react-native');
    const appStartAt = Date.now();
    const sub = AppState.addEventListener('change', (nextState: string) => {
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
    if (isWebPlatform() || !user?.id) return;
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
    if (isWebPlatform()) return;
    // Lazy-load native ads SDK so web bundles do not import it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mobileAds = require('react-native-google-mobile-ads').default;
    void mobileAds()
      .initialize()
      .then((status: unknown) => logger.info('MobileAds initialized', { status }))
      .catch((error: unknown) => logger.warn('MobileAds init failed', error));
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

  if (isWebDemo() && !fontsReady) {
    return <AppLoadingSplash />;
  }

  if (!isDemoMode() && !supabaseConfigured) {
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

  const content = (
    <>
      <StatusBar style="dark" />
      {isWebDemo() && !isEmbedMode() ? <DemoBanner /> : null}
      <PremiumProvider>
        <OnboardingWrapper>
          <RootNavigator />
        </OnboardingWrapper>
      </PremiumProvider>
    </>
  );

  if (isWebPlatform()) {
    return <WebDemoDeviceFrame>{content}</WebDemoDeviceFrame>;
  }

  return <ReaderProvider>{content}</ReaderProvider>;
}

export default function App() {
  return <AppShell />;
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
