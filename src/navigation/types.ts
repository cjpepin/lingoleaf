/**
 * Navigation types
 * Type-safe navigation params
 */

export type TabParamList = {
  Library: undefined;
  History: undefined;
  Study: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  Reader: { bookId: string; localPath: string };
  BookDetails: { bookId: string };
  Flashcards: { listId: string | null; listName: string };
  Settings: undefined;
  Admin: undefined;
};

