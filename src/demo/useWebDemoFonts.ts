/**
 * Preload vector icon fonts on web demo builds so Feather/Ionicons render
 * instead of empty glyph boxes before expo-font injects @font-face rules.
 */

import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { isWebDemo } from '@/demo/config';

const FONT_LOAD_TIMEOUT_MS = 4_000;

export function useWebDemoFontsReady(): boolean {
  const [loaded] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
    ...FontAwesome.font,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isWebDemo() || loaded) {
      return;
    }

    const timer = setTimeout(() => setTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (!isWebDemo()) {
    return true;
  }

  // Do not block the demo forever when static font files 404 (e.g. deploy path issues).
  return loaded || timedOut;
}
