import { useReaderStore } from '@/state/useReaderStore';

describe('useReaderStore', () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useReaderStore.setState({
      currentPage: 1,
      totalPages: 0,
      pageLoading: false,
      chapterLeftPct: null,
      chapterPage: null,
      chapterTotal: null,
    });
  });

  it('initializes with default values', () => {
    const state = useReaderStore.getState();
    expect(state.currentPage).toBe(1);
    expect(state.totalPages).toBe(0);
    expect(state.chapterPage).toBeNull();
    expect(state.chapterTotal).toBeNull();
  });

  it('setCurrentPage updates page', () => {
    useReaderStore.getState().setCurrentPage(5);
    expect(useReaderStore.getState().currentPage).toBe(5);
  });

  it('setTotalPages updates total', () => {
    useReaderStore.getState().setTotalPages(42);
    expect(useReaderStore.getState().totalPages).toBe(42);
  });

  it('setChapterDisplayed updates chapter page and total', () => {
    useReaderStore.getState().setChapterDisplayed(3, 10);
    const state = useReaderStore.getState();
    expect(state.chapterPage).toBe(3);
    expect(state.chapterTotal).toBe(10);
  });
});
