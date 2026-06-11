const TRUSTED_HTTPS_HOST = process.env.EXPO_PUBLIC_AUTH_CALLBACK_HOST?.trim() || 'lingoleafapp.com';
const TRUSTED_AUTH_PATH = process.env.EXPO_PUBLIC_AUTH_CALLBACK_PATH?.trim() || '/auth';

export const AUTH_EMAIL_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_CALLBACK_ORIGIN?.trim()
  || `https://${TRUSTED_HTTPS_HOST}${TRUSTED_AUTH_PATH}`;

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function isTrustedCustomScheme(url: URL): boolean {
  if (url.protocol !== 'lingoleaf:') return false;

  const host = url.host.trim().toLowerCase();
  const path = normalizePath(url.pathname);
  return host === 'auth' || path === TRUSTED_AUTH_PATH;
}

function isTrustedHttpsCallback(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  return url.host.trim().toLowerCase() === TRUSTED_HTTPS_HOST
    && normalizePath(url.pathname) === TRUSTED_AUTH_PATH;
}

function readParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (!hash) return params;

  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((value, key) => {
    params.set(key, value);
  });
  return params;
}

export interface AuthCallbackSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function parseTrustedAuthCallback(url: string): AuthCallbackSessionTokens | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!isTrustedCustomScheme(parsed) && !isTrustedHttpsCallback(parsed)) {
    return null;
  }

  const params = readParams(parsed);
  const accessToken = params.get('access_token')?.trim() ?? '';
  const refreshToken = params.get('refresh_token')?.trim() ?? '';
  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export function redactAuthTokens(url: string): string {
  return url
    .replace(/access_token=[^&#]+/gi, 'access_token=REDACTED')
    .replace(/refresh_token=[^&#]+/gi, 'refresh_token=REDACTED');
}
