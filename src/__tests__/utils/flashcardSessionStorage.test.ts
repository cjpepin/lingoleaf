import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFlashcardSession,
  saveFlashcardSession,
  clearFlashcardSession,
  FLASHCARD_ALL_KEY,
  type FlashcardSession,
} from '@/utils/flashcardSessionStorage';

const makeSession = (overrides?: Partial<FlashcardSession>): FlashcardSession => ({
  listId: 'list-1',
  listName: 'My List',
  queueWordIds: ['w1', 'w2', 'w3'],
  currentIndex: 0,
  startedAt: new Date().toISOString(),
  ...overrides,
});

describe('flashcardSessionStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('saveFlashcardSession + getFlashcardSession', () => {
    it('round-trips a session', async () => {
      const session = makeSession();
      await saveFlashcardSession(session);
      const loaded = await getFlashcardSession('list-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.listName).toBe('My List');
      expect(loaded!.queueWordIds).toEqual(['w1', 'w2', 'w3']);
    });

    it('returns null for non-existent session', async () => {
      const result = await getFlashcardSession('nonexistent');
      expect(result).toBeNull();
    });

    it('uses FLASHCARD_ALL_KEY for null listId', async () => {
      const session = makeSession({ listId: '' });
      await saveFlashcardSession(session);
      const loaded = await getFlashcardSession(null);
      expect(loaded).not.toBeNull();
      expect(loaded!.listId).toBe(FLASHCARD_ALL_KEY);
    });
  });

  describe('session expiry', () => {
    it('returns null for sessions older than 24 hours', async () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const session = makeSession({ startedAt: old });
      await saveFlashcardSession(session);
      const loaded = await getFlashcardSession('list-1');
      expect(loaded).toBeNull();
    });

    it('returns session within 24 hours', async () => {
      const recent = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
      const session = makeSession({ startedAt: recent });
      await saveFlashcardSession(session);
      const loaded = await getFlashcardSession('list-1');
      expect(loaded).not.toBeNull();
    });
  });

  describe('clearFlashcardSession', () => {
    it('removes a saved session', async () => {
      await saveFlashcardSession(makeSession());
      await clearFlashcardSession('list-1');
      const loaded = await getFlashcardSession('list-1');
      expect(loaded).toBeNull();
    });
  });
});
