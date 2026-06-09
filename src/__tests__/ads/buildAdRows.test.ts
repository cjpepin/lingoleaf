import { buildAdRows } from '@/ads/buildAdRows';
import type { Book } from '@/supabase/types';

function fakeBook(id: string): Book {
  return {
    id,
    title: `Book ${id}`,
    author: 'Author',
    source: 'gutendex',
    source_lang: 'en',
    epub_url: '',
    storage_path: '',
    cover_url: null,
    cover_path: null,
    subjects: [],
    description: null,
    created_at: new Date().toISOString(),
  } as Book;
}

describe('buildAdRows', () => {
  it('returns empty array for empty input', () => {
    const rows = buildAdRows([], { columns: 3, adEveryRows: 4 });
    expect(rows).toEqual([]);
  });

  it('chunks books into rows of N columns', () => {
    const books = [fakeBook('1'), fakeBook('2'), fakeBook('3'), fakeBook('4'), fakeBook('5')];
    const rows = buildAdRows(books, { columns: 3, adEveryRows: 100 });
    const bookRows = rows.filter((r) => r.type === 'books');
    expect(bookRows).toHaveLength(2);
    expect((bookRows[0] as any).items).toHaveLength(3);
    expect((bookRows[1] as any).items).toHaveLength(2);
  });

  it('inserts ad rows at the correct interval', () => {
    const books = Array.from({ length: 12 }, (_, i) => fakeBook(String(i)));
    const rows = buildAdRows(books, { columns: 3, adEveryRows: 2 });
    const types = rows.map((r) => r.type);
    // 4 book rows, with ads after every 2: books, books, ad, books, books, ad
    expect(types).toEqual(['books', 'books', 'ad', 'books', 'books', 'ad']);
  });

  it('handles 1 column layout', () => {
    const books = [fakeBook('1'), fakeBook('2'), fakeBook('3')];
    const rows = buildAdRows(books, { columns: 1, adEveryRows: 2 });
    const types = rows.map((r) => r.type);
    expect(types).toEqual(['books', 'books', 'ad', 'books']);
  });

  it('each row has unique keys', () => {
    const books = Array.from({ length: 9 }, (_, i) => fakeBook(String(i)));
    const rows = buildAdRows(books, { columns: 3, adEveryRows: 2 });
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('clamps columns and adEveryRows to at least 1', () => {
    const books = [fakeBook('1'), fakeBook('2')];
    const rows = buildAdRows(books, { columns: 0, adEveryRows: 0 });
    expect(rows.length).toBeGreaterThan(0);
  });
});
