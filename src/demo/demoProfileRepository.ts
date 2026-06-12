import {
  getStoreRecord,
  listStoreRecords,
  putStoreRecord,
} from '@portfolio/demo-local';
import type {
  UserGardenDailyProgress,
  UserGardenState,
  UserSettings,
} from '@/supabase/types';
import { ensureDemoHydrated } from './localRepository';
import { getDb } from './demoDb';

function settingsKey(userId: string): string {
  return userId;
}

export async function demoFetchUserSettings(userId: string): Promise<UserSettings | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  const row = await getStoreRecord<UserSettings>(db, 'user_settings', settingsKey(userId));
  return row;
}

export async function demoUpsertUserSettings(
  settings: Partial<UserSettings> & Pick<UserSettings, 'user_id'>,
): Promise<UserSettings> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await demoFetchUserSettings(settings.user_id);
  const now = new Date().toISOString();
  const next: UserSettings = {
    target_lang: 'en',
    native_lang: 'en',
    known_langs: ['en'],
    goal_langs: ['es', 'fr'],
    daily_reading_goal_minutes: 15,
    daily_words_saved_goal: 10,
    daily_words_learned_goal: 5,
    primary_goal: 'reading_minutes',
    goal_priority: ['reading_minutes', 'words_saved', 'words_learned'],
    auto_remove_downloads_after_days: 14,
    ...existing,
    ...settings,
    user_id: settings.user_id,
    updated_at: now,
    created_at: existing?.created_at ?? now,
  };
  await putStoreRecord(db, 'user_settings', settingsKey(settings.user_id), next);
  return next;
}

export async function demoFetchOrCreateGardenState(userId: string): Promise<UserGardenState> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<UserGardenState>(db, 'user_garden_state', userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: UserGardenState = {
    user_id: userId,
    total_gp: 85,
    stage: 'sprout',
    freshness: 'fresh',
    streak_days: 4,
    last_goal_completed_on: '2025-06-09',
    last_activity_on: '2025-06-09',
    unlocks: [],
    created_at: now,
    updated_at: now,
  };
  await putStoreRecord(db, 'user_garden_state', userId, created);
  return created;
}

export async function demoUpsertGardenState(state: UserGardenState): Promise<UserGardenState> {
  await ensureDemoHydrated();
  const db = await getDb();
  const next: UserGardenState = {
    ...state,
    updated_at: new Date().toISOString(),
  };
  await putStoreRecord(db, 'user_garden_state', state.user_id, next);
  return next;
}

export async function demoFetchGardenDailyProgress(
  userId: string,
  day: string,
): Promise<UserGardenDailyProgress | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  return getStoreRecord<UserGardenDailyProgress>(db, 'user_garden_daily_progress', `${userId}:${day}`);
}

export async function demoUpsertGardenDailyProgress(
  progress: UserGardenDailyProgress,
): Promise<UserGardenDailyProgress> {
  await ensureDemoHydrated();
  const db = await getDb();
  const next: UserGardenDailyProgress = {
    ...progress,
    updated_at: new Date().toISOString(),
  };
  await putStoreRecord(
    db,
    'user_garden_daily_progress',
    `${progress.user_id}:${progress.day}`,
    next,
  );
  return next;
}

export async function demoFetchRecentGardenGoalCompletion(
  userId: string,
  day: string,
  lookbackDays: number,
): Promise<{ daysMet: number; daysConsidered: number; completionRate: number }> {
  await ensureDemoHydrated();
  const db = await getDb();
  const safeDays = Math.max(1, Math.floor(lookbackDays));
  const rows = await listStoreRecords<UserGardenDailyProgress>(db, 'user_garden_daily_progress');
  const startDay = addDays(day, -(safeDays - 1));
  const daysMet = rows
    .filter((row) => row.user_id === userId)
    .filter((row) => row.day >= startDay && row.day <= day)
    .reduce((sum, row) => (row.goal_completed ? sum + 1 : sum), 0);

  return {
    daysMet,
    daysConsidered: safeDays,
    completionRate: safeDays > 0 ? daysMet / safeDays : 0,
  };
}


function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + delta));
  return next.toISOString().slice(0, 10);
}
