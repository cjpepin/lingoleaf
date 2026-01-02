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

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <ReaderProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </ReaderProvider>
  );
}

