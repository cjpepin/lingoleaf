import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FlashcardsScreen from '@/screens/FlashcardsScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockFetchStudyWords = jest.fn();
const mockFetchStudyWordReviews = jest.fn();
const mockUpsertStudyWordReview = jest.fn();
const mockRecordVocabReviewed = jest.fn();
const mockApplyGardenProgress = jest.fn();
let mockPreferredStudyMethod: 'spaced' | 'free' = 'spaced';

jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {
      listId: null,
      listName: 'Daily Focus',
      sessionMode: 'focus_pack',
      wordIds: ['w2'],
      packTitle: 'Daily Focus',
      packId: 'focus_hash',
      packReviewCount: 1,
      packNewCount: 0,
    },
  }),
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/state/useStudyStore', () => ({
  useStudyStore: () => ({
    hydrateForUser: jest.fn(),
    refreshWordsForList: jest.fn(),
    getCachedWords: jest.fn().mockReturnValue(null),
    upsertWordInCache: jest.fn(),
  }),
}));

jest.mock('@/state/useFlashcardSettingsStore', () => ({
  useFlashcardSettingsStore: (selector: (state: any) => unknown) =>
    selector({
      getSettings: () => ({
        againCards: 2,
        intervalHardMin: 10,
        intervalGoodMin: 60,
        intervalEasyMin: 1440,
        multiplier: 2,
      }),
      preferredStudyMethod: mockPreferredStudyMethod,
      setPreferredStudyMethod: jest.fn(),
    }),
}));

jest.mock('@/state/useSettingsStore', () => ({
  useSettingsStore: (selector: (state: any) => unknown) =>
    selector({
      loadSettings: jest.fn().mockResolvedValue(null),
    }),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    if (key === 'flashcards.focusPackProgress') {
      return `${params?.current} of ${params?.total}`;
    }
    if (key === 'flashcards.unseen') return 'Unseen';
    if (key === 'flashcards.learning') return 'Learning';
    if (key === 'flashcards.learned') return 'Learned';
    if (key === 'flashcards.focusPackCompleteTitle') return 'Pack complete';
    if (key === 'flashcards.focusPackCompleteSubtitle') return `You finished today's ${params?.count}-card focus pack.`;
    if (key === 'flashcards.congratsMessage') return `Congrats, you learned ${params?.count} words. Now you can:`;
    if (key === 'flashcards.good') return 'Good';
    if (key === 'flashcards.hard') return 'Hard';
    if (key === 'flashcards.tapToFlip') return 'Tap to flip';
    if (key === 'flashcards.howWell') return 'How well did you know this?';
    if (key === 'flashcards.continueFreeStudying') return 'Continue free studying';
    if (key === 'flashcards.resetAndStartOver') return 'Reset progress and start over';
    if (key === 'flashcards.goBackToReading') return 'Go back to reading';
    if (key === 'flashcards.next') return 'Next';
    if (key === 'flashcards.prev') return 'Prev';
    if (key === 'flashcards.shuffle') return 'Shuffle';
    if (key === 'common.error') return 'Error';
    return key;
  },
}));

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => null,
}));

jest.mock('@/components/ui/CenteredLoader', () => ({
  CenteredLoader: () => null,
}));

jest.mock('@/components/FlashcardSettingsModal', () => ({
  FlashcardSettingsModal: () => null,
}));

jest.mock('@/components/ui/OverlayModal', () => ({
  OverlayModal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));

jest.mock('@/components/ui/Button', () => {
  const ReactLib = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/supabase/queries', () => ({
  applyGardenProgress: (...args: unknown[]) => mockApplyGardenProgress(...args),
  fetchStudyWords: (...args: unknown[]) => mockFetchStudyWords(...args),
  fetchStudyWordReviews: (...args: unknown[]) => mockFetchStudyWordReviews(...args),
  fetchFlashcardQueue: jest.fn(),
  fetchFlashcardQueueAll: jest.fn(),
  fetchFlashcardStats: jest.fn(),
  upsertStudyWordReview: (...args: unknown[]) => mockUpsertStudyWordReview(...args),
  recordVocabReviewed: (...args: unknown[]) => mockRecordVocabReviewed(...args),
  deleteStudyWordReviewsForList: jest.fn(),
  deleteAllStudyWordReviews: jest.fn(),
  setStudyWordStarred: jest.fn(),
}));

jest.mock('@/utils/flashcardSessionStorage', () => ({
  getFlashcardSession: jest.fn().mockResolvedValue(null),
  saveFlashcardSession: jest.fn(),
  clearFlashcardSession: jest.fn(),
  FLASHCARD_ALL_KEY: '__all__',
}));

describe('FlashcardsScreen focus pack', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let currentReview: {
    study_word_id: string;
    next_review_at: string;
    last_rating: 'hard' | 'good';
  } | null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPreferredStudyMethod = 'spaced';
    currentReview = null;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (args.some((arg) => typeof arg === 'string' && arg.includes('not wrapped in act'))) {
        return;
      }
    });
    mockFetchStudyWords.mockResolvedValue([
      {
        id: 'w1',
        user_id: 'user-1',
        book_id: 'book-1',
        list_id: 'list-1',
        source_lang: 'es',
        target_lang: 'en',
        term: 'ignored-term',
        term_normalized: 'ignored-term',
        translation: 'ignored-translation',
        context_snippet: null,
        created_at: '2026-04-04T08:00:00.000Z',
      },
      {
        id: 'w2',
        user_id: 'user-1',
        book_id: 'book-1',
        list_id: 'list-1',
        source_lang: 'es',
        target_lang: 'en',
        term: 'target-term',
        term_normalized: 'target-term',
        translation: 'target-translation',
        context_snippet: null,
        created_at: '2026-04-04T09:00:00.000Z',
      },
    ]);
    mockFetchStudyWordReviews.mockImplementation(async () => (currentReview ? [currentReview] : []));
    mockUpsertStudyWordReview.mockImplementation(async (_studyWordId: string, rating: 'again' | 'hard' | 'good' | 'easy') => {
      if (rating === 'hard') {
        currentReview = {
          study_word_id: 'w2',
          next_review_at: '2026-04-04T09:10:00.000Z',
          last_rating: 'hard',
        };
        return;
      }
      if (rating === 'good' || rating === 'easy') {
        currentReview = {
          study_word_id: 'w2',
          next_review_at: '2026-04-05T09:00:00.000Z',
          last_rating: 'good',
        };
      }
    });
    mockRecordVocabReviewed.mockResolvedValue(undefined);
    mockApplyGardenProgress.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('only renders the supplied focus-pack word IDs', async () => {
    const { getByText, queryByText } = render(<FlashcardsScreen />);

    await waitFor(() => {
      expect(getByText('target-term')).toBeTruthy();
      expect(queryByText('ignored-term')).toBeNull();
      expect(getByText('Unseen: 1  ·  Learning: 0  ·  Learned: 0')).toBeTruthy();
    });
  });

  it('shows pack completion after one pass in free-study focus packs', async () => {
    mockPreferredStudyMethod = 'free';

    const { getByText } = render(<FlashcardsScreen />);

    await waitFor(() => {
      expect(getByText('target-term')).toBeTruthy();
      expect(getByText('1 of 1')).toBeTruthy();
    });

    fireEvent.press(getByText('Next'));

    await waitFor(() => {
      expect(getByText('Pack complete')).toBeTruthy();
      expect(getByText("You finished today's 1-card focus pack.")).toBeTruthy();
    });
  });

});
