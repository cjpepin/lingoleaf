/**
 * useUpgradePromptStore
 *
 * Small prompt engine that decides if/when to show the "Upgrade account" prompt.
 * Enforces anti-spam rules:
 * - guest-only
 * - per-session max once
 * - 7-day cooldown
 * - dismiss count < 3
 * - only once per milestone reason
 */

import { create } from 'zustand';
import { fetchUserPromptState, upsertUserPromptState } from '@/supabase/queries';

export type UpgradePromptReason = 'vocab_10' | 'highlights_5' | 'read_sessions';

interface UpgradePromptStore {
  visible: boolean;
  reason: UpgradePromptReason | null;
  shownThisSession: boolean;
  requestShow: (userId: string, reason: UpgradePromptReason, opts: { isGuest: boolean }) => Promise<boolean>;
  dismiss: (userId: string) => Promise<void>;
  close: () => void;
}

const COOLDOWN_DAYS = 7;

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

export const useUpgradePromptStore = create<UpgradePromptStore>((set, get) => ({
  visible: false,
  reason: null,
  shownThisSession: false,

  requestShow: async (userId, reason, opts) => {
    if (!opts.isGuest) return false;
    if (get().shownThisSession) return false;

    const state = await fetchUserPromptState(userId);
    const dismissCount = state?.upgrade_prompt_dismiss_count ?? 0;
    if (dismissCount >= 3) return false;

    const lastAt = state?.last_upgrade_prompt_at;
    if (lastAt && daysAgo(lastAt) < COOLDOWN_DAYS) return false;

    const lastReason = state?.upgrade_prompt_last_reason;
    if (lastReason === reason) return false;

    const now = new Date().toISOString();
    await upsertUserPromptState({
      user_id: userId,
      last_upgrade_prompt_at: now,
      upgrade_prompt_last_reason: reason,
      upgrade_prompt_dismiss_count: dismissCount,
    });

    set({ visible: true, reason, shownThisSession: true });
    return true;
  },

  dismiss: async (userId) => {
    const state = await fetchUserPromptState(userId);
    const dismissCount = (state?.upgrade_prompt_dismiss_count ?? 0) + 1;
    const now = new Date().toISOString();
    await upsertUserPromptState({
      user_id: userId,
      last_upgrade_prompt_at: now,
      upgrade_prompt_last_reason: state?.upgrade_prompt_last_reason ?? get().reason ?? null,
      upgrade_prompt_dismiss_count: dismissCount,
    });
    set({ visible: false, reason: null });
  },

  close: () => set({ visible: false, reason: null }),
}));


