/**
 * useStudyStore
 *
 * Persisted cache for vocab lists + study words to avoid re-fetching on every screen focus.
 * Demo mode skips AsyncStorage persistence and always refetches so counts match Home.
 */

import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudyWord, VocabList } from '@/supabase/types';
import {
  countAllStudyWords,
  countStudyWordsForList,
  fetchStudyWords,
  fetchVocabLists,
} from '@/supabase/queries';
import { isDemoMode } from '@/demo/config';

type WordsByList = Record<string, StudyWord[]>;

interface StudyCache {
  userId: string | null;
  lists: VocabList[];
  counts: Record<string, number>;
  allCount: number;
  wordsByList: WordsByList;
  wordsLoadedAt: Record<string, number>;
  listsLoadedAt: number | null;
}

interface StudyStore extends StudyCache {
  hydrateForUser: (userId: string) => void;
  getCachedWords: (listId: string | null) => StudyWord[] | null;
  refreshListsAndCounts: (userId: string, opts?: { force?: boolean }) => Promise<void>;
  refreshWordsForList: (userId: string, listId: string, opts?: { force?: boolean }) => Promise<void>;
  upsertWordInCache: (listId: string | null, word: StudyWord) => void;
  removeWordFromCache: (listId: string | null, wordId: string) => void;
  addListToCache: (list: VocabList) => void;
  updateListInCache: (list: VocabList) => void;
  removeListFromCache: (listId: string) => void;
  adjustAllCount: (delta: number) => void;
  adjustListCount: (listId: string, delta: number) => void;
  clear: () => void;
}

const PROD_LISTS_TTL_MS = 5 * 60 * 1000;
const PROD_WORDS_TTL_MS = 5 * 60 * 1000;

function listsTtlMs(): number {
  return isDemoMode() ? 0 : PROD_LISTS_TTL_MS;
}

function wordsTtlMs(): number {
  return isDemoMode() ? 0 : PROD_WORDS_TTL_MS;
}

function now(): number {
  return Date.now();
}

const createStudyStoreState: StateCreator<StudyStore> = (set, get) => ({
  userId: null,
  lists: [],
  counts: {},
  allCount: 0,
  wordsByList: {},
  wordsLoadedAt: {},
  listsLoadedAt: null,

  hydrateForUser: (userId) => {
    const cur = get().userId;
    if (cur === userId) return;
    set({
      userId,
      lists: [],
      counts: {},
      allCount: 0,
      wordsByList: {},
      wordsLoadedAt: {},
      listsLoadedAt: null,
    });
  },

  getCachedWords: (listId) => {
    if (!listId) return null;
    const words = get().wordsByList[listId];
    return Array.isArray(words) ? words : null;
  },

  refreshListsAndCounts: async (userId, opts) => {
    const force = opts?.force === true;
    const ttl = listsTtlMs();
    const loadedAt = get().listsLoadedAt;
    if (!force && ttl > 0 && loadedAt && now() - loadedAt < ttl) return;

    const lists = await fetchVocabLists(userId);
    const [total, ...perListCounts] = await Promise.all([
      countAllStudyWords(userId),
      ...lists.map((l) => countStudyWordsForList(userId, l.id)),
    ]);

    const counts: Record<string, number> = {};
    lists.forEach((l, i) => {
      counts[l.id] = perListCounts[i] ?? 0;
    });

    set({ userId, lists, counts, allCount: total, listsLoadedAt: now() });
  },

  refreshWordsForList: async (userId, listId, opts) => {
    const force = opts?.force === true;
    const ttl = wordsTtlMs();
    const loadedAt = get().wordsLoadedAt[listId] ?? null;
    if (!force && ttl > 0 && loadedAt && now() - loadedAt < ttl) return;

    const words = await fetchStudyWords(userId, listId);
    set((s) => ({
      userId,
      wordsByList: { ...s.wordsByList, [listId]: words },
      wordsLoadedAt: { ...s.wordsLoadedAt, [listId]: now() },
    }));
  },

  upsertWordInCache: (listId, word) => {
    if (!listId) return;
    set((s) => {
      const prev = s.wordsByList[listId] ?? [];
      const next = prev.some((w) => w.id === word.id) ? prev.map((w) => (w.id === word.id ? word : w)) : [word, ...prev];
      return {
        wordsByList: { ...s.wordsByList, [listId]: next },
      };
    });
  },

  removeWordFromCache: (listId, wordId) => {
    if (!listId) return;
    set((s) => {
      const prev = s.wordsByList[listId] ?? [];
      const next = prev.filter((w) => w.id !== wordId);
      return { wordsByList: { ...s.wordsByList, [listId]: next } };
    });
  },

  addListToCache: (list) => {
    set((s) => ({
      lists: [...s.lists, list],
      counts: { ...s.counts, [list.id]: s.counts[list.id] ?? 0 },
    }));
  },

  updateListInCache: (list) => {
    set((s) => ({
      lists: s.lists.map((l) => (l.id === list.id ? list : l)),
    }));
  },

  removeListFromCache: (listId) => {
    set((s) => {
      const { [listId]: _drop, ...restCounts } = s.counts;
      const { [listId]: _dropWords, ...restWords } = s.wordsByList;
      const { [listId]: _dropAt, ...restAt } = s.wordsLoadedAt;
      return {
        lists: s.lists.filter((l) => l.id !== listId),
        counts: restCounts,
        wordsByList: restWords,
        wordsLoadedAt: restAt,
      };
    });
  },

  adjustAllCount: (delta) => {
    const d = Math.trunc(delta);
    if (!Number.isFinite(d) || d === 0) return;
    set((s) => ({ allCount: Math.max(0, s.allCount + d) }));
  },

  adjustListCount: (listId, delta) => {
    const d = Math.trunc(delta);
    if (!listId || !Number.isFinite(d) || d === 0) return;
    set((s) => ({
      counts: { ...s.counts, [listId]: Math.max(0, (s.counts[listId] ?? 0) + d) },
    }));
  },

  clear: () =>
    set({
      userId: null,
      lists: [],
      counts: {},
      allCount: 0,
      wordsByList: {},
      wordsLoadedAt: {},
      listsLoadedAt: null,
    }),
});

export const useStudyStore = isDemoMode()
  ? create<StudyStore>()(createStudyStoreState)
  : create<StudyStore>()(
      persist(createStudyStoreState, {
        name: 'll_study_cache',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (s) => ({
          userId: s.userId,
          lists: s.lists,
          counts: s.counts,
          allCount: s.allCount,
          wordsByList: s.wordsByList,
          wordsLoadedAt: s.wordsLoadedAt,
          listsLoadedAt: s.listsLoadedAt,
        }),
      }),
    );
