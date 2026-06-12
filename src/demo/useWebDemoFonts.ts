/**
 * Preload vector icon fonts on web demo builds so Feather/Ionicons render
 * instead of empty glyph boxes before expo-font injects @font-face rules.
 */

import { useFonts } from 'expo-font';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { isWebDemo } from '@/demo/config';

export function useWebDemoFontsReady(): boolean {
  const [loaded] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
    ...FontAwesome.font,
  });

  return !isWebDemo() || loaded;
}
