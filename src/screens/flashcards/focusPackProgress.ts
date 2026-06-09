/**
 * focusPackProgress
 *
 * Helpers for determining which focus-pack cards still need spaced review.
 */

import type { StudyWord, StudyWordReview } from '@/supabase/types';
import type { FlashcardStats } from '@/supabase/queries';

export function isFocusPackWordLearned(review: StudyWordReview | null | undefined, now: Date): boolean {
  if (!review?.next_review_at) return false;
  if (review.last_rating === 'hard') return false;
  const nextReviewAt = Date.parse(review.next_review_at);
  if (!Number.isFinite(nextReviewAt)) return false;
  return nextReviewAt > now.getTime() + 60 * 60 * 1000;
}

export function buildFocusPackReviewQueue(
  words: StudyWord[],
  reviews: StudyWordReview[],
  now: Date = new Date(),
): StudyWord[] {
  const reviewByWordId = new Map(reviews.map((review) => [review.study_word_id, review]));
  return words.filter((word) => !isFocusPackWordLearned(reviewByWordId.get(word.id), now));
}

export function computeFocusPackStats(
  words: StudyWord[],
  reviews: StudyWordReview[],
  now: Date = new Date(),
): FlashcardStats {
  const reviewByWordId = new Map(reviews.map((review) => [review.study_word_id, review]));
  let unseen = 0;
  let learning = 0;
  let learned = 0;

  for (const word of words) {
    const review = reviewByWordId.get(word.id);
    if (!review?.next_review_at) {
      unseen += 1;
      continue;
    }

    if (isFocusPackWordLearned(review, now)) {
      learned += 1;
      continue;
    }

    learning += 1;
  }

  return {
    unseen,
    learning,
    learned,
  };
}
