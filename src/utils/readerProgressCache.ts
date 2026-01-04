/**
 * readerProgressCache
 *
 * Fast local cache for last read CFI per book.
 * Used to resume instantly without waiting on Supabase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedCfi {
  cfi: string;
  updatedAt: number; // epoch ms
  // Best-effort "page" cache: location index within the generated locations list.
  // This is only used to display an instant page number while the reader initializes.
  locationIndex0?: number;
  totalLocations?: number;
}

function keyFor(userId: string | null, bookId: string): string {
  const owner = userId && userId.length > 0 ? userId : 'device';
  return `ll_reader_last_cfi:${owner}:${bookId}`;
}

export async function getCachedLastCfi(userId: string | null, bookId: string): Promise<CachedCfi | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, bookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCfi>;
    if (!parsed?.cfi || typeof parsed.cfi !== 'string') return null;
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
    // Return all cached fields including locationIndex0 and totalLocations
    return {
      cfi: parsed.cfi,
      updatedAt,
      locationIndex0: typeof parsed.locationIndex0 === 'number' ? parsed.locationIndex0 : undefined,
      totalLocations: typeof parsed.totalLocations === 'number' ? parsed.totalLocations : undefined,
    };
  } catch {
    return null;
  }
}

export async function setCachedLastCfi(
  userId: string | null,
  bookId: string,
  cfi: string,
  updatedAt?: number
): Promise<void> {
  if (!cfi) return;
  const key = keyFor(userId, bookId);
  const nextUpdatedAt = typeof updatedAt === 'number' ? updatedAt : Date.now();
  try {
    // IMPORTANT: merge with any existing cached "page" fields so we don't wipe them out
    // when we only want to update the CFI.
    const rawExisting = await AsyncStorage.getItem(key);
    const existing = rawExisting ? (JSON.parse(rawExisting) as Partial<CachedCfi>) : null;

    const payload: CachedCfi = {
      cfi,
      updatedAt: nextUpdatedAt,
      locationIndex0:
        typeof existing?.locationIndex0 === 'number' && Number.isFinite(existing.locationIndex0)
          ? existing.locationIndex0
          : undefined,
      totalLocations:
        typeof existing?.totalLocations === 'number' && Number.isFinite(existing.totalLocations)
          ? existing.totalLocations
          : undefined,
    };

    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // best-effort
  }
}

export async function setCachedLastPosition(
  userId: string | null,
  bookId: string,
  position: { cfi: string; locationIndex0: number; totalLocations?: number },
  updatedAt?: number
): Promise<void> {
  if (!position?.cfi) return;
  if (!Number.isFinite(position.locationIndex0) || position.locationIndex0 < 0) return;
  const payload: CachedCfi = {
    cfi: position.cfi,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
    locationIndex0: Math.floor(position.locationIndex0),
    totalLocations: typeof position.totalLocations === 'number' && Number.isFinite(position.totalLocations) ? Math.floor(position.totalLocations) : undefined,
  };
  try {
    await AsyncStorage.setItem(keyFor(userId, bookId), JSON.stringify(payload));
  } catch {
    // best-effort
  }
}


