import {
  demoSessionId,
  hydrateIfEmpty,
  listStoreRecords,
  putStoreRecord,
  type DemoSeedPayload,
} from '@portfolio/demo-local';
import seed from './seed.json';
import { getDb } from './demoDb';
import type { BookFilters } from '@/supabase/queries';
import type {
  Book,
  ReadingSession,
  StudyWord,
  TranslationRequest,
  TranslationResponse,
  UserBook,
  UserBookStatus,
  VocabList,
} from '@/supabase/types';

type BookWithStatus = Book & { status: UserBookStatus };
import { DEMO_USER_ID } from './demoUser';
import { demoApiBase, demoTranslate } from './demoApi';

export async function ensureDemoHydrated(): Promise<void> {
  const db = await getDb();
  await hydrateIfEmpty(db, seed as DemoSeedPayload);
}

export function getDemoSessionId(): string {
  return demoSessionId();
}

export async function demoFetchBooks(): Promise<Book[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  return listStoreRecords<Book>(db, 'books');
}

export async function demoFetchBook(bookId: string): Promise<Book | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  return books.find((book) => book.id === bookId) ?? null;
}

export async function demoFetchUserBook(bookId: string): Promise<UserBook | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<UserBook>(db, 'user_books');
  return rows.find((row) => row.user_id === DEMO_USER_ID && row.book_id === bookId) ?? null;
}

export async function demoUpsertUserBook(
  input: Pick<UserBook, 'book_id'> & Partial<Pick<UserBook, 'last_cfi' | 'highlights' | 'status'>>,
): Promise<UserBook> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await demoFetchUserBook(input.book_id);
  const now = new Date().toISOString();
  const next: UserBook = {
    user_id: DEMO_USER_ID,
    book_id: input.book_id,
    last_cfi: input.last_cfi ?? existing?.last_cfi ?? null,
    highlights: input.highlights ?? existing?.highlights ?? [],
    last_read_at: now,
    status: input.status ?? existing?.status ?? 'reading',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putStoreRecord(db, 'user_books', input.book_id, next);
  return next;
}

export async function demoCreateStudyWord(input: Omit<StudyWord, 'id' | 'user_id' | 'created_at'>): Promise<StudyWord> {
  await ensureDemoHydrated();
  const db = await getDb();
  const id = crypto.randomUUID();
  const row: StudyWord = {
    ...input,
    id,
    user_id: DEMO_USER_ID,
    created_at: new Date().toISOString(),
  };
  await putStoreRecord(db, 'study_words', id, row);
  return row;
}

export async function demoFetchStudyWords(userId?: string, listId?: string | null, bookId?: string): Promise<StudyWord[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<StudyWord>(db, 'study_words');
  return rows
    .filter((row) => row.user_id === (userId ?? DEMO_USER_ID))
    .filter((row) => (typeof listId === 'string' ? row.list_id === listId : true))
    .filter((row) => (!bookId || row.book_id === bookId))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function demoFetchVocabLists(userId?: string): Promise<VocabList[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<VocabList>(db, 'vocab_lists');
  return rows
    .filter((row) => row.user_id === (userId ?? DEMO_USER_ID))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function demoFetchReadingSessions(userId?: string): Promise<ReadingSession[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<ReadingSession>(db, 'reading_sessions');
  return rows
    .filter((row) => row.user_id === (userId ?? DEMO_USER_ID))
    .sort((left, right) => right.started_at.localeCompare(left.started_at));
}

export async function demoFetchHistoryBooks(filters?: BookFilters): Promise<BookWithStatus[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  const userBooks = await listStoreRecords<UserBook>(db, 'user_books');
  const byBookId = new Map(
    userBooks
      .filter((row) => row.user_id === DEMO_USER_ID)
      .map((row) => [row.book_id, row]),
  );

  let rows: BookWithStatus[] = books
    .filter((book) => byBookId.has(book.id))
    .map((book) => {
      const userBook = byBookId.get(book.id);
      return {
        ...book,
        status: userBook?.status ?? 'reading',
      };
    });

  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (book) =>
        book.title.toLowerCase().includes(search) ||
        (book.author ?? '').toLowerCase().includes(search),
    );
  }

  const languages = filters?.languages?.length
    ? filters.languages.map((language) => language.trim()).filter(Boolean)
    : null;
  if (languages && languages.length > 0) {
    rows = rows.filter((book) => book.source_lang && languages.includes(book.source_lang));
  } else {
    const language = filters?.language?.trim();
    if (language) {
      rows = rows.filter((book) => book.source_lang === language);
    }
  }

  rows.sort((left, right) => {
    const leftTime = byBookId.get(left.id)?.last_read_at ?? '';
    const rightTime = byBookId.get(right.id)?.last_read_at ?? '';
    return rightTime.localeCompare(leftTime);
  });

  if (typeof filters?.limit === 'number' && filters.limit > 0) {
    const offset = typeof filters.offset === 'number' && filters.offset >= 0 ? filters.offset : 0;
    rows = rows.slice(offset, offset + filters.limit);
  }

  return rows;
}

export async function demoFetchUserBooksLastRead(): Promise<Array<{ book_id: string; last_read_at: string | null }>> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<UserBook>(db, 'user_books');
  return rows
    .filter((row) => row.user_id === DEMO_USER_ID)
    .map((row) => ({ book_id: row.book_id, last_read_at: row.last_read_at ?? null }));
}

export async function demoTranslateText(request: TranslationRequest): Promise<TranslationResponse> {
  return demoTranslate(request);
}

export function demoApiConfigured(): boolean {
  return demoApiBase().length > 0;
}
