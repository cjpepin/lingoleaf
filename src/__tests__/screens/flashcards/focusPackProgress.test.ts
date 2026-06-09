import {
  buildFocusPackReviewQueue,
  computeFocusPackStats,
  isFocusPackWordLearned,
} from '@/screens/flashcards/focusPackProgress';

describe('focusPackProgress', () => {
  const now = new Date('2026-04-04T09:00:00.000Z');
  const words = [
    {
      id: 'new-word',
      user_id: 'user-1',
      book_id: 'book-1',
      list_id: 'list-1',
      source_lang: 'es',
      target_lang: 'en',
      term: 'hola',
      term_normalized: 'hola',
      translation: 'hello',
      context_snippet: null,
      created_at: '2026-04-04T08:00:00.000Z',
    },
    {
      id: 'hard-word',
      user_id: 'user-1',
      book_id: 'book-1',
      list_id: 'list-1',
      source_lang: 'es',
      target_lang: 'en',
      term: 'adios',
      term_normalized: 'adios',
      translation: 'bye',
      context_snippet: null,
      created_at: '2026-04-04T08:05:00.000Z',
    },
    {
      id: 'learned-word',
      user_id: 'user-1',
      book_id: 'book-1',
      list_id: 'list-1',
      source_lang: 'es',
      target_lang: 'en',
      term: 'gracias',
      term_normalized: 'gracias',
      translation: 'thanks',
      context_snippet: null,
      created_at: '2026-04-04T08:10:00.000Z',
    },
  ];

  it('treats hard cards as still unlearned', () => {
    expect(
      isFocusPackWordLearned(
        {
          study_word_id: 'hard-word',
          created_at: '2026-04-04T08:10:00.000Z',
          updated_at: '2026-04-04T08:10:00.000Z',
          next_review_at: '2026-04-04T09:10:00.000Z',
          interval_minutes: 10,
          last_rating: 'hard',
          review_count: 2,
        },
        now,
      ),
    ).toBe(false);
  });

  it('keeps only not-yet-learned words in the spaced focus-pack queue', () => {
    const queue = buildFocusPackReviewQueue(
      words,
      [
        {
          study_word_id: 'hard-word',
          created_at: '2026-04-04T08:10:00.000Z',
          updated_at: '2026-04-04T08:10:00.000Z',
          next_review_at: '2026-04-04T09:10:00.000Z',
          interval_minutes: 10,
          last_rating: 'hard',
          review_count: 2,
        },
        {
          study_word_id: 'learned-word',
          created_at: '2026-04-04T08:15:00.000Z',
          updated_at: '2026-04-04T08:15:00.000Z',
          next_review_at: '2026-04-05T09:00:00.000Z',
          interval_minutes: 1440,
          last_rating: 'good',
          review_count: 1,
        },
      ],
      now,
    );

    expect(queue.map((word) => word.id)).toEqual(['new-word', 'hard-word']);
  });

  it('builds spaced repetition stats for the focus-pack subset', () => {
    const stats = computeFocusPackStats(
      words,
      [
        {
          study_word_id: 'hard-word',
          created_at: '2026-04-04T08:10:00.000Z',
          updated_at: '2026-04-04T08:10:00.000Z',
          next_review_at: '2026-04-04T09:10:00.000Z',
          interval_minutes: 10,
          last_rating: 'hard',
          review_count: 2,
        },
        {
          study_word_id: 'learned-word',
          created_at: '2026-04-04T08:15:00.000Z',
          updated_at: '2026-04-04T08:15:00.000Z',
          next_review_at: '2026-04-05T09:00:00.000Z',
          interval_minutes: 1440,
          last_rating: 'good',
          review_count: 1,
        },
      ],
      now,
    );

    expect(stats).toEqual({
      unseen: 1,
      learning: 1,
      learned: 1,
    });
  });
});
