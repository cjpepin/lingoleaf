/**
 * App entry point
 * Initializes auth and renders navigation
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ReaderProvider } from '@epubjs-react-native/core';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/state/useAuthStore';
import { OnboardingWrapper } from './src/components/OnboardingWrapper';
import mobileAds from 'react-native-google-mobile-ads';
import { logger } from './src/utils/logger';
import { supabaseConfigured, supabase } from './src/supabase/client';
import { colors, spacing, typography } from './src/theme';
import * as Linking from 'expo-linking';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    if (!supabaseConfigured) {
      logger.error('Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY for production builds.');
      return;
    }
    initialize();
  }, []);

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
      logger.info('Deep link received:', url);

      // Check if this is a Supabase auth callback
      if (url.includes('#access_token=') || url.includes('?access_token=')) {
        try {
          // Parse the URL to extract tokens
          const hashParams = new URLSearchParams(url.split('#')[1] || '');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session using the tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              logger.error('Failed to set session from URL:', error);
              Alert.alert('Authentication Error', 'Failed to confirm your email. Please try again.');
              return;
            }

            if (data.session) {
              logger.info('Email confirmed, session established');
              Alert.alert('Email Confirmed!', 'Your account has been verified. You can now use all features.');
            }
          }
        } catch (e) {
          logger.error('Deep link auth error:', e);
        }
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
      <OnboardingWrapper>
        <RootNavigator />
      </OnboardingWrapper>
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

