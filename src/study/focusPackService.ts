/**
 * focusPackService
 *
 * Loads or builds the daily focus pack and fills in optional AI metadata.
 */

import { track } from '@/analytics/client';
import { logger } from '@/utils/logger';
import {
  buildFocusPack,
  computeFocusPackHash,
  type StudyPack,
  type StudyPackMetadata,
} from '@/study/focusPack';
import {
  getCachedFocusPackAny,
  getCachedFocusPack,
  getCachedFocusPackMetadata,
  getFocusPackCompletion,
  saveCachedFocusPack,
  saveCachedFocusPackMetadata,
} from '@/study/focusPackStorage';
import {
  fetchStudyWordReviews,
  fetchStudyWords,
  fetchUserSettings,
  generateStudyPackMetadata,
} from '@/supabase/queries';
import type { StudyWord } from '@/supabase/types';

interface TranslationFn {
  (key: string, params?: Record<string, string | number>): string;
}

let hasWarnedAboutMissingStudyPackApiKey = false;

function resolveLearnedGoal(raw: number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && raw <= 15) {
    return Math.round(raw);
  }
  return 5;
}

function buildFallbackMetadata(
  t: TranslationFn,
  reviewCount: number,
  newCount: number,
): StudyPackMetadata {
  return {
    title: t('study.focusPackTitle'),
    coachLine: t('study.focusPackCoachLine', {
      reviewCount,
      newCount,
    }),
  };
}

function toMetadataWords(words: StudyWord[]) {
  return words.map((word) => ({
    term: word.term,
    translation: word.translation,
    context_snippet: word.context_snippet,
    source_lang: word.source_lang,
    target_lang: word.target_lang,
    list_name: null,
  }));
}

function warnIfMissingStudyPackApiKey(metadata: StudyPackMetadata | null | undefined): void {
  if (
    metadata?.fallbackReason === 'missing_openai_api_key' &&
    !hasWarnedAboutMissingStudyPackApiKey
  ) {
    hasWarnedAboutMissingStudyPackApiKey = true;
    logger.warn(
      'Study pack AI metadata is using fallback copy because OPENAI_API_KEY is missing in the study-pack-metadata edge function.',
    );
  }
}

async function withCompletionState(userId: string, pack: StudyPack, now: Date): Promise<StudyPack> {
  const completedAt = await getFocusPackCompletion(userId, pack.id, now);
  if (!completedAt) {
    return {
      ...pack,
      isCompleted: false,
      completedAt: undefined,
    };
  }

  return {
    ...pack,
    isCompleted: true,
    completedAt,
  };
}

export async function loadFocusPack(userId: string, t: TranslationFn, now: Date = new Date()): Promise<StudyPack | null> {
  const [settings, words] = await Promise.all([
    fetchUserSettings(userId),
    fetchStudyWords(userId),
  ]);

  if (words.length === 0) return null;

  const reviews = await fetchStudyWordReviews(words.map((word) => word.id));
  const reviewByWordId = new Map(reviews.map((review) => [review.study_word_id, review]));
  const learnedGoal = resolveLearnedGoal(settings?.daily_words_learned_goal);
  const packHash = computeFocusPackHash(words, reviewByWordId, learnedGoal);

  const cachedPack = await getCachedFocusPack(userId, packHash, now);
  if (cachedPack) {
    return withCompletionState(userId, cachedPack, now);
  }

  const stickyCompletedPack = await getCachedFocusPackAny(userId, now);
  if (stickyCompletedPack) {
    const completedPack = await withCompletionState(userId, stickyCompletedPack, now);
    if (completedPack.isCompleted) {
      return completedPack;
    }
  }

  const draft = buildFocusPack({
    words,
    reviewByWordId,
    learnedGoal,
    now,
  });
  if (!draft) return null;

  const selectedWords = draft.wordIds
    .map((id) => words.find((word) => word.id === id))
    .filter((word): word is StudyWord => Boolean(word));
  const fallbackMetadata = buildFallbackMetadata(t, draft.reviewCount, draft.newCount);

  let metadata = await getCachedFocusPackMetadata(packHash, now);
  warnIfMissingStudyPackApiKey(metadata);
  if (!metadata) {
    try {
      const generatedMetadata = await generateStudyPackMetadata({
        words: toMetadataWords(selectedWords),
        review_count: draft.reviewCount,
        new_count: draft.newCount,
      });
      metadata = generatedMetadata;
      await saveCachedFocusPackMetadata(packHash, generatedMetadata);
      if (generatedMetadata.source === 'fallback') {
        warnIfMissingStudyPackApiKey(generatedMetadata);
        track('study_pack_ai_failed', {
          pack_id: `focus_${packHash}`,
          word_count: draft.targetCount,
          error: generatedMetadata.fallbackReason ?? 'fallback_metadata',
        });
      } else {
        track('study_pack_ai_generated', {
          pack_id: `focus_${packHash}`,
          word_count: draft.targetCount,
          group_count: generatedMetadata.groups?.length ?? 0,
        });
      }
    } catch (error) {
      metadata = fallbackMetadata;
      track('study_pack_ai_failed', {
        pack_id: `focus_${packHash}`,
        word_count: draft.targetCount,
        error: String((error as Error)?.message ?? 'unknown_error'),
      });
    }
  }

  const pack: StudyPack = {
    id: `focus_${packHash}`,
    listId: null,
    mode: 'focus_pack',
    wordIds: draft.wordIds,
    targetCount: draft.targetCount,
    reviewCount: draft.reviewCount,
    newCount: draft.newCount,
    title: metadata?.title || fallbackMetadata.title,
    coachLine: metadata?.coachLine || fallbackMetadata.coachLine,
    groups: metadata?.groups,
    metadataSource: metadata?.source,
    metadataFallbackReason: metadata?.fallbackReason,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };

  await saveCachedFocusPack(userId, packHash, pack);
  track('study_pack_created', {
    pack_id: pack.id,
    target_count: pack.targetCount,
    review_count: pack.reviewCount,
    new_count: pack.newCount,
  });

  return withCompletionState(userId, pack, now);
}
