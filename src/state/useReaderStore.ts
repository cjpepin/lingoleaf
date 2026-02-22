/**
 * Reader state management
 * Handles reader progress and UI state
 */

import { create } from 'zustand';

interface ReaderStore {
  currentPage: number;
  totalPages: number;
  pageLoading: boolean;
  chapterLeftPct: number | null;
  /** Current page within the current chapter/section (1-based) */
  chapterPage: number | null;
  /** Total pages in the current chapter/section */
  chapterTotal: number | null;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setPageLoading: (loading: boolean) => void;
  setChapterLeftPct: (pct: number | null) => void;
  setChapterDisplayed: (page: number, total: number) => void;
}

export const useReaderStore = create<ReaderStore>((set) => ({
  currentPage: 1,
  totalPages: 0,
  pageLoading: false,
  chapterLeftPct: null,
  chapterPage: null,
  chapterTotal: null,

  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  setPageLoading: (loading) => set({ pageLoading: loading }),
  setChapterLeftPct: (pct) => set({ chapterLeftPct: pct }),
  setChapterDisplayed: (page, total) => set({ chapterPage: page, chapterTotal: total }),
}));

