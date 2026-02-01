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
  loading: boolean;
  setTargetLang: (lang: string) => void;
  loadSettings: (userId: string) => Promise<UserSettings | null>;
  saveSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  targetLang: 'en',
  loading: false,

  setTargetLang: (lang) => set({ targetLang: lang }),

  loadSettings: async (userId) => {
    set({ loading: true });
    try {
      const settings = await fetchUserSettings(userId);
      if (settings) {
        set({ targetLang: settings.target_lang });
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

