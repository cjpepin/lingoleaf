/**
 * readingEngagement
 *
 * Lightweight client-side engagement counters for upgrade prompt milestones.
 * Stored locally (guest users are device-scoped until account upgrade).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = 'll_reading_sessions';
const MINUTES_KEY = 'll_read_minutes';

function key(base: string, userId: string): string {
  return `${base}:${userId}`;
}

export interface ReadingEngagement {
  sessions: number;
  minutes: number;
}

export async function incrementReadingSession(userId: string): Promise<ReadingEngagement> {
  const k = key(SESSIONS_KEY, userId);
  const cur = parseInt((await AsyncStorage.getItem(k)) ?? '0', 10);
  const next = Number.isFinite(cur) ? cur + 1 : 1;
  await AsyncStorage.setItem(k, String(next));
  const minutes = await getReadMinutes(userId);
  return { sessions: next, minutes };
}

export async function addReadMinutes(userId: string, minutesToAdd: number): Promise<ReadingEngagement> {
  const k = key(MINUTES_KEY, userId);
  const cur = parseInt((await AsyncStorage.getItem(k)) ?? '0', 10);
  const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + Math.max(0, Math.floor(minutesToAdd)));
  await AsyncStorage.setItem(k, String(next));
  const sessions = await getReadingSessions(userId);
  return { sessions, minutes: next };
}

export async function getReadingSessions(userId: string): Promise<number> {
  const cur = parseInt((await AsyncStorage.getItem(key(SESSIONS_KEY, userId))) ?? '0', 10);
  return Number.isFinite(cur) ? cur : 0;
}

export async function getReadMinutes(userId: string): Promise<number> {
  const cur = parseInt((await AsyncStorage.getItem(key(MINUTES_KEY, userId))) ?? '0', 10);
  return Number.isFinite(cur) ? cur : 0;
}


