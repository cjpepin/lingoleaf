import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadFocusPack } from '@/study/focusPackService';
import { saveFocusPackCompletion } from '@/study/focusPackStorage';
import type { StudyWord, StudyWordReview, UserSettings } from '@/supabase/types';

const mockTrack = jest.fn();
const mockLoggerWarn = jest.fn();
const mockFetchStudyWords = jest.fn();
const mockFetchStudyWordReviews = jest.fn();
const mockFetchUserSettings = jest.fn();
const mockGenerateStudyPackMetadata = jest.fn();

jest.mock('@/analytics/client', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

jest.mock('@/supabase/queries', () => ({
  fetchStudyWords: (...args: unknown[]) => mockFetchStudyWords(...args),
  fetchStudyWordReviews: (...args: unknown[]) => mockFetchStudyWordReviews(...args),
  fetchUserSettings: (...args: unknown[]) => mockFetchUserSettings(...args),
  generateStudyPackMetadata: (...args: unknown[]) => mockGenerateStudyPackMetadata(...args),
}));

function t(key: string, params?: Record<string, string | number>): string {
  if (key === 'study.focusPackTitle') return "Today's Focus Pack";
  if (key === 'study.focusPackCoachLine') {
    return `${params?.reviewCount} review cards, ${params?.newCount} new cards.`;
  }
  return key;
}

function makeWord(id: string): StudyWord {
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
    created_at: `2026-04-04T0${id.length}:00:00.000Z`,
  };
}

function makeReview(id: string): StudyWordReview {
  return {
    study_word_id: id,
    next_review_at: '2026-04-04T11:00:00.000Z',
    interval_minutes: 10,
    last_rating: 'again',
    review_count: 1,
    created_at: '2026-04-04T08:00:00.000Z',
    updated_at: '2026-04-04T08:00:00.000Z',
  };
}

describe('loadFocusPack', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    const words = Array.from({ length: 8 }, (_, index) => makeWord(`w${index + 1}`));
    mockFetchStudyWords.mockResolvedValue(words);
    mockFetchStudyWordReviews.mockResolvedValue(words.slice(0, 3).map((word) => makeReview(word.id)));
    mockFetchUserSettings.mockResolvedValue({ daily_words_learned_goal: 5 } satisfies Partial<UserSettings>);
  });

  it('falls back to deterministic metadata when the AI call fails', async () => {
    mockGenerateStudyPackMetadata.mockRejectedValue(new Error('timeout'));

    const pack = await loadFocusPack('user-1', t, new Date('2026-04-04T12:00:00.000Z'));

    expect(pack).not.toBeNull();
    expect(pack?.title).toBe("Today's Focus Pack");
    expect(pack?.coachLine).toContain('review cards');
    expect(mockTrack).toHaveBeenCalledWith(
      'study_pack_ai_failed',
      expect.objectContaining({ error: expect.stringContaining('timeout') }),
    );
  });

  it('warns when the edge function reports a missing OPENAI_API_KEY fallback', async () => {
    mockGenerateStudyPackMetadata.mockResolvedValue({
      title: "Today's Focus Pack",
      coachLine: '3 review cards, 5 new cards.',
      groups: [],
      source: 'fallback',
      fallbackReason: 'missing_openai_api_key',
    });

    const pack = await loadFocusPack('user-1', t, new Date('2026-04-04T12:00:00.000Z'));

    expect(pack).not.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Study pack AI metadata is using fallback copy because OPENAI_API_KEY is missing in the study-pack-metadata edge function.',
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'study_pack_ai_failed',
      expect.objectContaining({ error: 'missing_openai_api_key' }),
    );
    expect(mockTrack).not.toHaveBeenCalledWith(
      'study_pack_ai_generated',
      expect.anything(),
    );
  });

  it('keeps showing the completed pack for the rest of the day', async () => {
    mockGenerateStudyPackMetadata.mockResolvedValue({
      title: 'AI title',
      coachLine: 'AI coach line',
      groups: [],
      source: 'ai',
    });

    const firstPack = await loadFocusPack('user-1', t, new Date('2026-04-04T12:00:00.000Z'));
    expect(firstPack).not.toBeNull();

    await saveFocusPackCompletion('user-1', firstPack!.id, '2026-04-04T12:30:00.000Z');
    mockFetchStudyWordReviews.mockResolvedValue([]);

    const nextPack = await loadFocusPack('user-1', t, new Date('2026-04-04T15:00:00.000Z'));

    expect(nextPack?.id).toBe(firstPack?.id);
    expect(nextPack?.isCompleted).toBe(true);
    expect(nextPack?.completedAt).toBe('2026-04-04T12:30:00.000Z');
  });

  it('returns null when there are too few saved words for a focus pack', async () => {
    mockFetchStudyWords.mockResolvedValue(Array.from({ length: 4 }, (_, index) => makeWord(`w${index + 1}`)));
    mockGenerateStudyPackMetadata.mockResolvedValue({
      title: 'AI title',
      coachLine: 'AI coach line',
      groups: [],
    });

    const pack = await loadFocusPack('user-1', t, new Date('2026-04-04T12:00:00.000Z'));

    expect(pack).toBeNull();
  });
});
