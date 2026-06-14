/**
 * Client-side ad display toggles (local dev / recording builds).
 */

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** Set EXPO_PUBLIC_ADS_DISABLED=true in .env to hide banners and skip AdMob init. */
export function areAdsEnabled(): boolean {
  return readEnv('EXPO_PUBLIC_ADS_DISABLED') !== 'true';
}
