/**
 * Demo-mode write paths for IndexedDB (mirrors lingoleaf.supabase/demo/seed.sql).
 */

import { deleteStoreRecord, getStoreRecord, listStoreRecords, putStoreRecord } from '@portfolio/demo-local';
import type {
  Book,
  ReadingSession,
  StudyWord,
  UserBook,
  UserPromptState,
  VocabList,
} from '@/supabase/types';
import { ensureDemoHydrated } from './localRepository';
import { getDb } from './demoDb';
import { DEMO_USER_ID } from './demoUser';

interface VocabReviewRow {
  id: string;
  user_id: string;
  vocab_id: string;
  reviewed_at: string;
}

interface UserPromptStateRow {
  user_id: string;
  last_upgrade_prompt_at?: string | null;
  upgrade_prompt_dismiss_count?: number;
  upgrade_prompt_last_reason?: string | null;
  created_at: string;
  updated_at: string;
}

function toUserPromptState(row: UserPromptStateRow): UserPromptState {
  return {
    user_id: row.user_id,
    last_upgrade_prompt_at: row.last_upgrade_prompt_at ?? null,
    upgrade_prompt_dismiss_count: row.upgrade_prompt_dismiss_count ?? 0,
    upgrade_prompt_last_reason: row.upgrade_prompt_last_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function demoSetStudyWordStarred(studyWordId: string, starred: boolean): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<StudyWord>(db, 'study_words', studyWordId);
  if (!existing) {
    throw new Error('Failed to update starred status — word not found');
  }
  await putStoreRecord(db, 'study_words', studyWordId, { ...existing, starred });
}

export async function demoDeleteStudyWord(id: string): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  await deleteStoreRecord(db, 'study_words', id);
  await deleteStoreRecord(db, 'study_word_reviews', id);
}

export async function demoMoveStudyWordToList(wordId: string, listId: string | null): Promise<StudyWord> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<StudyWord>(db, 'study_words', wordId);
  if (!existing) throw new Error('Study word not found');
  const next: StudyWord = { ...existing, list_id: listId };
  await putStoreRecord(db, 'study_words', wordId, next);
  return next;
}

export async function demoFetchMostRecentVocabList(userId: string): Promise<VocabList | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<VocabList>(db, 'vocab_lists');
  const mine = rows
    .filter((row) => row.user_id === userId)
    .sort((left, right) => {
      const leftUsed = left.last_used_at ?? '';
      const rightUsed = right.last_used_at ?? '';
      if (leftUsed !== rightUsed) return rightUsed.localeCompare(leftUsed);
      return left.created_at.localeCompare(right.created_at);
    });
  return mine[0] ?? null;
}

export async function demoCreateVocabList(
  userId: string,
  name: string,
  maxLists = 5,
): Promise<VocabList> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await listStoreRecords<VocabList>(db, 'vocab_lists');
  const mine = existing.filter((row) => row.user_id === userId);
  if (mine.length >= maxLists) {
    throw new Error(`List limit reached (max ${maxLists})`);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const row: VocabList = {
    id,
    user_id: userId,
    name,
    created_at: now,
    updated_at: now,
    last_used_at: null,
  };
  await putStoreRecord(db, 'vocab_lists', id, row);
  return row;
}

export async function demoRenameVocabList(listId: string, name: string): Promise<VocabList> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<VocabList>(db, 'vocab_lists', listId);
  if (!existing) throw new Error('Vocab list not found');
  const next: VocabList = {
    ...existing,
    name,
    updated_at: new Date().toISOString(),
  };
  await putStoreRecord(db, 'vocab_lists', listId, next);
  return next;
}

export async function demoDeleteVocabList(listId: string): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  const words = await listStoreRecords<StudyWord>(db, 'study_words');
  await Promise.all(
    words
      .filter((word) => word.list_id === listId)
      .map(async (word) => {
        await putStoreRecord(db, 'study_words', word.id, { ...word, list_id: null });
      }),
  );
  await deleteStoreRecord(db, 'vocab_lists', listId);
}

export async function demoTouchVocabList(listId: string): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<VocabList>(db, 'vocab_lists', listId);
  if (!existing) return;
  const now = new Date().toISOString();
  await putStoreRecord(db, 'vocab_lists', listId, {
    ...existing,
    last_used_at: now,
    updated_at: now,
  });
}

export async function demoFetchBookTitlesByIds(bookIds: string[]): Promise<Record<string, string>> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  const ids = new Set(bookIds);
  const map: Record<string, string> = {};
  for (const book of books) {
    if (ids.has(book.id)) map[book.id] = book.title ?? book.id;
  }
  return map;
}

export async function demoCountAllUserHighlights(userId: string): Promise<number> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<UserBook>(db, 'user_books');
  return rows
    .filter((row) => row.user_id === userId)
    .reduce((sum, row) => sum + (Array.isArray(row.highlights) ? row.highlights.length : 0), 0);
}

export async function demoRecordReadingSession(
  session: Omit<ReadingSession, 'id' | 'created_at'>,
): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  const id = crypto.randomUUID();
  const row: ReadingSession = {
    ...session,
    id,
    created_at: new Date().toISOString(),
  };
  await putStoreRecord(db, 'reading_sessions', id, row);
}

