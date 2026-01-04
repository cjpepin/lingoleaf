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
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setPageLoading: (loading: boolean) => void;
  setChapterLeftPct: (pct: number | null) => void;
}

export const useReaderStore = create<ReaderStore>((set) => ({
  currentPage: 1,
  totalPages: 0,
  pageLoading: false,
  chapterLeftPct: null,

  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  setPageLoading: (loading) => set({ pageLoading: loading }),
  setChapterLeftPct: (pct) => set({ chapterLeftPct: pct }),
}));

