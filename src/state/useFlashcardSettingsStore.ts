/**
 * useFlashcardSettingsStore
 * Flashcard interval settings (Again/Hard/Good/Easy).
 * Persisted in user_settings, loaded with useSettingsStore.
 */

import { create } from 'zustand';

export const AGAIN_CARDS_MIN = 1;
export const AGAIN_CARDS_MAX = 5;
export const AGAIN_CARDS_DEFAULT = 2;

export const INTERVAL_HARD_MIN = 5;
export const INTERVAL_HARD_MAX = 60;
export const INTERVAL_HARD_DEFAULT = 10;

export const INTERVAL_GOOD_MIN = 60; // 1 hour
export const INTERVAL_GOOD_MAX = 7 * 24 * 60; // 7 days
export const INTERVAL_GOOD_DEFAULT = 24 * 60; // 1 day

export const INTERVAL_EASY_MIN = 24 * 60; // 1 day
export const INTERVAL_EASY_MAX = 30 * 24 * 60; // 30 days
export const INTERVAL_EASY_DEFAULT = 3 * 24 * 60; // 3 days

export const MULTIPLIER_MIN = 1.25;
export const MULTIPLIER_MAX = 3;
export const MULTIPLIER_DEFAULT = 2;

export type StudyMethod = 'spaced' | 'free';

export interface FlashcardIntervalSettings {
  againCards: number;
  intervalHardMin: number;
  intervalGoodMin: number;
  intervalEasyMin: number;
  multiplier: number;
}

interface FlashcardSettingsStore extends FlashcardIntervalSettings {
  preferredStudyMethod: StudyMethod;
  setPreferredStudyMethod: (v: StudyMethod) => void;
  setAgainCards: (v: number) => void;
  setIntervalHardMin: (v: number) => void;
  setIntervalGoodMin: (v: number) => void;
  setIntervalEasyMin: (v: number) => void;
  setMultiplier: (v: number) => void;
  hydrateFromSettings: (s: {
    flashcard_again_cards?: number;
    flashcard_interval_hard_min?: number;
    flashcard_interval_good_min?: number;
    flashcard_interval_easy_min?: number;
    flashcard_interval_multiplier?: number;
    flashcard_preferred_study_method?: string;
  } | null) => void;
  getSettings: () => FlashcardIntervalSettings;
}

export const useFlashcardSettingsStore = create<FlashcardSettingsStore>((set, get) => ({
  againCards: AGAIN_CARDS_DEFAULT,
  intervalHardMin: INTERVAL_HARD_DEFAULT,
  intervalGoodMin: INTERVAL_GOOD_DEFAULT,
  intervalEasyMin: INTERVAL_EASY_DEFAULT,
  multiplier: MULTIPLIER_DEFAULT,
  preferredStudyMethod: 'spaced',
  setPreferredStudyMethod: (v) => set({ preferredStudyMethod: v }),
  setAgainCards: (v) => set({ againCards: Math.min(AGAIN_CARDS_MAX, Math.max(AGAIN_CARDS_MIN, v)) }),
  setIntervalHardMin: (v) => set({ intervalHardMin: Math.min(INTERVAL_HARD_MAX, Math.max(INTERVAL_HARD_MIN, v)) }),
  setIntervalGoodMin: (v) => set({ intervalGoodMin: Math.min(INTERVAL_GOOD_MAX, Math.max(INTERVAL_GOOD_MIN, v)) }),
  setIntervalEasyMin: (v) => set({ intervalEasyMin: Math.min(INTERVAL_EASY_MAX, Math.max(INTERVAL_EASY_MIN, v)) }),
  setMultiplier: (v) => set({ multiplier: Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, v)) }),
  hydrateFromSettings: (s) =>
    set({
      againCards: Math.min(AGAIN_CARDS_MAX, Math.max(AGAIN_CARDS_MIN, s?.flashcard_again_cards ?? AGAIN_CARDS_DEFAULT)),
      intervalHardMin: Math.min(INTERVAL_HARD_MAX, Math.max(INTERVAL_HARD_MIN, s?.flashcard_interval_hard_min ?? INTERVAL_HARD_DEFAULT)),
      intervalGoodMin: Math.min(INTERVAL_GOOD_MAX, Math.max(INTERVAL_GOOD_MIN, s?.flashcard_interval_good_min ?? INTERVAL_GOOD_DEFAULT)),
      intervalEasyMin: Math.min(INTERVAL_EASY_MAX, Math.max(INTERVAL_EASY_MIN, s?.flashcard_interval_easy_min ?? INTERVAL_EASY_DEFAULT)),
      multiplier: Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, s?.flashcard_interval_multiplier ?? MULTIPLIER_DEFAULT)),
      preferredStudyMethod: (s?.flashcard_preferred_study_method === 'free' ? 'free' : 'spaced') as StudyMethod,
    }),
  getSettings: () => ({
    againCards: get().againCards,
    intervalHardMin: get().intervalHardMin,
    intervalGoodMin: get().intervalGoodMin,
    intervalEasyMin: get().intervalEasyMin,
    multiplier: get().multiplier,
  }),
}));
