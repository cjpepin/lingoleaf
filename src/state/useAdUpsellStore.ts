/**
 * Tracks ad impressions and controls soft premium upsell visibility.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { track } from '@/analytics/client';

const STORAGE_KEYS = {
  count: 'll_ad_impressions_count',
  shownDate: 'll_premium_soft_upsell_shown_date',
} as const;

const SOFT_UPSELL_THRESHOLD = 10;

interface AdUpsellStore {
  hydrated: boolean;
  visible: boolean;
  impressionCount: number;
  hydrate: () => Promise<void>;
  recordImpression: (isPremium: boolean) => Promise<void>;
  dismiss: () => void;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useAdUpsellStore = create<AdUpsellStore>((set, get) => ({
  hydrated: false,
  visible: false,
  impressionCount: 0,

  hydrate: async () => {
    if (get().hydrated) return;

    const [countRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.count),
      AsyncStorage.getItem(STORAGE_KEYS.shownDate),
    ]);

    const parsed = Number.parseInt(countRaw ?? '0', 10);
    set({
      hydrated: true,
      impressionCount: Number.isFinite(parsed) ? parsed : 0,
    });
  },

  recordImpression: async (isPremium: boolean) => {
    if (!get().hydrated) await get().hydrate();
    if (isPremium) return;

    const nextCount = get().impressionCount + 1;
    set({ impressionCount: nextCount });
    await AsyncStorage.setItem(STORAGE_KEYS.count, String(nextCount));

    const shownDate = await AsyncStorage.getItem(STORAGE_KEYS.shownDate);
    if (nextCount < SOFT_UPSELL_THRESHOLD) return;
    if (shownDate === todayDateKey()) return;
    if (get().visible) return;

    await AsyncStorage.setItem(STORAGE_KEYS.shownDate, todayDateKey());
    set({ visible: true });

    track('ad_removed_seen', {
      impression_count: nextCount,
    });
  },

  dismiss: () => {
    set({ visible: false });
  },
}));
