import { useStudyStore } from '@/state/useStudyStore';
import type { StudyWord, VocabList } from '@/supabase/types';

jest.mock('@/supabase/queries', () => ({
  fetchVocabLists: jest.fn().mockResolvedValue([]),
  countAllStudyWords: jest.fn().mockResolvedValue(0),
  countStudyWordsForList: jest.fn().mockResolvedValue(0),
  fetchStudyWords: jest.fn().mockResolvedValue([]),
}));

const mockList = (id: string, name: string): VocabList => ({
  id,
  user_id: 'u1',
  name,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_used_at: new Date().toISOString(),
});

const mockWord = (id: string, listId: string): StudyWord => ({
  id,
  user_id: 'u1',
  book_id: 'b1',
  list_id: listId,
  term: 'hola',
  term_normalized: 'hola',
  translation: 'hello',
  source_lang: 'es',
  target_lang: 'en',
  context_snippet: null,
  created_at: new Date().toISOString(),
});

describe('useStudyStore', () => {
  beforeEach(() => {
    useStudyStore.getState().clear();
  });

  it('initializes with empty state', () => {
    const state = useStudyStore.getState();
    expect(state.lists).toEqual([]);
    expect(state.allCount).toBe(0);
    expect(state.userId).toBeNull();
  });

  describe('hydrateForUser', () => {
    it('resets state for a new user', () => {
      useStudyStore.setState({ userId: 'old', allCount: 10 });
      useStudyStore.getState().hydrateForUser('new');
      expect(useStudyStore.getState().userId).toBe('new');
      expect(useStudyStore.getState().allCount).toBe(0);
    });

    it('no-ops if same user', () => {
      useStudyStore.setState({ userId: 'u1', allCount: 10 });
      useStudyStore.getState().hydrateForUser('u1');
      expect(useStudyStore.getState().allCount).toBe(10);
    });
  });

  describe('cache operations', () => {
    it('addListToCache adds a list', () => {
      const list = mockList('l1', 'Vocab');
      useStudyStore.getState().addListToCache(list);
      expect(useStudyStore.getState().lists).toHaveLength(1);
      expect(useStudyStore.getState().lists[0].name).toBe('Vocab');
    });

    it('updateListInCache updates a list in-place', () => {
      const list = mockList('l1', 'Old');
      useStudyStore.getState().addListToCache(list);
      useStudyStore.getState().updateListInCache({ ...list, name: 'New' });
      expect(useStudyStore.getState().lists[0].name).toBe('New');
    });

    it('removeListFromCache removes list and associated data', () => {
      useStudyStore.getState().addListToCache(mockList('l1', 'V'));
      useStudyStore.setState((s) => ({
        counts: { ...s.counts, l1: 5 },
        wordsByList: { ...s.wordsByList, l1: [mockWord('w1', 'l1')] },
      }));
      useStudyStore.getState().removeListFromCache('l1');
      expect(useStudyStore.getState().lists).toHaveLength(0);
      expect(useStudyStore.getState().counts['l1']).toBeUndefined();
      expect(useStudyStore.getState().wordsByList['l1']).toBeUndefined();
    });

    it('upsertWordInCache adds new word', () => {
      const word = mockWord('w1', 'l1');
      useStudyStore.getState().upsertWordInCache('l1', word);
      expect(useStudyStore.getState().wordsByList['l1']).toHaveLength(1);
      expect(useStudyStore.getState().counts['l1']).toBe(1);
      expect(useStudyStore.getState().allCount).toBe(1);
    });

    it('upsertWordInCache updates existing word', () => {
      const word = mockWord('w1', 'l1');
      useStudyStore.getState().upsertWordInCache('l1', word);
      const updated = { ...word, translation: 'updated' };
      useStudyStore.getState().upsertWordInCache('l1', updated);
      expect(useStudyStore.getState().wordsByList['l1']).toHaveLength(1);
      expect(useStudyStore.getState().wordsByList['l1'][0].translation).toBe('updated');
    });

    it('removeWordFromCache removes a word', () => {
      useStudyStore.getState().upsertWordInCache('l1', mockWord('w1', 'l1'));
      useStudyStore.getState().upsertWordInCache('l1', mockWord('w2', 'l1'));
      useStudyStore.getState().removeWordFromCache('l1', 'w1');
      expect(useStudyStore.getState().wordsByList['l1']).toHaveLength(1);
      expect(useStudyStore.getState().wordsByList['l1'][0].id).toBe('w2');
      expect(useStudyStore.getState().counts['l1']).toBe(1);
      expect(useStudyStore.getState().allCount).toBe(1);
    });

    it('no-ops for null listId', () => {
      useStudyStore.getState().upsertWordInCache(null, mockWord('w1', 'l1'));
      expect(useStudyStore.getState().wordsByList).toEqual({});
    });
  });

  describe('count adjustments', () => {
    it('adjustAllCount increments and decrements', () => {
      useStudyStore.getState().adjustAllCount(5);
      expect(useStudyStore.getState().allCount).toBe(5);
      useStudyStore.getState().adjustAllCount(-2);
      expect(useStudyStore.getState().allCount).toBe(3);
    });

    it('adjustAllCount does not go below 0', () => {
      useStudyStore.getState().adjustAllCount(-10);
      expect(useStudyStore.getState().allCount).toBe(0);
    });

    it('adjustAllCount ignores 0 and non-finite', () => {
      useStudyStore.getState().adjustAllCount(5);
      useStudyStore.getState().adjustAllCount(0);
      expect(useStudyStore.getState().allCount).toBe(5);
      useStudyStore.getState().adjustAllCount(NaN);
      expect(useStudyStore.getState().allCount).toBe(5);
    });

    it('adjustListCount adjusts per-list count', () => {
      useStudyStore.setState({ counts: { l1: 10 } });
      useStudyStore.getState().adjustListCount('l1', -3);
      expect(useStudyStore.getState().counts['l1']).toBe(7);
    });

    it('adjustListCount does not go below 0', () => {
      useStudyStore.setState({ counts: { l1: 2 } });
      useStudyStore.getState().adjustListCount('l1', -10);
      expect(useStudyStore.getState().counts['l1']).toBe(0);
    });
  });

  describe('getCachedWords', () => {
    it('returns null for uncached list', () => {
      expect(useStudyStore.getState().getCachedWords('unknown')).toBeNull();
    });

    it('returns null for null listId', () => {
      expect(useStudyStore.getState().getCachedWords(null)).toBeNull();
    });

    it('returns cached words', () => {
      const word = mockWord('w1', 'l1');
      useStudyStore.getState().upsertWordInCache('l1', word);
      const cached = useStudyStore.getState().getCachedWords('l1');
      expect(cached).toHaveLength(1);
    });
  });
});
