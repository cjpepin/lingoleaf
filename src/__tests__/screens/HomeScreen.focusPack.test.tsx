import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/screens/HomeScreen';

const mockNavigate = jest.fn();
const mockFetchHistoryBooks = jest.fn();
const mockFetchVocabLists = jest.fn();
const mockFetchFlashcardStats = jest.fn();
const mockCountStudyWordsForList = jest.fn();
const mockLoadFocusPack = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactLib.useEffect(() => {
        const cleanup = effect();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [effect]);
    },
  };
});

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}));

const mockRefreshListsAndCounts = jest.fn().mockResolvedValue(undefined);

jest.mock('@/state/useStudyStore', () => ({
  useStudyStore: Object.assign(
    jest.fn(() => ({ counts: {} })),
    {
      getState: () => ({
        lists: [],
        counts: {},
        hydrateForUser: jest.fn(),
        refreshListsAndCounts: mockRefreshListsAndCounts,
      }),
    },
  ),
}));

jest.mock('@/premium/PremiumProvider', () => ({
  usePremium: () => ({ isPremium: true }),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    if (key === 'study.focusPackMixLabel') {
      return `${params?.reviewCount} review · ${params?.newCount} new`;
    }
    if (key === 'study.focusPackCompletedBadge') return 'Completed';
    if (key === 'study.focusPackCompletedCoachLine') {
      return "Good job. Today's pack is complete, and you can keep reviewing it anytime.";
    }
    if (key === 'study.focusPackReviewCta') return 'Review again';
    return key;
  },
}));

jest.mock('@/hooks/useGardenState', () => ({
  useGardenState: () => ({
    snapshot: {
      state: { stage: 'seed', freshness: 'fresh', streak_days: 0, total_gp: 0 },
      daily: { reading_minutes: 0, saved_count: 0, learned_count: 0 },
      goalMinutes: 10,
      savedGoal: 10,
      learnedGoal: 5,
      primaryGoal: 'reading_minutes',
      goalPriority: ['reading_minutes', 'words_saved', 'words_learned'],
    },
    loading: false,
    refresh: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/supabase/queries', () => ({
  fetchHistoryBooks: (...args: unknown[]) => mockFetchHistoryBooks(...args),
  fetchVocabLists: (...args: unknown[]) => mockFetchVocabLists(...args),
  fetchFlashcardStats: (...args: unknown[]) => mockFetchFlashcardStats(...args),
  countStudyWordsForList: (...args: unknown[]) => mockCountStudyWordsForList(...args),
  touchVocabList: jest.fn(),
}));

jest.mock('@/study/focusPackService', () => ({
  loadFocusPack: (...args: unknown[]) => mockLoadFocusPack(...args),
}));

jest.mock('@/components/progress/GardenSummaryCard', () => ({
  GardenSummaryCard: () => null,
}));

jest.mock('@/components/BookGridItem', () => ({
  BookGridItem: () => null,
}));

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => null,
}));

describe('HomeScreen focus pack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshListsAndCounts.mockResolvedValue(undefined);
    mockFetchHistoryBooks.mockResolvedValue([]);
    mockFetchVocabLists.mockResolvedValue([]);
    mockFetchFlashcardStats.mockResolvedValue({ unseen: 0, learning: 0, learned: 0 });
    mockCountStudyWordsForList.mockResolvedValue(0);
    mockLoadFocusPack.mockResolvedValue({
      id: 'focus_hash',
      listId: null,
      mode: 'focus_pack',
      wordIds: ['w1', 'w2'],
      targetCount: 2,
      reviewCount: 1,
      newCount: 1,
      title: 'Daily Focus',
      coachLine: 'A calm mix for today.',
      createdAt: '2026-04-04T12:00:00.000Z',
      expiresAt: '2026-04-05T12:00:00.000Z',
    });
  });

  it('shows the focus pack card when one is available', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('Daily Focus')).toBeTruthy();
      expect(getByText('A calm mix for today.')).toBeTruthy();
      expect(getByText('study.focusPackCta')).toBeTruthy();
    });
  });

  it('shows completed pack status and opens rereview mode', async () => {
    mockLoadFocusPack.mockResolvedValue({
      id: 'focus_hash',
      listId: null,
      mode: 'focus_pack',
      wordIds: ['w1', 'w2'],
      targetCount: 2,
      reviewCount: 1,
      newCount: 1,
      title: 'Daily Focus',
      coachLine: 'A calm mix for today.',
      isCompleted: true,
      completedAt: '2026-04-04T13:00:00.000Z',
      createdAt: '2026-04-04T12:00:00.000Z',
      expiresAt: '2026-04-05T12:00:00.000Z',
    });

    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('Completed')).toBeTruthy();
      expect(getByText("Good job. Today's pack is complete, and you can keep reviewing it anytime.")).toBeTruthy();
      expect(getByText('Review again')).toBeTruthy();
    });

    fireEvent.press(getByText('Review again'));

    expect(mockNavigate).toHaveBeenCalledWith('Flashcards', expect.objectContaining({
      sessionMode: 'focus_pack',
      reviewAllWords: true,
    }));
  });
});
