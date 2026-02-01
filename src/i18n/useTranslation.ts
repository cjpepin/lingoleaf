/**
 * useTranslation
 * Returns t(key, params?) for the current app language.
 */

import { useAppLangStore } from '@/state/useAppLangStore';
import { t } from './translations';

export function useTranslation() {
  const lang = useAppLangStore((s) => s.appLang);
  return (key: string, params?: Record<string, string | number>) => t(lang, key, params);
}
