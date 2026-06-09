/**
 * Reader state management
 * Stores reader progress per book to prevent cross-book state bleed.
 */

import { create } from 'zustand';

export interface ReaderBookProgress {
  currentPage: number;
  totalPages: number;
  pageLoading: boolean;
  chapterLeftPct: number | null;
  /** Current page within the current chapter/section (1-based) */
  chapterPage: number | null;
  /** Total pages in the current chapter/section */
  chapterTotal: number | null;
}

interface ReaderStore {
  progressByBook: Record<string, ReaderBookProgress>;
  setCurrentPage: (bookId: string, page: number) => void;
  setTotalPages: (bookId: string, pages: number) => void;
  setPageLoading: (bookId: string, loading: boolean) => void;
  setChapterLeftPct: (bookId: string, pct: number | null) => void;
  setChapterDisplayed: (bookId: string, page: number, total: number) => void;
  resetProgress: (bookId: string) => void;
}

const DEFAULT_PROGRESS: ReaderBookProgress = {
  currentPage: 0,
  totalPages: 0,
  pageLoading: true,
  chapterLeftPct: null,
  chapterPage: null,
  chapterTotal: null,
};

function resolveBookProgress(
  progressByBook: Record<string, ReaderBookProgress>,
  bookId: string
): ReaderBookProgress {
  return progressByBook[bookId] ?? DEFAULT_PROGRESS;
}

export const useReaderStore = create<ReaderStore>((set) => ({
  progressByBook: {},

  setCurrentPage: (bookId, page) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: {
          ...resolveBookProgress(state.progressByBook, bookId),
          currentPage: page,
        },
      },
    })),

  setTotalPages: (bookId, pages) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: {
          ...resolveBookProgress(state.progressByBook, bookId),
          totalPages: pages,
        },
      },
    })),

  setPageLoading: (bookId, loading) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: {
          ...resolveBookProgress(state.progressByBook, bookId),
          pageLoading: loading,
        },
      },
    })),

  setChapterLeftPct: (bookId, pct) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: {
          ...resolveBookProgress(state.progressByBook, bookId),
          chapterLeftPct: pct,
        },
      },
    })),

  setChapterDisplayed: (bookId, page, total) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: {
          ...resolveBookProgress(state.progressByBook, bookId),
          chapterPage: page,
          chapterTotal: total,
        },
      },
    })),

  resetProgress: (bookId) =>
    set((state) => ({
      progressByBook: {
        ...state.progressByBook,
        [bookId]: { ...DEFAULT_PROGRESS },
      },
    })),
}));
