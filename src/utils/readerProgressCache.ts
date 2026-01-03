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
    return { cfi: parsed.cfi, updatedAt };
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
  const payload: CachedCfi = { cfi, updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now() };
  try {
    await AsyncStorage.setItem(keyFor(userId, bookId), JSON.stringify(payload));
  } catch {
    // best-effort
  }
}


