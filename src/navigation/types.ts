/**
 * Navigation types
 * Type-safe navigation params
 */

export type TabParamList = {
  Library: undefined;
  History: undefined;
  Home: undefined;
  Study: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: { mode?: 'upgrade' | 'signin' } | undefined;
  MainTabs: undefined;
  Reader: { bookId: string; localPath: string };
  BookDetails: { bookId: string };
  Paywall: {
    source: 'settings' | 'export_locked' | 'remove_ads' | 'soft_interstitial';
    placement: string;
  };
  Flashcards: {
    listId: string | null;
    listName: string;
    sessionMode?: 'spaced' | 'free' | 'focus_pack';
    wordIds?: string[];
    reviewAllWords?: boolean;
    packTitle?: string;
    packId?: string;
    packReviewCount?: number;
    packNewCount?: number;
  };
  Settings: undefined;
  MyProgressScreen: undefined;
  AnalyticsDebug: undefined;
  Admin: undefined;
};
