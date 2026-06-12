/**
 * Web demo configuration for portfolio embedding at /lingoleaf/demo.
 *
 * Browser demo data is hydrated from src/demo/seed.json — kept in sync with
 * supabase/demo/seed.sql (lingoleaf schema). Writes stay in IndexedDB per session.
 */

import { Platform } from 'react-native';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export const WEB_BASE_PATH = readEnv('EXPO_PUBLIC_WEB_BASE_PATH') || '/lingoleaf/demo';

export function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}

export function isDemoMode(): boolean {
  return readEnv('EXPO_PUBLIC_DEMO_MODE') === 'true' || isWebPlatform();
}

export function isWebDemo(): boolean {
  return isWebPlatform() && isDemoMode();
}

/** Portfolio preview iframe — render at native device size without marketing chrome. */
export function isEmbedMode(): boolean {
  if (!isWebPlatform()) return false;
  if (readEnv('EXPO_PUBLIC_EMBED_MODE') === 'true') return true;
  if (typeof window !== 'undefined') {
    if (window.self !== window.top) return true;
    return window.location.pathname.includes('/embed');
  }
  return false;
}

export function webLinkingPrefix(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = WEB_BASE_PATH.endsWith('/') ? WEB_BASE_PATH.slice(0, -1) : WEB_BASE_PATH;
    return `${window.location.origin}${base}`;
  }
  return WEB_BASE_PATH;
}

export function normalizeWebBasePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.endsWith('/') && withLeading.length > 1
    ? withLeading.slice(0, -1)
    : withLeading;
}
