/**
 * focusPack
 *
 * Builds a small, review-first study pack from a larger saved-word backlog.
 */

import type { StudyWord, StudyWordReview } from '@/supabase/types';

export const MIN_FOCUS_PACK_CANDIDATES = 8;
export const FOCUS_PACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface StudyPack {
  id: string;
  listId: string | null;
  mode: 'focus_pack';
  wordIds: string[];
  targetCount: number;
  reviewCount: number;
  newCount: number;
  title: string;
  coachLine: string;
  createdAt: string;
  expiresAt: string;
  groups?: string[];
  metadataSource?: 'ai' | 'fallback';
  metadataFallbackReason?: string;
  isCompleted?: boolean;
  completedAt?: string;
}

export interface StudyPackMetadata {
  title: string;
  coachLine: string;
  groups?: string[];
  source?: 'ai' | 'fallback';
  fallbackReason?: string;
}

export interface FocusPackDraft {
  wordIds: string[];
  targetCount: number;
  reviewCount: number;
  newCount: number;
}

export interface FocusPackBuildInput {
  words: StudyWord[];
  reviewByWordId: Map<string, StudyWordReview>;
  learnedGoal: number;
  now?: Date;
}

interface RankedWord {
  word: StudyWord;
  review: StudyWordReview | null;
  rank: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}

function toMillis(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function ratingWeight(rating: string | null | undefined): number {
  if (rating === 'again') return 0;
  if (rating === 'hard') return 1;
  if (rating === 'good') return 2;
  if (rating === 'easy') return 3;
  return 4;
}

function isReviewCandidate(review: StudyWordReview | null, now: Date): boolean {
  if (!review?.next_review_at) return false;
  if (review.last_rating === 'hard') return true;
  const nextReviewAt = Date.parse(review.next_review_at);
  if (!Number.isFinite(nextReviewAt)) return false;
  return nextReviewAt <= now.getTime() + 60 * 60 * 1000;
}

function buildReviewRanks(words: StudyWord[], reviewByWordId: Map<string, StudyWordReview>, now: Date): RankedWord[] {
  return words
    .map((word) => {
      const review = reviewByWordId.get(word.id) ?? null;
      if (!isReviewCandidate(review, now)) return null;
      const overdueMs = Math.max(0, now.getTime() - toMillis(review?.next_review_at));
      const urgencyRank = overdueMs > 0 ? -overdueMs : toMillis(review?.next_review_at);
      const failureRank = ratingWeight(review?.last_rating);
      const recencyRank = -toMillis(word.created_at);
      return {
        word,
        review,
        rank: 0,
        urgencyRank,
        failureRank,
        recencyRank,
      };
    })
    .filter((value): value is RankedWord & { urgencyRank: number; failureRank: number; recencyRank: number } => Boolean(value))
    .sort((a, b) => {
      if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
      if (a.failureRank !== b.failureRank) return a.failureRank - b.failureRank;
      if (a.recencyRank !== b.recencyRank) return a.recencyRank - b.recencyRank;
      return a.word.id.localeCompare(b.word.id);
    })
    .map(({ urgencyRank: _urgencyRank, failureRank: _failureRank, recencyRank: _recencyRank, ...item }, index) => ({
      ...item,
      rank: index,
    }));
}

function buildNewRanks(words: StudyWord[], reviewByWordId: Map<string, StudyWordReview>): RankedWord[] {
  const contextCounts = new Map<string, number>();
  for (const word of words) {
    const review = reviewByWordId.get(word.id) ?? null;
    if (review) continue;
    const contextKey = `${word.list_id ?? 'all'}:${word.book_id}`;
    contextCounts.set(contextKey, (contextCounts.get(contextKey) ?? 0) + 1);
  }

  const ranked = words
    .map((word) => {
      const review = reviewByWordId.get(word.id) ?? null;
      if (review) return null;
      const contextKey = `${word.list_id ?? 'all'}:${word.book_id}`;
      return {
        word,
        review: null,
        contextScore: contextCounts.get(contextKey) ?? 0,
        recencyRank: -toMillis(word.created_at),
      };
    })
    .filter((value): value is { word: StudyWord; review: null; contextScore: number; recencyRank: number } => value !== null);

  return ranked
    .sort((a, b) => {
      if (b.contextScore !== a.contextScore) return b.contextScore - a.contextScore;
      if (a.recencyRank !== b.recencyRank) return a.recencyRank - b.recencyRank;
      return a.word.id.localeCompare(b.word.id);
    })
    .map(({ contextScore: _contextScore, recencyRank: _recencyRank, ...item }, index) => ({
      ...item,
      rank: index,
    }));
}

export function getFocusPackTargetCount(learnedGoal: number): number {
  const safeGoal = Number.isFinite(learnedGoal) ? learnedGoal : 5;
  return clamp(Math.round(safeGoal) * 2, 8, 15);
}

export function computeFocusPackHash(
  words: StudyWord[],
  reviewByWordId: Map<string, StudyWordReview>,
  learnedGoal: number,
): string {
  const targetCount = getFocusPackTargetCount(learnedGoal);
  const signature = words
    .map((word) => {
      const review = reviewByWordId.get(word.id);
      return [
        word.id,
        word.list_id ?? '',
        word.book_id,
        word.created_at,
        review?.next_review_at ?? '',
        review?.last_rating ?? '',
        review?.review_count ?? 0,
      ].join('|');
    })
    .sort()
    .join('~');
  return hashString(`${targetCount}::${signature}`);
}

export function buildFocusPack(input: FocusPackBuildInput): FocusPackDraft | null {
  const { words, reviewByWordId } = input;
  const now = input.now ?? new Date();
  const targetCount = getFocusPackTargetCount(input.learnedGoal);

  if (words.length < MIN_FOCUS_PACK_CANDIDATES) {
    return null;
  }

  const reviewCandidates = buildReviewRanks(words, reviewByWordId, now);
  const newCandidates = buildNewRanks(words, reviewByWordId);

  if (reviewCandidates.length + newCandidates.length < MIN_FOCUS_PACK_CANDIDATES) {
    return null;
  }

  const reviewFirstOnly = reviewCandidates.length > targetCount * 2;
  const reviewTarget = reviewFirstOnly
    ? Math.min(targetCount, reviewCandidates.length)
    : Math.min(reviewCandidates.length, Math.ceil(targetCount * 0.7));
  const newTarget = reviewFirstOnly ? 0 : Math.min(newCandidates.length, targetCount - reviewTarget);

  const selectedReview = reviewCandidates.slice(0, reviewTarget);
  const selectedNew = newCandidates.slice(0, newTarget);
  const selectedIds = new Set([...selectedReview, ...selectedNew].map((item) => item.word.id));

  const remainder = [...reviewCandidates, ...newCandidates].filter((item) => !selectedIds.has(item.word.id));
  remainder.sort((a, b) => a.rank - b.rank);

  const finalWords = [...selectedReview, ...selectedNew];
  for (const candidate of remainder) {
    if (finalWords.length >= targetCount) break;
    finalWords.push(candidate);
  }

  if (finalWords.length < MIN_FOCUS_PACK_CANDIDATES) {
    return null;
  }

  const orderedIds = finalWords.map((item) => item.word.id);
  const reviewCount = finalWords.filter((item) => item.review).length;
  const newCount = orderedIds.length - reviewCount;

  return {
    wordIds: orderedIds,
    targetCount: orderedIds.length,
    reviewCount,
    newCount,
  };
}
