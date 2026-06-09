import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/screens/HomeScreen';

const mockNavigate = jest.fn();
const mockFetchHistoryBooks = jest.fn();
const mockFetchVocabLists = jest.fn();
const mockRefreshGarden = jest.fn();

let mockIsPremium = false;

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

jest.mock('@/premium/PremiumProvider', () => ({
  usePremium: () => ({ isPremium: mockIsPremium }),
}));

jest.mock('@/i18n/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

jest.mock('@/hooks/useGardenState', () => ({
  useGardenState: () => ({
    snapshot: {
      state: {
        stage: 'seed',
        freshness: 'fresh',
        streak_days: 0,
        total_gp: 0,
      },
      daily: {
        reading_minutes: 0,
        saved_count: 0,
        learned_count: 0,
      },
      goalMinutes: 10,
      savedGoal: 10,
      learnedGoal: 5,
      primaryGoal: 'reading_minutes',
      goalPriority: ['reading_minutes', 'words_saved', 'words_learned'],
    },
    loading: false,
    refresh: (...args: unknown[]) => mockRefreshGarden(...args),
  }),
}));

jest.mock('@/supabase/queries', () => ({
  fetchHistoryBooks: (...args: unknown[]) => mockFetchHistoryBooks(...args),
  fetchVocabLists: (...args: unknown[]) => mockFetchVocabLists(...args),
  fetchFlashcardStats: jest.fn(),
  countStudyWordsForList: jest.fn(),
  touchVocabList: jest.fn(),
}));

jest.mock('@/components/progress/GardenSummaryCard', () => ({
  GardenSummaryCard: () => null,
}));

jest.mock('@/components/BookGridItem', () => ({
  BookGridItem: () => null,
}));

jest.mock('@/components/HomeTutorial', () => ({
  HomeTutorial: () => null,
}));

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: ({ placement }: { placement?: string }) => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    return ReactLib.createElement(Text, null, `ad:${placement ?? 'unknown'}`);
  },
}));

describe('HomeScreen ads', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      // eslint-disable-next-line no-console
      console.warn(...args);
    });
    mockFetchHistoryBooks.mockResolvedValue([]);
    mockFetchVocabLists.mockResolvedValue([]);
    mockRefreshGarden.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows between-card ad slots for non-premium users', async () => {
    mockIsPremium = false;
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('ad:home_between_garden_recent')).toBeTruthy();
      expect(getByText('ad:home_between_recent_study')).toBeTruthy();
    });
  });

  it('hides between-card ad slots for premium users', async () => {
    mockIsPremium = true;
    const { queryByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(queryByText('ad:home_between_garden_recent')).toBeNull();
      expect(queryByText('ad:home_between_recent_study')).toBeNull();
    });
  });
});
