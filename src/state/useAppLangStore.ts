/**
 * useAppLangStore
 * App UI language (en/es).
 * Persisted in user_settings (signed in) or AsyncStorage (guest).
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLang } from '@/i18n/translations';
import { upsertUserSettings } from '@/supabase/queries';

const APP_LANG_KEY = '@lingoleaf:app_lang';

export const APP_LANGS = ['en', 'es'] as const;
export type AppLangCode = (typeof APP_LANGS)[number];

interface AppLangStore {
  appLang: AppLang;
  setAppLang: (lang: AppLang) => void;
  hydrateFromSettings: (s: { app_lang?: string | null } | null) => void;
  hydrateFromStorage: () => Promise<void>;
  persist: (userId: string | null, lang: AppLang) => Promise<void>;
}

export const useAppLangStore = create<AppLangStore>((set) => ({
  appLang: 'en',
  setAppLang: (lang) => set({ appLang: lang }),
  hydrateFromSettings: (s) => {
    const raw = s?.app_lang;
    const lang = raw === 'es' ? 'es' : 'en';
    set({ appLang: lang });
  },
  hydrateFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(APP_LANG_KEY);
      if (raw === 'es') set({ appLang: 'es' });
    } catch {
      // ignore
    }
  },
  persist: async (userId, lang) => {
    set({ appLang: lang });
    try {
      await AsyncStorage.setItem(APP_LANG_KEY, lang);
      if (userId) await upsertUserSettings({ user_id: userId, app_lang: lang });
    } catch {
      // ignore
    }
  },
}));
