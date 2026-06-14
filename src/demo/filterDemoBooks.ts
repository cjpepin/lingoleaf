import type { Book } from '@/supabase/types';

export type DemoBookFilterInput = {
  search?: string;
  author?: string;
  language?: string;
  languages?: string[];
  subjects?: string[];
  difficulty?: 'Easy' | 'Med' | 'Hard';
  lengthBucket?: 'short' | 'medium' | 'long';
  tags?: string[];
  shortWins?: boolean;
  shelfType?: 'all' | 'start_easy' | 'short_wins' | 'popular';
  source?: string;
  limit?: number;
  offset?: number;
  cursor?: number;
};

function compareLexicalThenWords(a: Book, b: Book): number {
  const lexicalDelta = (a.lexical_score ?? 999) - (b.lexical_score ?? 999);
  if (lexicalDelta !== 0) return lexicalDelta;
  return (a.word_count ?? 999_999) - (b.word_count ?? 999_999);
}

function compareWordsThenLexical(a: Book, b: Book): number {
  const wordDelta = (a.word_count ?? 999_999) - (b.word_count ?? 999_999);
  if (wordDelta !== 0) return wordDelta;
  return compareLexicalThenWords(a, b);
}

function comparePopular(a: Book, b: Book): number {
  const popDelta = (b.popularity_score ?? 0) - (a.popularity_score ?? 0);
  if (popDelta !== 0) return popDelta;
  const createdDelta = b.created_at.localeCompare(a.created_at);
  if (createdDelta !== 0) return createdDelta;
  return a.id.localeCompare(b.id);
}

export function filterDemoBooks(books: Book[], filters?: DemoBookFilterInput): Book[] {
  let result = [...books];

  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    result = result.filter(
      (book) =>
        book.title.toLowerCase().includes(search) ||
        (book.author ?? '').toLowerCase().includes(search),
    );
  }

  const author = filters?.author?.trim().toLowerCase();
  if (author) {
    result = result.filter((book) => (book.author ?? '').toLowerCase().includes(author));
  }

  const languages = filters?.languages?.length
    ? filters.languages.map((lang) => lang.trim()).filter(Boolean)
    : null;
  if (languages && languages.length > 0) {
    result = result.filter((book) => book.source_lang != null && languages.includes(book.source_lang));
  } else {
    const language = filters?.language?.trim();
    if (language) {
      result = result.filter((book) => book.source_lang === language);
    }
  }

  const subjects = filters?.subjects?.map((subject) => subject.trim()).filter(Boolean) ?? [];
  if (subjects.length > 0) {
    result = result.filter((book) => {
      const bookSubjects = book.subjects ?? [];
      return subjects.some((subject) => bookSubjects.includes(subject));
    });
  }

  const source = filters?.source?.trim();
  if (source) {
    result = result.filter((book) => book.source === source);
  }

  if (filters?.difficulty) {
    result = result.filter((book) => book.difficulty === filters.difficulty);
  }

  if (filters?.shortWins) {
    result = result.filter((book) => (book.word_count ?? Number.MAX_SAFE_INTEGER) <= 35_000);
  } else if (filters?.lengthBucket === 'short') {
    result = result.filter((book) => (book.word_count ?? Number.MAX_SAFE_INTEGER) < 35_000);
  } else if (filters?.lengthBucket === 'medium') {
    result = result.filter((book) => {
      const count = book.word_count ?? 0;
      return count >= 35_000 && count <= 80_000;
    });
  } else if (filters?.lengthBucket === 'long') {
    result = result.filter((book) => (book.word_count ?? 0) > 80_000);
  }

  const tags = filters?.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  if (tags.length > 0) {
    result = result.filter((book) => {
      const bookTags = book.tags ?? [];
      return tags.some((tag) => bookTags.includes(tag));
    });
  }

  const shelfType = filters?.shelfType ?? 'all';
  if (shelfType === 'start_easy') {
    result = result.filter(
      (book) =>
        book.difficulty === 'Easy' &&
        book.estimated_cefr != null &&
        ['A1', 'A2', 'B1'].includes(book.estimated_cefr),
    );
    result.sort(compareLexicalThenWords);
  } else if (shelfType === 'short_wins') {
    result = result.filter(
      (book) =>
        (book.word_count ?? Number.MAX_SAFE_INTEGER) <= 35_000 &&
        (book.difficulty === 'Easy' || book.difficulty === 'Med'),
    );
    result.sort(compareWordsThenLexical);
  } else if (shelfType === 'popular') {
    result.sort(comparePopular);
  } else {
    result.sort(comparePopular);
  }

  if (typeof filters?.limit === 'number' && filters.limit > 0) {
    const offset =
      typeof filters.cursor === 'number' && filters.cursor >= 0
        ? filters.cursor
        : typeof filters.offset === 'number' && filters.offset >= 0
          ? filters.offset
          : 0;
    result = result.slice(offset, offset + filters.limit);
  }

  return result;
}