export async function demoRecordVocabReviewed(userId: string, vocabId: string): Promise<void> {
  await ensureDemoHydrated();
  const db = await getDb();
  const id = crypto.randomUUID();
  const row: VocabReviewRow = {
    id,
    user_id: userId,
    vocab_id: vocabId,
    reviewed_at: new Date().toISOString(),
  };
  await putStoreRecord(db, 'vocab_reviews', id, row);
}

export async function demoSetUserBookReading(userId: string, bookId: string): Promise<UserBook> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existing = await getStoreRecord<UserBook>(db, 'user_books', bookId);
  const now = new Date().toISOString();
  const next: UserBook = {
    user_id: userId,
    book_id: bookId,
    last_cfi: existing?.last_cfi ?? null,
    highlights: existing?.highlights ?? [],
    last_read_at: now,
    status: 'reading',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putStoreRecord(db, 'user_books', bookId, next);
  return next;
}

export async function demoHasReadingHistory(userId: string): Promise<boolean> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<UserBook>(db, 'user_books');
  return rows.some((row) => row.user_id === userId && row.status !== 'saved_for_later');
}

export async function demoFetchUserPromptState(userId: string): Promise<UserPromptState | null> {
  await ensureDemoHydrated();
  const db = await getDb();
  const row = await getStoreRecord<UserPromptStateRow>(db, 'user_prompt_state', userId);
  return row ? toUserPromptState(row) : null;
}

export async function demoUpsertUserPromptState(
  state: Pick<UserPromptState, 'user_id'> &
    Partial<
      Pick<
        UserPromptState,
        'last_upgrade_prompt_at' | 'upgrade_prompt_dismiss_count' | 'upgrade_prompt_last_reason'
      >
    >,
): Promise<UserPromptState> {
  await ensureDemoHydrated();
  const db = await getDb();
  const existingRow = await getStoreRecord<UserPromptStateRow>(db, 'user_prompt_state', state.user_id);
  const existing = existingRow ? toUserPromptState(existingRow) : null;
  const now = new Date().toISOString();
  const next: UserPromptStateRow = {
    user_id: state.user_id,
    last_upgrade_prompt_at: state.last_upgrade_prompt_at ?? existing?.last_upgrade_prompt_at ?? null,
    upgrade_prompt_dismiss_count:
      state.upgrade_prompt_dismiss_count ?? existing?.upgrade_prompt_dismiss_count ?? 0,
    upgrade_prompt_last_reason:
      state.upgrade_prompt_last_reason ?? existing?.upgrade_prompt_last_reason ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putStoreRecord(db, 'user_prompt_state', state.user_id, next);
  return toUserPromptState(next);
}

export async function demoGenerateStudyPackMetadata(request: {
  review_count: number;
  new_count: number;
}): Promise<{
  title: string;
  coachLine: string;
  source: 'fallback';
  fallbackReason: string;
}> {
  const reviewCount = request.review_count ?? 0;
  const newCount = request.new_count ?? 0;
  return {
    title: 'Daily focus pack',
    coachLine: `${reviewCount} to review · ${newCount} new`,
    source: 'fallback',
    fallbackReason: 'demo_mode',
  };
}

export async function demoListVocabReviews(userId: string): Promise<VocabReviewRow[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const rows = await listStoreRecords<VocabReviewRow>(db, 'vocab_reviews');
  return rows.filter((row) => row.user_id === userId);
}

export async function demoFetchDistinctBookSubjects(language?: string): Promise<string[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  const lang = language?.trim();
  const subjects = new Set<string>();
  for (const book of books) {
    if (lang && book.source_lang !== lang) continue;
    const text = book.subjects_text ?? '';
    text.split(',').forEach((part) => {
      const subject = part.trim();
      if (subject) subjects.add(subject);
    });
  }
  return Array.from(subjects).sort();
}

export async function demoFetchDistinctBookLanguages(subjects?: string[]): Promise<string[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  const subjectFilter = subjects?.map((s) => s.trim()).filter(Boolean) ?? [];
  const langs = new Set<string>();
  for (const book of books) {
    if (!book.source_lang) continue;
    if (subjectFilter.length > 0) {
      const text = book.subjects_text ?? '';
      const matches = subjectFilter.some((subject) => text.includes(subject));
      if (!matches) continue;
    }
    langs.add(book.source_lang);
  }
  return Array.from(langs).sort();
}

export async function demoFetchDistinctBookTags(_language?: string): Promise<string[]> {
  await ensureDemoHydrated();
  const db = await getDb();
  const books = await listStoreRecords<Book>(db, 'books');
  const tags = new Set<string>();
  for (const book of books) {
    if (Array.isArray(book.tags)) {
      book.tags.forEach((tag) => {
        if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
      });
    }
  }
  return Array.from(tags).sort();
}

export function demoPremiumStatus(): { is_premium: boolean; premium_plan: 'monthly' | 'yearly' | 'lifetime' | null } {
  return { is_premium: false, premium_plan: null };
}

export async function demoDeleteUserAccount(_userId: string): Promise<void> {
  // Demo data is ephemeral per browser — no remote account to delete.
}

export async function demoIsUserSoftDeleted(_userId: string): Promise<boolean> {
  return false;
}

export async function demoReactivateUserAccount(): Promise<void> {
  // no-op in demo
}
