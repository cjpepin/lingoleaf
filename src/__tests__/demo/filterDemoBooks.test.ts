import { filterDemoBooks } from '@/demo/filterDemoBooks';
import type { Book } from '@/supabase/types';

const sampleBooks: Book[] = [
  {
    id: 'easy-short',
    title: 'Easy Short',
    author: 'A',
    storage_path: null,
    cover_path: null,
    source_lang: 'en',
    created_at: '2026-01-01T00:00:00.000Z',
    difficulty: 'Easy',
    estimated_cefr: 'A2',
    word_count: 12000,
    lexical_score: 30,
    popularity_score: 50,
  },
  {
    id: 'hard-long',
    title: 'Hard Long',
    author: 'B',
    storage_path: null,
    cover_path: null,
    source_lang: 'es',
    created_at: '2026-01-01T00:00:00.000Z',
    difficulty: 'Hard',
    estimated_cefr: 'C1',
    word_count: 200000,
    lexical_score: 90,
    popularity_score: 99,
  },
  {
    id: 'med-short',
    title: 'Med Short',
    author: 'C',
    storage_path: null,
    cover_path: null,
    source_lang: 'fr',
    created_at: '2026-01-01T00:00:00.000Z',
    difficulty: 'Med',
    estimated_cefr: 'B1',
    word_count: 25000,
    lexical_score: 55,
    popularity_score: 70,
  },
];

describe('filterDemoBooks', () => {
  it('returns start_easy shelf matches only easy A1-A2-B1 books', () => {
    const result = filterDemoBooks(sampleBooks, { shelfType: 'start_easy' });
    expect(result.map((book) => book.id)).toEqual(['easy-short']);
  });

  it('returns short_wins shelf matches short easy/med books', () => {
    const result = filterDemoBooks(sampleBooks, { shelfType: 'short_wins' });
    expect(result.map((book) => book.id)).toEqual(['easy-short', 'med-short']);
  });

  it('applies pagination after shelf filtering', () => {
    const result = filterDemoBooks(sampleBooks, { shelfType: 'short_wins', limit: 1, cursor: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('med-short');
  });
});
