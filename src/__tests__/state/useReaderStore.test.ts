import { useReaderStore } from '@/state/useReaderStore';

describe('useReaderStore', () => {
  beforeEach(() => {
    useReaderStore.setState({ progressByBook: {} });
  });

  it('initializes unknown books with empty progress defaults', () => {
    const state = useReaderStore.getState();
    const unknown = state.progressByBook.bookA;
    expect(unknown).toBeUndefined();
  });

  it('updates progress for a specific book id', () => {
    const store = useReaderStore.getState();
    store.setCurrentPage('book-a', 12);
    store.setTotalPages('book-a', 480);
    store.setChapterDisplayed('book-a', 3, 20);

    const next = useReaderStore.getState().progressByBook['book-a'];
    expect(next.currentPage).toBe(12);
    expect(next.totalPages).toBe(480);
    expect(next.chapterPage).toBe(3);
    expect(next.chapterTotal).toBe(20);
  });

  it('does not leak progress between books', () => {
    const store = useReaderStore.getState();
    store.setCurrentPage('book-a', 82);
    store.setTotalPages('book-a', 684);
    store.setCurrentPage('book-b', 14);
    store.setTotalPages('book-b', 211);

    const a = useReaderStore.getState().progressByBook['book-a'];
    const b = useReaderStore.getState().progressByBook['book-b'];
    expect(a.currentPage).toBe(82);
    expect(a.totalPages).toBe(684);
    expect(b.currentPage).toBe(14);
    expect(b.totalPages).toBe(211);
  });

  it('resets a single book without clearing others', () => {
    const store = useReaderStore.getState();
    store.setCurrentPage('book-a', 12);
    store.setTotalPages('book-a', 280);
    store.setCurrentPage('book-b', 9);
    store.setTotalPages('book-b', 120);

    store.resetProgress('book-a');

    const a = useReaderStore.getState().progressByBook['book-a'];
    const b = useReaderStore.getState().progressByBook['book-b'];
    expect(a.currentPage).toBe(0);
    expect(a.totalPages).toBe(0);
    expect(a.pageLoading).toBe(true);
    expect(b.currentPage).toBe(9);
    expect(b.totalPages).toBe(120);
  });
});
