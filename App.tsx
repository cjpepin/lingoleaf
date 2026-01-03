/**
 * App entry point
 * Initializes auth and renders navigation
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ReaderProvider } from '@epubjs-react-native/core';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/state/useAuthStore';
import mobileAds from 'react-native-google-mobile-ads';
import { logger } from './src/utils/logger';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    // Ensure AdMob is initialized (some setups won't render ads until init completes).
    mobileAds()
      .initialize()
      .then((s) => logger.info('MobileAds initialized', { status: s }))
      .catch((e) => logger.warn('MobileAds init failed', e));
  }, []);

  return (
    <ReaderProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </ReaderProvider>
  );
}

