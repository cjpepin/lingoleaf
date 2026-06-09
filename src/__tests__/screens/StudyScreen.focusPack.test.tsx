import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import StudyScreen from '@/screens/StudyScreen';

const mockNavigate = jest.fn();
const mockLoadFocusPack = jest.fn();
const mockUseStudyStore = jest.fn();

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
  useAuthStore: () => ({ user: { id: 'user-1' }, isGuest: false }),
}));

jest.mock('@/premium/PremiumProvider', () => ({
  usePremium: () => ({ isPremium: true }),
}));

jest.mock('@/premium/usePremiumGate', () => ({
  usePremiumGate: () => ({ openPaywallOrAuth: jest.fn() }),
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

jest.mock('@/state/useStudyStore', () => ({
  useStudyStore: () => mockUseStudyStore(),
}));

jest.mock('@/study/focusPackService', () => ({
  loadFocusPack: (...args: unknown[]) => mockLoadFocusPack(...args),
}));

jest.mock('@/supabase/queries', () => ({
  createVocabList: jest.fn(),
  deleteStudyWord: jest.fn(),
  deleteVocabList: jest.fn(),
  fetchBookTitlesByIds: jest.fn(),
  fetchStudyWords: jest.fn().mockResolvedValue([]),
  MAX_STUDY_LIST_WORDS: 512,
  moveStudyWordToList: jest.fn(),
  renameVocabList: jest.fn(),
  touchVocabList: jest.fn(),
}));

jest.mock('@/premium/studyListPolicy', () => ({
  checkStudyListCreationEligibility: jest.fn().mockResolvedValue({ ok: true }),
  FREE_STUDY_LIST_CAP: 5,
  getStudyListCap: () => 10,
  getStudyListLimitMessage: () => 'limit',
  recordStudyListCreated: jest.fn(),
}));

jest.mock('@/screens/study/exportCsv', () => ({
  buildStudyWordsAnkiTsv: jest.fn(),
  buildStudyWordsCsv: jest.fn(),
  getStudyExportPath: jest.fn(),
}));

jest.mock('@/screens/study/listAccess', () => ({
  getLockedStudyListIds: () => new Set<string>(),
  sortStudyListsByRecentUpdate: <T,>(items: T[]) => items,
}));

jest.mock('@/components/EmptyState', () => ({
  EmptyState: ({ message }: { message: string }) => {
    const ReactLib = require('react');
    const { Text } = require('react-native');
    return ReactLib.createElement(Text, null, message);
  },
}));

jest.mock('@/components/VocabListPickerModal', () => ({
  VocabListPickerModal: () => null,
}));

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => null,
}));

describe('StudyScreen focus pack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStudyStore.mockReturnValue({
      lists: [
        {
          id: 'list-1',
          user_id: 'user-1',
          name: 'My List',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          last_used_at: null,
        },
      ],
      counts: { 'list-1': 12 },
      allCount: 12,
      hydrateForUser: jest.fn(),
      refreshListsAndCounts: jest.fn().mockResolvedValue(undefined),
      refreshWordsForList: jest.fn().mockResolvedValue(undefined),
      getCachedWords: jest.fn().mockReturnValue([]),
      addListToCache: jest.fn(),
      updateListInCache: jest.fn(),
      removeListFromCache: jest.fn(),
      removeWordFromCache: jest.fn(),
      adjustListCount: jest.fn(),
      adjustAllCount: jest.fn(),
      upsertWordInCache: jest.fn(),
    });
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

  it('shows the focus pack and still keeps full-list study controls', async () => {
    const { getByText } = render(<StudyScreen />);

    await waitFor(() => {
      expect(getByText('Daily Focus')).toBeTruthy();
      expect(getByText('A calm mix for today.')).toBeTruthy();
      expect(getByText('study.studyAll')).toBeTruthy();
      expect(getByText('My List')).toBeTruthy();
    });
  });
});
