/**
 * Progress stats for demo mode — computed from IndexedDB seed (mirrors lingoleaf schema).
 */

import { demoFetchOrCreateGardenState } from './demoProfileRepository';
import { demoFetchReadingSessions, demoFetchStudyWords } from './localRepository';
import { demoListVocabReviews } from './demoMutations';

type ProgressRange = 'day' | 'week' | 'month' | 'year';

export interface DemoProgressStats {
  minutesRead: number;
  streakDays: number;
  wordsSaved: number;
  wordsReviewed: number;
  wordsLearned: number;
}

export interface DemoProgressTrendWindowStats {
  minutesRead: number;
  wordsSaved: number;
  wordsReviewed: number;
}

export interface DemoProgressTrendSnapshot {
  windowDays: number;
  current: DemoProgressTrendWindowStats;
  previous: DemoProgressTrendWindowStats;
}

export interface DemoProgressTimelinePoint {
  day: string;
  minutesRead: number;
  wordsSaved: number;
  wordsReviewed: number;
}

export interface DemoProgressTimeline {
  windowDays: number;
  points: DemoProgressTimelinePoint[];
}

function daysForRange(range: ProgressRange): number {
  if (range === 'day') return 1;
  if (range === 'week') return 7;
  if (range === 'month') return 30;
  return 365;
}

function toDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function todayDateKey(timeZone: string): string {
  return toDateKey(new Date().toISOString(), timeZone);
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveSessionDate(endedAt: string | null | undefined, startedAt: string | null | undefined): string | null {
  if (typeof endedAt === 'string' && endedAt.length > 0) return endedAt;
  if (typeof startedAt === 'string' && startedAt.length > 0) return startedAt;
  return null;
}

function computeStreakDays(
  readingSessions: Array<{ started_at: string | null; ended_at: string | null; minutes: number }>,
  timeZone: string,
): number {
  const byDate = new Map<string, number>();
  for (const item of readingSessions) {
    const sessionDate = resolveSessionDate(item.ended_at, item.started_at);
    if (!sessionDate) continue;
    const key = toDateKey(sessionDate, timeZone);
    byDate.set(key, (byDate.get(key) ?? 0) + Math.max(0, item.minutes));
  }

  let streak = 0;
  let cursor = todayDateKey(timeZone);
  while ((byDate.get(cursor) ?? 0) >= 1) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

async function demoWindowStats(
  userId: string,
  sinceMs: number,
  untilMs: number,
): Promise<DemoProgressTrendWindowStats> {
  const since = new Date(sinceMs).toISOString();
  const until = new Date(untilMs).toISOString();
  const [sessions, words, reviews] = await Promise.all([
    demoFetchReadingSessions(userId),
    demoFetchStudyWords(userId),
    demoListVocabReviews(userId),
  ]);

  const minutesRead = sessions
    .filter((row) => {
      const ended = row.ended_at ?? row.started_at;
      return ended && ended >= since && ended < until;
    })
    .reduce((sum, row) => sum + Math.max(0, row.minutes ?? 0), 0);

  const wordsSaved = words.filter((row) => row.created_at >= since && row.created_at < until).length;
  const wordsReviewed = reviews.filter(
    (row) => row.reviewed_at >= since && row.reviewed_at < until,
  ).length;

  return { minutesRead, wordsSaved, wordsReviewed };
}

export async function demoFetchProgressStats(
  userId: string,
  range: ProgressRange,
  timeZone: string,
  wordsLearned: number,
): Promise<DemoProgressStats> {
  const days = daysForRange(range);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const [sessions, words, reviews, gardenState] = await Promise.all([
    demoFetchReadingSessions(userId),
    demoFetchStudyWords(userId),
    demoListVocabReviews(userId),
    demoFetchOrCreateGardenState(userId),
  ]);

  const since = new Date(sinceMs).toISOString();
  const today = range === 'day' ? todayDateKey(timeZone) : null;

  const readingRows = sessions.filter((row) => (row.ended_at ?? row.started_at ?? '') >= since);
  const minutesRead = readingRows.reduce((sum, row) => {
    if (today) {
      const sessionDate = resolveSessionDate(row.ended_at, row.started_at);
      if (!sessionDate || toDateKey(sessionDate, timeZone) !== today) return sum;
    }
    return sum + Math.max(0, row.minutes ?? 0);
  }, 0);

  const wordsSaved =
    range === 'day'
      ? words.filter((row) => row.created_at && toDateKey(row.created_at, timeZone) === today).length
      : words.filter((row) => row.created_at >= since).length;

  const wordsReviewed =
    range === 'day'
      ? reviews.filter((row) => toDateKey(row.reviewed_at, timeZone) === today).length
      : reviews.filter((row) => row.reviewed_at >= since).length;

  const streakDays =
    typeof gardenState.streak_days === 'number'
      ? Math.max(0, Math.floor(gardenState.streak_days))
      : computeStreakDays(
          readingRows.map((row) => ({
            started_at: row.started_at,
            ended_at: row.ended_at,
            minutes: row.minutes,
          })),
          timeZone,
        );

  return {
    minutesRead,
    streakDays,
    wordsSaved,
    wordsReviewed,
    wordsLearned,
  };
}

export async function demoFetchProgressTrendSnapshot(
  userId: string,
  range: ProgressRange,
): Promise<DemoProgressTrendSnapshot> {
  const windowDays = daysForRange(range);
  const now = Date.now();
  const current = await demoWindowStats(userId, now - windowDays * 86400000, now);
  const previous = await demoWindowStats(userId, now - windowDays * 2 * 86400000, now - windowDays * 86400000);
  return { windowDays, current, previous };
}

export async function demoFetchProgressTimeline(
  userId: string,
  range: ProgressRange,
  timeZone: string,
): Promise<DemoProgressTimeline> {
  const windowDays = range === 'day' || range === 'week' ? 7 : range === 'month' ? 30 : 365;
  const today = todayDateKey(timeZone);
  const startDay = addDays(today, -(windowDays - 1));
  const startISO = `${addDays(startDay, -1)}T00:00:00.000Z`;

  const [sessions, words, reviews] = await Promise.all([
    demoFetchReadingSessions(userId),
    demoFetchStudyWords(userId),
    demoListVocabReviews(userId),
  ]);

  const pointsByDay = new Map<string, DemoProgressTimelinePoint>();
  for (let i = 0; i < windowDays; i += 1) {
    const day = addDays(startDay, i);
    pointsByDay.set(day, { day, minutesRead: 0, wordsSaved: 0, wordsReviewed: 0 });
  }

  for (const row of sessions) {
    const sessionDate = resolveSessionDate(row.ended_at, row.started_at);
    if (!sessionDate || sessionDate < startISO) continue;
    const day = toDateKey(sessionDate, timeZone);
    const point = pointsByDay.get(day);
    if (point) point.minutesRead += Math.max(0, row.minutes ?? 0);
  }

  for (const row of words) {
    if (!row.created_at || row.created_at < startISO) continue;
    const day = toDateKey(row.created_at, timeZone);
    const point = pointsByDay.get(day);
    if (point) point.wordsSaved += 1;
  }

  for (const row of reviews) {
    if (!row.reviewed_at || row.reviewed_at < startISO) continue;
    const day = toDateKey(row.reviewed_at, timeZone);
    const point = pointsByDay.get(day);
    if (point) point.wordsReviewed += 1;
  }

  return {
    windowDays,
    points: Array.from(pointsByDay.values()),
  };
}
