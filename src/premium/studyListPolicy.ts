import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_STUDY_LIST_CAP = 5;
export const PREMIUM_STUDY_LIST_CAP = 200;
export const STUDY_LIST_CREATION_RATE_LIMIT_PER_HOUR = 20;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const STORAGE_KEY_PREFIX = '@lingoleaf:study_list_created_at';

type EligibilityResult =
  | { ok: true; maxLists: number }
  | { ok: false; maxLists: number; reason: 'list_cap' | 'rate_limit'; message: string };

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

async function getRecentCreationTimestamps(userId: string): Promise<number[]> {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const raw = await AsyncStorage.getItem(getStorageKey(userId));
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    parsed = [];
  }

  const timestamps = Array.isArray(parsed) ? parsed.filter(isValidTimestamp) : [];
  const recent = timestamps.filter((ts) => ts >= cutoff);
  if (recent.length !== timestamps.length) {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(recent));
  }
  return recent;
}

export function getStudyListCap(isPremium: boolean): number {
  return isPremium ? PREMIUM_STUDY_LIST_CAP : FREE_STUDY_LIST_CAP;
}

export function getStudyListLimitMessage(maxLists: number): string {
  return `List limit reached (max ${maxLists})`;
}

export async function checkStudyListCreationEligibility(
  userId: string,
  currentListCount: number,
  isPremium: boolean
): Promise<EligibilityResult> {
  const maxLists = getStudyListCap(isPremium);
  if (currentListCount >= maxLists) {
    return {
      ok: false,
      maxLists,
      reason: 'list_cap',
      message: getStudyListLimitMessage(maxLists),
    };
  }

  const recent = await getRecentCreationTimestamps(userId);
  if (recent.length >= STUDY_LIST_CREATION_RATE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      maxLists,
      reason: 'rate_limit',
      message: 'You are creating lists too quickly. Please wait and try again.',
    };
  }

  return { ok: true, maxLists };
}

export async function recordStudyListCreated(userId: string): Promise<void> {
  const recent = await getRecentCreationTimestamps(userId);
  recent.push(Date.now());
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(recent));
}
