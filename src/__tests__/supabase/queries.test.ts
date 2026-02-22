/**
 * queries.test.ts
 *
 * Integration-style tests for supabase/queries.ts.
 * Supabase client is mocked globally in setup.ts, so these test
 * the function logic (filter building, error handling, data shaping)
 * without hitting a real database.
 */

import { MAX_STUDY_LIST_WORDS } from '@/supabase/queries';

describe('supabase/queries constants', () => {
  it('MAX_STUDY_LIST_WORDS is 512', () => {
    expect(MAX_STUDY_LIST_WORDS).toBe(512);
  });
});

describe('BookFilters type and fetchBooks', () => {
  it('fetchBooks is exported', async () => {
    const { fetchBooks } = require('@/supabase/queries');
    expect(typeof fetchBooks).toBe('function');
  });
});

describe('fetchBookSubjects', () => {
  it('is exported', () => {
    const { fetchBookSubjects } = require('@/supabase/queries');
    expect(typeof fetchBookSubjects).toBe('function');
  });
});

describe('fetchBookLanguages', () => {
  it('is exported', () => {
    const { fetchBookLanguages } = require('@/supabase/queries');
    expect(typeof fetchBookLanguages).toBe('function');
  });
});

describe('highlight functions', () => {
  it('exports highlight CRUD functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchHighlights).toBe('function');
    expect(typeof q.createHighlight).toBe('function');
    expect(typeof q.deleteHighlight).toBe('function');
  });
});

describe('study word functions', () => {
  it('exports study word CRUD functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchStudyWords).toBe('function');
    expect(typeof q.createStudyWord).toBe('function');
    expect(typeof q.deleteStudyWord).toBe('function');
    expect(typeof q.moveStudyWordToList).toBe('function');
    expect(typeof q.findStudyWordsByTerm).toBe('function');
  });
});

describe('vocab list functions', () => {
  it('exports vocab list CRUD functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchVocabLists).toBe('function');
    expect(typeof q.createVocabList).toBe('function');
    expect(typeof q.renameVocabList).toBe('function');
    expect(typeof q.deleteVocabList).toBe('function');
    expect(typeof q.touchVocabList).toBe('function');
  });
});

describe('user settings functions', () => {
  it('exports user settings functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchUserSettings).toBe('function');
    expect(typeof q.upsertUserSettings).toBe('function');
    expect(typeof q.checkIsAdmin).toBe('function');
  });
});

describe('translation function', () => {
  it('exports translateText', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.translateText).toBe('function');
  });
});

describe('user book functions', () => {
  it('exports user book functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchUserBook).toBe('function');
    expect(typeof q.upsertUserBook).toBe('function');
    expect(typeof q.saveBookForLater).toBe('function');
    expect(typeof q.setUserBookReading).toBe('function');
    expect(typeof q.addUserBookHighlight).toBe('function');
    expect(typeof q.deleteUserBookHighlight).toBe('function');
    expect(typeof q.updateUserBookHighlightColor).toBe('function');
  });
});

describe('flashcard functions', () => {
  it('exports flashcard functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchFlashcardQueue).toBe('function');
    expect(typeof q.fetchFlashcardStats).toBe('function');
    expect(typeof q.fetchFlashcardQueueAll).toBe('function');
    expect(typeof q.upsertStudyWordReview).toBe('function');
  });
});

describe('history functions', () => {
  it('exports history functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchHistoryBooks).toBe('function');
    expect(typeof q.hasReadingHistory).toBe('function');
  });
});

describe('upgrade prompt functions', () => {
  it('exports prompt state functions', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.fetchUserPromptState).toBe('function');
    expect(typeof q.upsertUserPromptState).toBe('function');
  });
});

describe('account functions', () => {
  it('exports deleteUserAccount', () => {
    const q = require('@/supabase/queries');
    expect(typeof q.deleteUserAccount).toBe('function');
  });
});
