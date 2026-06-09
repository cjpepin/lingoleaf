import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeUserId(userId: string | null | undefined): string | null {
  if (typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function tutorialSeenKey(baseKey: string, userId?: string | null): string {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return baseKey;
  return `${baseKey}:${normalizedUserId}`;
}

export async function hasSeenTutorial(baseKey: string, userId?: string | null): Promise<boolean> {
  const scopedKey = tutorialSeenKey(baseKey, userId);
  const scopedSeen = await AsyncStorage.getItem(scopedKey);
  if (scopedSeen === 'true') return true;

  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;

  // Legacy migration path from global tutorial key to per-user key.
  const legacySeen = await AsyncStorage.getItem(baseKey);
  if (legacySeen !== 'true') return false;

  await AsyncStorage.setItem(scopedKey, 'true');
  return true;
}

export async function markTutorialSeen(baseKey: string, userId?: string | null): Promise<void> {
  const scopedKey = tutorialSeenKey(baseKey, userId);
  await AsyncStorage.setItem(scopedKey, 'true');
}
