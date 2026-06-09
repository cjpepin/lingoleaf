/**
 * Settings state management
 * Handles user preferences like target language
 */

import { create } from 'zustand';
import { fetchUserSettings, upsertUserSettings } from '@/supabase/queries';
import type { UserSettings } from '@/supabase/types';
import { useReaderSettingsStore } from './useReaderSettingsStore';
import { useFlashcardSettingsStore } from './useFlashcardSettingsStore';
import { useAppLangStore } from './useAppLangStore';

interface SettingsStore {
  targetLang: string;
  /** Remove local book files if not read in this many days; 0 = never. */
  autoRemoveDownloadsAfterDays: number;
  loading: boolean;
  /** Pass userId to persist immediately (e.g. when user changes it in profile). */
  setTargetLang: (lang: string, userId?: string) => void;
  loadSettings: (userId: string) => Promise<UserSettings | null>;
  saveSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  targetLang: 'en',
  autoRemoveDownloadsAfterDays: 14,
  loading: false,

  setTargetLang: (lang, userId) => {
    set({ targetLang: lang });
    if (userId) {
      get()
        .saveSettings(userId)
        .catch((err) => console.error('Failed to persist target language', err));
    }
  },

  loadSettings: async (userId) => {
    set({ loading: true });
    try {
      const settings = await fetchUserSettings(userId);
      if (settings) {
        set({
          targetLang: settings.target_lang,
          autoRemoveDownloadsAfterDays: settings.auto_remove_downloads_after_days ?? 14,
        });
        useReaderSettingsStore.getState().hydrateFromSettings(settings);
        useFlashcardSettingsStore.getState().hydrateFromSettings(settings);
        useAppLangStore.getState().hydrateFromSettings(settings);
      }
      return settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  saveSettings: async (userId) => {
    const { targetLang } = get();
    try {
      await upsertUserSettings({
        user_id: userId,
        target_lang: targetLang,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },
}));

