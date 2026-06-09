/**
 * Ad IDs
 *
 * Uses test IDs by default; override with EXPO_PUBLIC_* env vars for production.
 */

import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

function env(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function bannerUnitId(): string {
  const ios = env('EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS');
  const android = env('EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID');
  const id = Platform.OS === 'ios' ? ios : android;
  return id ?? TestIds.BANNER;
}


