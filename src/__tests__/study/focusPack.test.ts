import {
  buildFocusPack,
  computeFocusPackHash,
  getFocusPackTargetCount,
} from '@/study/focusPack';
import type { StudyWord, StudyWordReview } from '@/supabase/types';

function makeWord(id: string, createdAt: string, overrides?: Partial<StudyWord>): StudyWord {
  return {
    id,
    user_id: 'user-1',
    book_id: 'book-1',
    list_id: 'list-1',
    source_lang: 'es',
    target_lang: 'en',
    term: `term-${id}`,
    term_normalized: `term-${id}`,
    translation: `translation-${id}`,
    context_snippet: `context-${id}`,
    created_at: createdAt,
    ...overrides,
  };
}

function makeReview(id: string, nextReviewAt: string, overrides?: Partial<StudyWordReview>): StudyWordReview {
  return {
    study_word_id: id,
    next_review_at: nextReviewAt,
    interval_minutes: 10,
    last_rating: 'good',
    review_count: 2,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('focusPack builder', () => {
  const now = new Date('2026-04-04T12:00:00.000Z');

  it('builds a review-first mix when due and new cards are available', () => {
    const words = [
      makeWord('w1', '2026-04-03T12:00:00.000Z'),
      makeWord('w2', '2026-04-03T11:00:00.000Z'),
      makeWord('w3', '2026-04-03T10:00:00.000Z'),
      makeWord('w4', '2026-04-03T09:00:00.000Z'),
      makeWord('w5', '2026-04-03T08:00:00.000Z'),
      makeWord('w6', '2026-04-03T07:00:00.000Z'),
      makeWord('w7', '2026-04-03T06:00:00.000Z'),
      makeWord('w8', '2026-04-03T05:00:00.000Z'),
      makeWord('w9', '2026-04-03T04:00:00.000Z'),
      makeWord('w10', '2026-04-03T03:00:00.000Z'),
    ];
    const reviewByWordId = new Map<string, StudyWordReview>([
      ['w1', makeReview('w1', '2026-04-04T10:00:00.000Z', { last_rating: 'again' })],
      ['w2', makeReview('w2', '2026-04-04T10:30:00.000Z', { last_rating: 'hard' })],
      ['w3', makeReview('w3', '2026-04-04T11:00:00.000Z')],
      ['w4', makeReview('w4', '2026-04-04T11:15:00.000Z')],
      ['w5', makeReview('w5', '2026-04-04T11:45:00.000Z')],
    ]);

    const pack = buildFocusPack({
      words,
      reviewByWordId,
      learnedGoal: 5,
      now,
    });

    expect(pack).not.toBeNull();
    expect(pack?.targetCount).toBe(10);
    expect(pack?.reviewCount).toBe(5);
    expect(pack?.newCount).toBe(5);
    expect(pack?.wordIds.slice(0, 2)).toEqual(['w1', 'w2']);
  });

  it('uses an all-review pack when due backlog is much larger than the target size', () => {
    const words = Array.from({ length: 20 }, (_, index) =>
      makeWord(`w${index + 1}`, `2026-04-03T${String(index).padStart(2, '0')}:00:00.000Z`),
    );
    const reviewByWordId = new Map(
      words.map((word, index) => [
        word.id,
        makeReview(word.id, `2026-04-04T${String(index).padStart(2, '0')}:00:00.000Z`, {
          last_rating: index === 0 ? 'again' : 'good',
        }),
      ]),
    );

    const pack = buildFocusPack({
      words,
      reviewByWordId,
      learnedGoal: 5,
      now,
    });

    expect(pack?.targetCount).toBe(10);
    expect(pack?.reviewCount).toBe(10);
    expect(pack?.newCount).toBe(0);
  });

  it('backfills with new cards when few review cards are available', () => {
    const words = Array.from({ length: 10 }, (_, index) =>
      makeWord(`w${index + 1}`, `2026-04-03T${String(index).padStart(2, '0')}:00:00.000Z`),
    );
    const reviewByWordId = new Map<string, StudyWordReview>([
      ['w1', makeReview('w1', '2026-04-04T11:00:00.000Z', { last_rating: 'again' })],
      ['w2', makeReview('w2', '2026-04-04T11:30:00.000Z')],
    ]);

    const pack = buildFocusPack({
      words,
      reviewByWordId,
      learnedGoal: 5,
      now,
    });

    expect(pack?.targetCount).toBe(10);
    expect(pack?.reviewCount).toBe(2);
    expect(pack?.newCount).toBe(8);
  });

  it('clamps pack size from the learned-goal setting', () => {
    expect(getFocusPackTargetCount(1)).toBe(8);
    expect(getFocusPackTargetCount(5)).toBe(10);
    expect(getFocusPackTargetCount(20)).toBe(15);
  });

  it('changes the pack hash when candidate review state changes', () => {
    const words = Array.from({ length: 8 }, (_, index) =>
      makeWord(`w${index + 1}`, `2026-04-03T${String(index).padStart(2, '0')}:00:00.000Z`),
    );
    const reviewsA = new Map<string, StudyWordReview>([
      ['w1', makeReview('w1', '2026-04-04T10:00:00.000Z')],
    ]);
    const reviewsB = new Map<string, StudyWordReview>([
      ['w1', makeReview('w1', '2026-04-05T10:00:00.000Z')],
    ]);

    expect(computeFocusPackHash(words, reviewsA, 5)).not.toBe(computeFocusPackHash(words, reviewsB, 5));
  });
});
