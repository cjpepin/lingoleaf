/**
 * focusPackStorage
 *
 * Persists focus-pack and metadata cache in local storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOCUS_PACK_MAX_AGE_MS, type StudyPack, type StudyPackMetadata } from '@/study/focusPack';

const PACK_KEY_PREFIX = 'll_focus_pack_';
const META_KEY_PREFIX = 'll_focus_pack_meta_';
const COMPLETION_KEY_PREFIX = 'll_focus_pack_completion_';

interface StoredFocusPack {
  hash: string;
  pack: StudyPack;
}

interface StoredMetadata {
  hash: string;
  metadata: StudyPackMetadata;
  createdAt: string;
}

interface StoredCompletion {
  packId: string;
  completedAt: string;
}

function isFresh(timestamp: string, now: Date): boolean {
  const createdAt = Date.parse(timestamp);
  return Number.isFinite(createdAt) && now.getTime() - createdAt <= FOCUS_PACK_MAX_AGE_MS;
}

function packKey(userId: string): string {
  return `${PACK_KEY_PREFIX}${userId}`;
}

function metaKey(hash: string): string {
  return `${META_KEY_PREFIX}${hash}`;
}

function completionKey(userId: string): string {
  return `${COMPLETION_KEY_PREFIX}${userId}`;
}

export async function getCachedFocusPack(
  userId: string,
  hash: string,
  now: Date = new Date(),
): Promise<StudyPack | null> {
  try {
    const raw = await AsyncStorage.getItem(packKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFocusPack;
    if (parsed.hash !== hash) return null;
    if (!isFresh(parsed.pack.createdAt, now)) {
      await AsyncStorage.removeItem(packKey(userId));
      return null;
    }
    return parsed.pack;
  } catch {
    return null;
  }
}

export async function getCachedFocusPackAny(
  userId: string,
  now: Date = new Date(),
): Promise<StudyPack | null> {
  try {
    const raw = await AsyncStorage.getItem(packKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFocusPack;
    if (!isFresh(parsed.pack.createdAt, now)) {
      await AsyncStorage.removeItem(packKey(userId));
      return null;
    }
    return parsed.pack;
  } catch {
    return null;
  }
}

export async function saveCachedFocusPack(userId: string, hash: string, pack: StudyPack): Promise<void> {
  try {
    await AsyncStorage.setItem(packKey(userId), JSON.stringify({ hash, pack }));
  } catch {
    // Best-effort cache.
  }
}

export async function getCachedFocusPackMetadata(
  hash: string,
  now: Date = new Date(),
): Promise<StudyPackMetadata | null> {
  try {
    const raw = await AsyncStorage.getItem(metaKey(hash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMetadata;
    if (parsed.hash !== hash) return null;
    if (!isFresh(parsed.createdAt, now)) {
      await AsyncStorage.removeItem(metaKey(hash));
      return null;
    }
    return parsed.metadata;
  } catch {
    return null;
  }
}

export async function saveCachedFocusPackMetadata(hash: string, metadata: StudyPackMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(
      metaKey(hash),
      JSON.stringify({
        hash,
        metadata,
        createdAt: new Date().toISOString(),
      } satisfies StoredMetadata),
    );
  } catch {
    // Best-effort cache.
  }
}

export async function getFocusPackCompletion(
  userId: string,
  packId: string,
  now: Date = new Date(),
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(completionKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCompletion;
    if (parsed.packId !== packId) return null;
    if (!isFresh(parsed.completedAt, now)) {
      await AsyncStorage.removeItem(completionKey(userId));
      return null;
    }
    return parsed.completedAt;
  } catch {
    return null;
  }
}

export async function saveFocusPackCompletion(
  userId: string,
  packId: string,
  completedAt: string = new Date().toISOString(),
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      completionKey(userId),
      JSON.stringify({
        packId,
        completedAt,
      } satisfies StoredCompletion),
    );
  } catch {
    // Best-effort cache.
  }
}
