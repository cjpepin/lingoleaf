/**
 * flashcardSessionStorage
 * Persists flashcard session state for resume-on-return.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'll_flashcard_session_';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const FLASHCARD_ALL_KEY = '__all__';

export interface FlashcardSession {
  listId: string;
  listName: string;
  queueWordIds: string[];
  currentIndex: number;
  startedAt: string;
}

function keyFor(listId: string | null): string {
  return `${KEY_PREFIX}${listId ?? FLASHCARD_ALL_KEY}`;
}

export async function getFlashcardSession(listId: string | null): Promise<FlashcardSession | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(listId ?? null));
    if (!raw) return null;
    const session = JSON.parse(raw) as FlashcardSession;
    const startedAt = new Date(session.startedAt).getTime();
    if (Date.now() - startedAt > SESSION_MAX_AGE_MS) {
      await clearFlashcardSession(listId ?? FLASHCARD_ALL_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveFlashcardSession(session: FlashcardSession): Promise<void> {
  const key = session.listId || FLASHCARD_ALL_KEY;
  try {
    await AsyncStorage.setItem(keyFor(key), JSON.stringify({ ...session, listId: key }));
  } catch {
    // Best-effort
  }
}

export async function clearFlashcardSession(listId: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(listId ?? null));
  } catch {
    // Best-effort
  }
}
