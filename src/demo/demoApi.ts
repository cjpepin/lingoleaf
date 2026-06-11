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
