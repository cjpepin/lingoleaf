export type GardenStage =
  | 'seed'
  | 'sprout'
  | 'sapling'
  | 'young_tree'
  | 'mature_tree'
  | 'blooming_tree'
  | 'ancient_tree';
export type GardenFreshness = 'fresh' | 'resting' | 'dead';
export type GardenProgressSource = 'reading' | 'saved' | 'learned' | 'manual';
export type PrimaryGoal = 'reading_minutes' | 'words_saved' | 'words_learned';

export interface GardenProgressInput {
  readingMinutes?: number;
  savedCount?: number;
  learnedCount?: number;
  source?: GardenProgressSource;
}

export interface GardenDailyProgress {
  user_id: string;
  day: string;
  reading_minutes: number;
  saved_count: number;
  learned_count: number;
  gp_awarded: number;
  goal_completed: boolean;
  streak_bonus_awarded: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GardenState {
  user_id: string;
  total_gp: number;
  stage: GardenStage;
  freshness: GardenFreshness;
  streak_days: number;
  last_goal_completed_on: string | null;
  last_activity_on: string | null;
  unlocks: string[];
  created_at?: string;
  updated_at?: string;
}

export interface GardenProgressComputation {
  nextDaily: GardenDailyProgress;
  deltaGp: number;
  goalCompletedNow: boolean;
  streakBonusAwardedNow: boolean;
  nextStreakDays: number;
}

const DAILY_READING_CAP_MULTIPLIER = 1;
const DAILY_SAVED_CAP = 15;
const DAILY_LEARNED_CAP = 10;
const DAILY_GP_CAP = 40;
const GOAL_COMPLETION_BONUS = 5;
const STREAK_EXTENSION_BONUS = 5;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toDateFromKey(day: string): Date {
  const [year, month, date] = day.split('-').map((v) => parseInt(v, 10));
  return new Date(Date.UTC(year, month - 1, date));
}

export function addDays(day: string, deltaDays: number): string {
  const d = toDateFromKey(day);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveGardenStage(totalGpRaw: number): GardenStage {
  const totalGp = Math.max(0, Math.floor(totalGpRaw));
  if (totalGp >= 1400) return 'ancient_tree';
  if (totalGp >= 900) return 'blooming_tree';
  if (totalGp >= 560) return 'mature_tree';
  if (totalGp >= 280) return 'young_tree';
  if (totalGp >= 120) return 'sapling';
  if (totalGp >= 40) return 'sprout';
  return 'seed';
}

const STAGE_THRESHOLDS = [0, 40, 120, 280, 560, 900, 1400];

/** Drop total_gp to the threshold of one stage below the current stage. Seed (0) cannot regress. */
export function regressGardenGp(totalGp: number): number {
  const gp = Math.max(0, Math.floor(totalGp));
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 1; i--) {
    if (gp >= STAGE_THRESHOLDS[i]) return STAGE_THRESHOLDS[i - 1];
  }
  return 0;
}

export function resolveGardenFreshness(lastActivityOn: string | null, today = localDateKey()): GardenFreshness {
  // New users should start in a healthy/fresh state and only gray out after inactivity.
  if (!lastActivityOn) return 'fresh';
  if (lastActivityOn === today) return 'fresh';
  const oneDayAgo = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  if (lastActivityOn === oneDayAgo || lastActivityOn === twoDaysAgo) return 'resting';
  return 'dead';
}

export function emptyDailyProgress(userId: string, day: string): GardenDailyProgress {
  return {
    user_id: userId,
    day,
    reading_minutes: 0,
    saved_count: 0,
    learned_count: 0,
    gp_awarded: 0,
    goal_completed: false,
    streak_bonus_awarded: false,
  };
}

export function computeGardenProgressUpdate(
  params: {
    daily: GardenDailyProgress;
    input: GardenProgressInput;
    goalMinutes: number;
    savedGoal: number;
    learnedGoal: number;
    primaryGoal: PrimaryGoal;
    day: string;
    state: Pick<GardenState, 'streak_days' | 'last_goal_completed_on'>;
  }
): GardenProgressComputation {
  const { daily, input, day, state, primaryGoal } = params;
  const goalMinutes = clampInt(params.goalMinutes, 5, 60);
  const savedGoal = clampInt(params.savedGoal, 5, 50);
  const learnedGoal = clampInt(params.learnedGoal, 1, 15);

  const readingIncoming = Math.max(0, Math.floor(input.readingMinutes ?? 0));
  const savedIncoming = Math.max(0, Math.floor(input.savedCount ?? 0));
  const learnedIncoming = Math.max(0, Math.floor(input.learnedCount ?? 0));

  // Daily counters track full activity and should not be capped at goal values.
  const nextReading = daily.reading_minutes + readingIncoming;
  const nextSaved = daily.saved_count + savedIncoming;
  const nextLearned = daily.learned_count + learnedIncoming;

  // GP accrual remains capped per metric to protect progression balance.
  const deltaReading = Math.max(
    0,
    Math.min(goalMinutes, nextReading) - Math.min(goalMinutes, daily.reading_minutes)
  );
  const deltaSaved = Math.max(
    0,
    Math.min(DAILY_SAVED_CAP, nextSaved) - Math.min(DAILY_SAVED_CAP, daily.saved_count)
  );
  const deltaLearned = Math.max(
    0,
    Math.min(DAILY_LEARNED_CAP, nextLearned) - Math.min(DAILY_LEARNED_CAP, daily.learned_count)
  );

  let rawDeltaGp =
    deltaReading * DAILY_READING_CAP_MULTIPLIER +
    deltaSaved +
    deltaLearned * 2;

  let goalCompletedNow = false;
  if (primaryGoal === 'words_saved') {
    goalCompletedNow = !daily.goal_completed && daily.saved_count < savedGoal && nextSaved >= savedGoal;
  } else if (primaryGoal === 'words_learned') {
    goalCompletedNow = !daily.goal_completed && daily.learned_count < learnedGoal && nextLearned >= learnedGoal;
  } else {
    goalCompletedNow = !daily.goal_completed && daily.reading_minutes < goalMinutes && nextReading >= goalMinutes;
  }
  if (goalCompletedNow) {
    rawDeltaGp += GOAL_COMPLETION_BONUS;
  }

  const previousDay = addDays(day, -1);
  const streakBonusAwardedNow =
    goalCompletedNow &&
    !daily.streak_bonus_awarded &&
    state.last_goal_completed_on === previousDay;

  if (streakBonusAwardedNow) {
    rawDeltaGp += STREAK_EXTENSION_BONUS;
  }

  const remainingGp = Math.max(0, DAILY_GP_CAP - daily.gp_awarded);
  const deltaGp = Math.max(0, Math.min(rawDeltaGp, remainingGp));

  let nextStreakDays = state.streak_days;
  if (goalCompletedNow) {
    nextStreakDays = state.last_goal_completed_on === previousDay ? state.streak_days + 1 : 1;
  }

  return {
    nextDaily: {
      ...daily,
      reading_minutes: nextReading,
      saved_count: nextSaved,
      learned_count: nextLearned,
      gp_awarded: daily.gp_awarded + deltaGp,
      goal_completed: daily.goal_completed || goalCompletedNow,
      streak_bonus_awarded: daily.streak_bonus_awarded || streakBonusAwardedNow,
    },
    deltaGp,
    goalCompletedNow,
    streakBonusAwardedNow,
    nextStreakDays,
  };
}
