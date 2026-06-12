import { demoSessionId } from '@portfolio/demo-local';
import type { TranslationRequest, TranslationResponse } from '@/supabase/types';
import { isDemoMode } from './config';

export function demoApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_DEMO_API_BASE?.trim();
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/demo`;
  }

  return '';
}

export async function demoTranslate(request: TranslationRequest): Promise<TranslationResponse> {
  const base = demoApiBase();
  if (!base) {
    throw new Error('Demo translation API is not configured.');
  }

  const response = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Session': demoSessionId(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Demo translation failed.');
  }

  return (await response.json()) as TranslationResponse;
}

export function shouldUseLocalDemoData(): boolean {
  return isDemoMode();
}

const GUTENBERG_CACHE_EPUB =
  /^https:\/\/www\.gutenberg\.org\/cache\/epub\/(\d+)\/pg\1(?:-images-3)?\.epub$/i;

export function resolveDemoEpubSrc(epubUrl: string, sourceId?: string | null): string {
  const base = demoApiBase();
  if (!base || !isDemoMode()) {
    return epubUrl;
  }

  const fromSourceId = sourceId?.trim();
  if (fromSourceId) {
    return `${base}/epub?gutenberg_id=${encodeURIComponent(fromSourceId)}`;
  }

  const match = epubUrl.match(GUTENBERG_CACHE_EPUB);
  if (match?.[1]) {
    return `${base}/epub?gutenberg_id=${encodeURIComponent(match[1])}`;
  }

  return `${base}/epub?url=${encodeURIComponent(epubUrl)}`;
}

/** True when src targets the portfolio demo EPUB proxy (not a direct Gutenberg URL). */
export function isDemoEpubProxyUrl(src: string): boolean {
  const base = demoApiBase();
  if (!base) return false;
  return src.startsWith(`${base}/epub`);
}

/** EPUB files are ZIP archives — PK\x03\x04 header. */
export function isProbableEpubZip(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export class DemoEpubFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DemoEpubFetchError';
  }
}

/**
 * Fetch EPUB bytes for epubjs. Required for demo proxy URLs — epubjs resolves
 * META-INF/container.xml relative to /api/demo/ when given a URL string directly.
 */
export async function fetchDemoEpubBuffer(src: string): Promise<ArrayBuffer> {
  const response = await fetch(src, {
    method: 'GET',
    headers: {
      Accept: 'application/epub+zip, application/octet-stream, */*',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new DemoEpubFetchError(
      `Demo EPUB fetch failed (${response.status}). Check /api/demo/epub on the portfolio host.`,
      response.status,
    );
  }

  const buffer = await response.arrayBuffer();
  if (!isProbableEpubZip(buffer)) {
    throw new DemoEpubFetchError(
      'Demo EPUB response is not a valid ZIP archive. The proxy may have returned HTML or an error page.',
    );
  }

  return buffer;
}

/** Load remote EPUB src as ArrayBuffer (always for http(s) demo/proxy URLs). */
export async function loadEpubSourceForWeb(src: string): Promise<string | ArrayBuffer> {
  if (src.startsWith('http://') || src.startsWith('https://') || isDemoEpubProxyUrl(src)) {
    return fetchDemoEpubBuffer(src);
  }
  return src;
}
