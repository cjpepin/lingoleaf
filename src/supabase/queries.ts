/**
 * Centralized Supabase queries
 * All database operations go through here
 */

import { isDemoMode } from '@/demo/config';
import {
  demoCreateStudyWord,
  demoFetchBook,
  demoFetchBooks,
  demoFetchHistoryBooks,
  demoFetchStudyWords,
  demoFetchUserBook,
  demoFetchUserBooksLastRead,
  demoFetchVocabLists,
  demoTranslateText,
  demoUpsertUserBook,
} from '@/demo/localRepository';
import { logger } from '@/utils/logger';
import { track } from '@/analytics/client';
import { supabase } from './client';
import type {
  Book,
  StudyWord,
  StudyWordReview,
  ReadingSession,
  UserGardenDailyProgress,
  UserGardenState,
  UserBookStatus,
  UserSettings,
  TranslationRequest,
  TranslationResponse,
  UserBook,
  VocabList,
  UserBookHighlight,
  UserPromptState,
} from './types';
import {
  computeGardenProgressUpdate,
  emptyDailyProgress,
  localDateKey,
  resolveGardenFreshness,
  resolveGardenStage,
  regressGardenGp,
  type GardenProgressInput,
  type PrimaryGoal,
} from '@/garden/model';
import { defaultSubGoals, normalizePrimaryGoal, normalizeSubGoals } from '@/utils/goalHierarchy';
import { sanitizeMutableUserSettingsInput, type ClientUserSettingsUpsert } from './userSettingsInput';

export type BookWithStatus = Book & { status: UserBookStatus };
export type BookDifficulty = 'Easy' | 'Med' | 'Hard';
export type BookLengthBucket = 'short' | 'medium' | 'long';
export type LibraryShelfType = 'all' | 'start_easy' | 'short_wins' | 'popular';

// Books
export interface BookFilters {
  /** Title/author search (used in History; Library uses main app search) */
  search?: string;
  author?: string;
  /** Single language (legacy); prefer languages when multiselect */
  language?: string;
  /** Multiple source languages (multiselect); books matching any are returned */
  languages?: string[];
  /** Array of subject values (multiselect); books matching any are returned */
  subjects?: string[];
  difficulty?: BookDifficulty;
  lengthBucket?: BookLengthBucket;
  tags?: string[];
  shortWins?: boolean;
  shelfType?: LibraryShelfType;
  source?: string;
  limit?: number;
  offset?: number;
  cursor?: number;
}

export async function fetchBooks(filters?: BookFilters): Promise<Book[]> {
  if (isDemoMode()) {
    let books = await demoFetchBooks();
    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      books = books.filter(
        (book) =>
          book.title.toLowerCase().includes(search) ||
          (book.author ?? '').toLowerCase().includes(search),
      );
    }
    const language = filters?.language?.trim();
    if (language) {
      books = books.filter((book) => book.source_lang === language);
    }
    if (typeof filters?.limit === 'number' && filters.limit > 0) {
      const offset =
        typeof filters.cursor === 'number' && filters.cursor >= 0
          ? filters.cursor
          : typeof filters.offset === 'number' && filters.offset >= 0
            ? filters.offset
            : 0;
      books = books.slice(offset, offset + filters.limit);
    }
    return books;
  }

  let query = supabase.from('books').select('*');

  const search = filters?.search?.trim();
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  const author = filters?.author?.trim();
  if (author) {
    query = query.ilike('author', `%${author}%`);
  }

  const languages = filters?.languages?.length
    ? filters.languages.map((l) => String(l).trim()).filter(Boolean)
    : null;
  if (languages && languages.length > 0) {
    query = query.in('source_lang', languages);
  } else {
    const language = filters?.language?.trim();
    if (language) {
      query = query.eq('source_lang', language);
    }
  }

  const subjects = filters?.subjects;
  if (subjects && Array.isArray(subjects) && subjects.length > 0) {
    const trimmed = subjects.map((s) => String(s).trim()).filter(Boolean);
    if (trimmed.length > 0) {
      query = query.overlaps('subjects', trimmed);
    }
  }

  const source = filters?.source?.trim();
  if (source) {
    query = query.eq('source', source);
  }

  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters?.shortWins) {
    query = query.lte('word_count', 35000);
  } else if (filters?.lengthBucket === 'short') {
    query = query.lt('word_count', 35000);
  } else if (filters?.lengthBucket === 'medium') {
    query = query.gte('word_count', 35000).lte('word_count', 80000);
  } else if (filters?.lengthBucket === 'long') {
    query = query.gt('word_count', 80000);
  }

  const tags = filters?.tags?.map((t) => String(t).trim()).filter(Boolean) ?? [];
  if (tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  const shelfType = filters?.shelfType ?? 'all';
  if (shelfType === 'start_easy') {
    query = query
      .in('difficulty', ['Easy'])
      .in('estimated_cefr', ['A1', 'A2', 'B1'])
      .order('lexical_score', { ascending: true, nullsFirst: false })
      .order('word_count', { ascending: true, nullsFirst: false });
  } else if (shelfType === 'short_wins') {
    query = query
      .lte('word_count', 35000)
      .in('difficulty', ['Easy', 'Med'])
      .order('word_count', { ascending: true, nullsFirst: false })
      .order('lexical_score', { ascending: true, nullsFirst: false });
  } else if (shelfType === 'popular') {
    query = query
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
  } else {
    // Stable ordering for pagination
    query = query
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
  }

  if (typeof filters?.limit === 'number' && filters.limit > 0) {
    const baseOffset = typeof filters.cursor === 'number' && filters.cursor >= 0
      ? filters.cursor
      : (typeof filters.offset === 'number' && filters.offset >= 0 ? filters.offset : 0);
    const offset = baseOffset;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Fetches distinct subject/genre values for filter. When language is set, only subjects for books in that language. */
export async function fetchBookSubjects(language?: string): Promise<string[]> {
  const pLang = language?.trim() ? language.trim() : null;
  const { data, error } = await supabase.rpc('get_distinct_book_subjects', { p_lang: pLang });
  if (error) {
    logger.warn('Failed to fetch book subjects', error);
    return [];
  }
  return Array.isArray(data) ? data.map((r) => (r?.subject ?? '')).filter(Boolean) : [];
}

/** Fetches distinct language codes for filter. When subjects are set, only languages that have books in those subjects. */
export async function fetchBookLanguages(subjects?: string[]): Promise<string[]> {
  const pSubjects = subjects?.length ? subjects.map((s) => String(s).trim()).filter(Boolean) : null;
  const { data, error } = await supabase.rpc('get_distinct_book_languages', { p_subjects: pSubjects });
  if (error) {
    logger.warn('Failed to fetch book languages', error);
    return [];
  }
  return Array.isArray(data) ? data.map((r) => (r?.lang_code ?? '')).filter(Boolean) : [];
}

/** Fetches distinct tags for books, optionally scoped to a language. */
export async function fetchAvailableTags(language?: string): Promise<string[]> {
  const pLang = language?.trim() ? language.trim() : null;
  const { data, error } = await supabase.rpc('get_distinct_book_tags', { p_lang: pLang });
  if (error) {
    logger.warn('Failed to fetch book tags', error);
    return [];
  }
  return Array.isArray(data) ? data.map((r) => (r?.tag ?? '')).filter(Boolean) : [];
}

export async function fetchBook(id: string): Promise<Book> {
  if (isDemoMode()) {
    const book = await demoFetchBook(id);
    if (!book) throw new Error('Book not found');
    return book;
  }

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function fetchBookTitlesByIds(bookIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(bookIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('books')
    .select('id,title')
    .in('id', ids);

  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.title ?? row.id;
  }
  return map;
}

export async function createBook(book: Omit<Book, 'id' | 'created_at'>): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .insert(book)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateBook(id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Study Words
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardIntervalSettings {
  againCards: number;
  intervalHardMin: number;
  intervalGoodMin: number;
  intervalEasyMin: number;
  multiplier: number;
}

export interface FlashcardStats {
  unseen: number;
  learning: number;
  learned: number;
}

export interface StudyPackMetadataWordInput {
  term: string;
  translation: string;
  context_snippet: string | null;
  source_lang: string;
  target_lang: string;
  list_name?: string | null;
}

export interface StudyPackMetadataRequest {
  words: StudyPackMetadataWordInput[];
  review_count: number;
  new_count: number;
}

export interface StudyPackMetadataResponse {
  title: string;
  coachLine: string;
  groups?: string[];
  source?: 'ai' | 'fallback';
  fallbackReason?: string;
}

/** Returns only words due for review now (next_review_at null or <= now). Used for spaced repetition. */
function buildFlashcardQueue(wordList: StudyWord[], reviewByWordId: Map<string, string>): StudyWord[] {
  const now = new Date().toISOString();
  const due: StudyWord[] = [];
  for (const word of wordList) {
    const nextReview = reviewByWordId.get(word.id) ?? null;
    if (!nextReview || nextReview <= now) {
      due.push(word);
    }
  }
  return due;
}

function computeFlashcardStats(
  wordIds: string[],
  reviewByWordId: Map<string, string>,
  lastRatingByWordId?: Map<string, string>
): FlashcardStats {
  const now = new Date();
  const nowISO = now.toISOString();
  // Cards scheduled within 1 hour are "learning" (short interval)
  const learningThreshold = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  let unseen = 0;
  let learning = 0;
  let learned = 0;
  for (const id of wordIds) {
    const nextReview = reviewByWordId.get(id) ?? null;
    const lastRating = lastRatingByWordId?.get(id) ?? null;
    if (!nextReview) {
      unseen++;
    } else if (lastRating === 'hard') {
      // "Hard" words stay in learning until they pass to good/easy
      learning++;
    } else if (nextReview <= nowISO) {
      learning++;
    } else if (nextReview <= learningThreshold) {
      learning++;
    } else {
      learned++;
    }
  }
  return { unseen, learning, learned };
}

export async function fetchFlashcardQueue(userId: string, listId: string): Promise<StudyWord[]> {
  const { data: words, error } = await supabase
    .from('study_words')
    .select('*')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const wordList = (words ?? []) as StudyWord[];
  if (wordList.length === 0) return [];

  const wordIds = wordList.map((w) => w.id);
  const { data: reviews } = await supabase
    .from('study_word_reviews')
    .select('study_word_id, next_review_at')
    .in('study_word_id', wordIds);

  const reviewByWordId = new Map<string, string>();
  for (const r of reviews ?? []) {
    reviewByWordId.set(r.study_word_id, r.next_review_at);
  }
  return buildFlashcardQueue(wordList, reviewByWordId);
}

export async function fetchFlashcardStats(
  userId: string,
  listId: string | null
): Promise<FlashcardStats> {
  const query = supabase
    .from('study_words')
    .select('id')
    .eq('user_id', userId);
  if (listId) {
    query.eq('list_id', listId);
  }
  const { data: words, error } = await query;
  if (error) throw error;
  const wordList = words ?? [];
  if (wordList.length === 0) return { unseen: 0, learning: 0, learned: 0 };

  const wordIds = wordList.map((w) => w.id);
  const { data: reviews } = await supabase
    .from('study_word_reviews')
    .select('study_word_id, next_review_at, last_rating')
    .in('study_word_id', wordIds);

  const reviewByWordId = new Map<string, string>();
  const lastRatingByWordId = new Map<string, string>();
  for (const r of reviews ?? []) {
    reviewByWordId.set(r.study_word_id, r.next_review_at);
    if (r.last_rating) lastRatingByWordId.set(r.study_word_id, r.last_rating);
  }
  return computeFlashcardStats(wordIds, reviewByWordId, lastRatingByWordId);
}

export async function fetchFlashcardQueueAll(userId: string): Promise<StudyWord[]> {
  const { data: words, error } = await supabase
    .from('study_words')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const wordList = (words ?? []) as StudyWord[];
  if (wordList.length === 0) return [];

  const wordIds = wordList.map((w) => w.id);
  const { data: reviews } = await supabase
    .from('study_word_reviews')
    .select('study_word_id, next_review_at')
    .in('study_word_id', wordIds);

  const reviewByWordId = new Map<string, string>();
  for (const r of reviews ?? []) {
    reviewByWordId.set(r.study_word_id, r.next_review_at);
  }
  return buildFlashcardQueue(wordList, reviewByWordId);
}

export async function fetchStudyWordReviews(wordIds: string[]): Promise<StudyWordReview[]> {
  const ids = Array.from(new Set(wordIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('study_word_reviews')
    .select('*')
    .in('study_word_id', ids);

  if (error) throw error;
  return (data ?? []) as StudyWordReview[];
}

export async function upsertStudyWordReview(
  studyWordId: string,
  rating: FlashcardRating,
  settings: FlashcardIntervalSettings
): Promise<void> {
  const now = new Date().toISOString();
  let intervalMinutes: number;
  let nextReviewAt: string;

  const { data: existing } = await supabase
    .from('study_word_reviews')
    .select('review_count, interval_minutes')
    .eq('study_word_id', studyWordId)
    .maybeSingle();

  const prevInterval = (existing as { interval_minutes?: number } | null)?.interval_minutes ?? 0;
  const reviewCount = ((existing as { review_count?: number })?.review_count ?? 0) + 1;

  if (rating === 'again') {
    intervalMinutes = 0;
    nextReviewAt = now;
  } else if (rating === 'hard') {
    intervalMinutes = settings.intervalHardMin;
    nextReviewAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  } else if (rating === 'good') {
    if (prevInterval >= settings.intervalGoodMin) {
      intervalMinutes = Math.round(prevInterval * settings.multiplier);
    } else {
      intervalMinutes = settings.intervalGoodMin;
    }
    nextReviewAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  } else {
    if (prevInterval >= settings.intervalEasyMin) {
      intervalMinutes = Math.round(prevInterval * settings.multiplier);
    } else {
      intervalMinutes = settings.intervalEasyMin;
    }
    nextReviewAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  }

  const { error } = await supabase.from('study_word_reviews').upsert(
    {
      study_word_id: studyWordId,
      next_review_at: nextReviewAt,
      interval_minutes: intervalMinutes,
      last_rating: rating,
      review_count: reviewCount,
      updated_at: now,
    },
    { onConflict: 'study_word_id' }
  );
  if (error) throw error;
}

export async function fetchStudyWords(userId: string, listId?: string | null): Promise<StudyWord[]> {
  if (isDemoMode()) {
    return demoFetchStudyWords(userId, listId);
  }

  let query = supabase
    .from('study_words')
    .select('*')
    .eq('user_id', userId);

  if (typeof listId === 'string') {
    query = query.eq('list_id', listId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as StudyWord[];
}

export async function setStudyWordStarred(studyWordId: string, starred: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('study_words')
    .update({ starred })
    .eq('id', studyWordId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Failed to update starred status — no rows matched (check RLS policy)');
  }
}

export async function countStudyWordsForList(userId: string, listId: string): Promise<number> {
  const { count, error } = await supabase
    .from('study_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('list_id', listId);

  if (error) throw error;
  return count ?? 0;
}

/** Deletes all study_word_reviews for words in the given list (reset progress). */
export async function deleteStudyWordReviewsForList(userId: string, listId: string): Promise<void> {
  const { data: words } = await supabase
    .from('study_words')
    .select('id')
    .eq('user_id', userId)
    .eq('list_id', listId);
  const ids = (words ?? []).map((w) => w.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from('study_word_reviews').delete().in('study_word_id', ids);
  if (error) throw error;
}

/** Deletes all study_word_reviews for the user (reset progress on "Study all"). */
export async function deleteAllStudyWordReviews(userId: string): Promise<void> {
  const { data: words } = await supabase.from('study_words').select('id').eq('user_id', userId);
  const ids = (words ?? []).map((w) => w.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from('study_word_reviews').delete().in('study_word_id', ids);
  if (error) throw error;
}

export async function countAllStudyWords(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('study_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
}

export async function countAllUserHighlights(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_books')
    .select('highlights')
    .eq('user_id', userId);

  if (error) throw error;
  const rows = (data ?? []) as Array<{ highlights: unknown }>;
  let total = 0;
  rows.forEach((r) => {
    if (Array.isArray(r.highlights)) total += r.highlights.length;
  });
  return total;
}

// Upgrade prompt state (anti-spam)
export async function fetchUserPromptState(userId: string): Promise<UserPromptState | null> {
  const { data, error } = await supabase
    .from('user_prompt_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertUserPromptState(
  state: Pick<UserPromptState, 'user_id'> &
    Partial<Pick<UserPromptState, 'last_upgrade_prompt_at' | 'upgrade_prompt_dismiss_count' | 'upgrade_prompt_last_reason'>>
): Promise<UserPromptState> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('user_prompt_state')
    .upsert(
      {
        ...state,
        updated_at: now,
        created_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Max words per study list (enforced in UI and recommended for performance). */
export const MAX_STUDY_LIST_WORDS = 512;

export async function createStudyWord(word: Omit<StudyWord, 'id' | 'created_at'>): Promise<StudyWord> {
  if (isDemoMode()) {
    return demoCreateStudyWord(word);
  }

  const { data, error } = await supabase
    .from('study_words')
    .upsert(word, {
      onConflict: 'user_id,book_id,source_lang,target_lang,term_normalized,list_id',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function findStudyWordsByTerm(userId: string, bookId: string, term: string): Promise<StudyWord[]> {
  const normalized = term.toLowerCase().trim();
  if (!normalized) return [];
  if (isDemoMode()) {
    const rows = await demoFetchStudyWords(userId, undefined, bookId);
    return rows.filter((row) => row.term_normalized === normalized);
  }
  const { data, error } = await supabase
    .from('study_words')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('term_normalized', normalized);
  if (error) throw error;
  return (data ?? []) as StudyWord[];
}

export async function deleteStudyWord(id: string): Promise<void> {
  const { error } = await supabase
    .from('study_words')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function moveStudyWordToList(wordId: string, listId: string | null): Promise<StudyWord> {
  const { data, error } = await supabase
    .from('study_words')
    .update({ list_id: listId })
    .eq('id', wordId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Vocab Lists
export async function fetchVocabLists(userId: string): Promise<VocabList[]> {
  if (isDemoMode()) {
    return demoFetchVocabLists(userId);
  }

  const { data, error } = await supabase
    .from('vocab_lists')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchMostRecentVocabList(userId: string): Promise<VocabList | null> {
  const { data, error } = await supabase
    .from('vocab_lists')
    .select('*')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

interface CreateVocabListOptions {
  maxLists?: number;
}

export async function createVocabList(
  userId: string,
  name: string,
  options?: CreateVocabListOptions
): Promise<VocabList> {
  const maxLists = options?.maxLists ?? 5;

  // Enforce max list count (app-level)
  const { count, error: countError } = await supabase
    .from('vocab_lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count ?? 0) >= maxLists) {
    throw new Error(`List limit reached (max ${maxLists})`);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('vocab_lists')
    .insert({
      user_id: userId,
      name,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function renameVocabList(listId: string, name: string): Promise<VocabList> {
  const { data, error } = await supabase
    .from('vocab_lists')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVocabList(listId: string): Promise<void> {
  const { error } = await supabase.from('vocab_lists').delete().eq('id', listId);
  if (error) throw error;
}

export async function touchVocabList(listId: string): Promise<void> {
  const { error } = await supabase
    .from('vocab_lists')
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId);

  if (error) throw error;
}

// User Settings
export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  if (data) return data;

  // First-time user (including anonymous guest) — create a default row so downstream
  // code (admin checks, profile language prefs) doesn't spam warnings.
  try {
    return await upsertUserSettings({ user_id: userId });
  } catch (e) {
    // If insert is blocked/misconfigured, just fall back to null.
    return null;
  }
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  logger.info('Checking admin status for userId:', userId);
  
  const { data, error } = await supabase
    .from('user_settings')
    .select('admin')
    .eq('user_id', userId)
    .single();
  
  logger.info('Admin check query result:', { data, error });
  
  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to check admin status:', error);
    return false;
  }
  
  if (!data) {
    return false;
  }
  
  const isAdmin = data?.admin === true;
  logger.info('Admin status result:', isAdmin);
  
  return isAdmin;
}

export interface PremiumStatus {
  is_premium: boolean;
  premium_plan: 'monthly' | 'yearly' | 'lifetime' | null;
}

export async function syncUserPremiumEntitlement(): Promise<PremiumStatus> {
  const { data, error } = await supabase.functions.invoke('premium-entitlement-sync', {
    body: {},
  });

  if (error) {
    throw new Error(`Premium entitlement sync failed: ${error.message || 'Unknown error'}`);
  }

  if (!data || typeof data.is_premium !== 'boolean') {
    throw new Error('Premium entitlement sync failed: No data returned');
  }

  return {
    is_premium: data.is_premium,
    premium_plan: data.premium_plan ?? null,
  };
}

export async function fetchUserPremiumStatus(userId: string): Promise<PremiumStatus> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('is_premium,premium_plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) {
    const created = await upsertUserSettings({ user_id: userId });
    return {
      is_premium: created.is_premium === true,
      premium_plan: (created.premium_plan ?? null) as PremiumStatus['premium_plan'],
    };
  }

  return {
    is_premium: data.is_premium === true,
    premium_plan: (data.premium_plan ?? null) as PremiumStatus['premium_plan'],
  };
}

export async function upsertUserPremiumStatus(
  userId: string,
  _status: PremiumStatus
): Promise<PremiumStatus> {
  void userId;
  throw new Error('Direct client premium writes are disabled. Resolve entitlements from a trusted backend boundary instead.');
}

export async function upsertUserSettings(settings: ClientUserSettingsUpsert): Promise<UserSettings> {
  const sanitized = sanitizeMutableUserSettingsInput(settings);
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      ...sanitized,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function recordReadingSession(
  session: Omit<ReadingSession, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase
    .from('reading_sessions')
    .insert(session);
  if (error) throw error;
}

export async function recordVocabReviewed(userId: string, vocabId: string): Promise<void> {
  const { error } = await supabase
    .from('vocab_reviews')
    .insert({
      user_id: userId,
      vocab_id: vocabId,
      reviewed_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export type ProgressRange = 'day' | 'week' | 'month' | 'year';

export interface ProgressStats {
  minutesRead: number;
  streakDays: number;
  wordsSaved: number;
  wordsReviewed: number;
  wordsLearned: number;
}

export interface ProgressTrendWindowStats {
  minutesRead: number;
  wordsSaved: number;
  wordsReviewed: number;
}

export interface ProgressTrendSnapshot {
  windowDays: number;
  current: ProgressTrendWindowStats;
  previous: ProgressTrendWindowStats;
}

export interface ProgressTimelinePoint {
  day: string;
  minutesRead: number;
  wordsSaved: number;
  wordsReviewed: number;
}

export interface ProgressTimeline {
  windowDays: number;
  points: ProgressTimelinePoint[];
}

function daysForRange(range: ProgressRange): number {
  if (range === 'day') return 1;
  if (range === 'week') return 7;
  if (range === 'month') return 30;
  return 365;
}

export function chartDaysForRange(range: ProgressRange): number {
  if (range === 'day') return 7;
  if (range === 'week') return 7;
  if (range === 'month') return 30;
  return 365;
}

function toDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function todayDateKey(timeZone: string): string {
  return toDateKey(new Date().toISOString(), timeZone);
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveSessionDate(endedAt: string | null | undefined, startedAt: string | null | undefined): string | null {
  if (typeof endedAt === 'string' && endedAt.length > 0) return endedAt;
  if (typeof startedAt === 'string' && startedAt.length > 0) return startedAt;
  return null;
}

interface TimeWindow {
  since: string;
  until: string;
}

function buildWindow(daysFromNowStart: number, daysFromNowEnd: number): TimeWindow {
  const since = new Date(Date.now() - daysFromNowStart * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(Date.now() - daysFromNowEnd * 24 * 60 * 60 * 1000).toISOString();
  return { since, until };
}

async function fetchProgressWindowStats(userId: string, window: TimeWindow): Promise<ProgressTrendWindowStats> {
  const readingQuery = supabase
    .from('reading_sessions')
    .select('minutes')
    .eq('user_id', userId)
    .gte('ended_at', window.since)
    .lt('ended_at', window.until);
  const wordsSavedQuery = supabase
    .from('study_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', window.since)
    .lt('created_at', window.until);
  const wordsReviewedQuery = supabase
    .from('vocab_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('reviewed_at', window.since)
    .lt('reviewed_at', window.until);

  const [
    { data: readingRows, error: readingError },
    { count: wordsSaved, error: wordsSavedError },
    { count: wordsReviewed, error: wordsReviewedError },
  ] = await Promise.all([readingQuery, wordsSavedQuery, wordsReviewedQuery]);

  if (readingError) throw readingError;
  if (wordsSavedError) throw wordsSavedError;
  if (wordsReviewedError) throw wordsReviewedError;

  return {
    minutesRead: (readingRows ?? []).reduce((sum, row) => sum + Math.max(0, row.minutes ?? 0), 0),
    wordsSaved: wordsSaved ?? 0,
    wordsReviewed: wordsReviewed ?? 0,
  };
}

function computeStreakDays(
  readingSessions: Array<{ started_at: string | null; ended_at: string | null; minutes: number }>,
  timeZone: string
): number {
  const byDate = new Map<string, number>();
  for (const item of readingSessions) {
    const sessionDate = resolveSessionDate(item.ended_at, item.started_at);
    if (!sessionDate) continue;
    const key = toDateKey(sessionDate, timeZone);
    byDate.set(key, (byDate.get(key) ?? 0) + Math.max(0, item.minutes));
  }

  let streak = 0;
  let cursor = todayDateKey(timeZone);
  while ((byDate.get(cursor) ?? 0) >= 1) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function fetchProgressStats(
  userId: string,
  range: ProgressRange,
  timeZone: string
): Promise<ProgressStats> {
  const days = daysForRange(range);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let readingRows: Array<{ minutes: number; started_at: string | null; ended_at: string | null }> = [];
  let wordsSaved = 0;
  let wordsReviewed = 0;

  if (range === 'day') {
    // Local "day" range should follow calendar day boundaries in the user's timezone.
    const today = todayDateKey(timeZone);
    const daySince = new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: readingData, error: readingError },
      { data: wordsSavedRows, error: wordsSavedError },
      { data: wordsReviewedRows, error: wordsReviewedError },
    ] = await Promise.all([
      supabase
        .from('reading_sessions')
        .select('minutes,started_at,ended_at')
        .eq('user_id', userId)
        .gte('ended_at', daySince)
        .order('ended_at', { ascending: false }),
      supabase
        .from('study_words')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', daySince),
      supabase
        .from('vocab_reviews')
        .select('reviewed_at')
        .eq('user_id', userId)
        .gte('reviewed_at', daySince),
    ]);

    if (readingError) throw readingError;
    if (wordsSavedError) throw wordsSavedError;
    if (wordsReviewedError) throw wordsReviewedError;

    readingRows = (readingData ?? []) as Array<{ minutes: number; started_at: string | null; ended_at: string | null }>;
    wordsSaved = (wordsSavedRows ?? []).reduce((sum, row) => {
      if (!row.created_at) return sum;
      return toDateKey(row.created_at, timeZone) === today ? sum + 1 : sum;
    }, 0);
    wordsReviewed = (wordsReviewedRows ?? []).reduce((sum, row) => {
      if (!row.reviewed_at) return sum;
      return toDateKey(row.reviewed_at, timeZone) === today ? sum + 1 : sum;
    }, 0);
  } else {
    const [
      { data: readingData, error: readingError },
      { count: wordsSavedCount, error: wordsSavedError },
      { count: wordsReviewedCount, error: wordsReviewedError },
    ] = await Promise.all([
      supabase
        .from('reading_sessions')
        .select('minutes,started_at,ended_at')
        .eq('user_id', userId)
        .gte('ended_at', since)
        .order('ended_at', { ascending: false }),
      supabase
        .from('study_words')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since),
      supabase
        .from('vocab_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('reviewed_at', since),
    ]);

    if (readingError) throw readingError;
    if (wordsSavedError) throw wordsSavedError;
    if (wordsReviewedError) throw wordsReviewedError;

    readingRows = (readingData ?? []) as Array<{ minutes: number; started_at: string | null; ended_at: string | null }>;
    wordsSaved = wordsSavedCount ?? 0;
    wordsReviewed = wordsReviewedCount ?? 0;
  }

  const today = range === 'day' ? todayDateKey(timeZone) : null;
  const minutesRead = readingRows.reduce((sum, row) => {
    if (today) {
      const sessionDate = resolveSessionDate(row.ended_at, row.started_at);
      if (!sessionDate || toDateKey(sessionDate, timeZone) !== today) return sum;
    }
    return sum + Math.max(0, row.minutes ?? 0);
  }, 0);
  const fallbackStreakDays = computeStreakDays(
    readingRows as Array<{ started_at: string | null; ended_at: string | null; minutes: number }>,
    timeZone
  );
  let streakDays = fallbackStreakDays;
  try {
    const { data: gardenState, error: gardenError } = await supabase
      .from('user_garden_state')
      .select('streak_days')
      .eq('user_id', userId)
      .maybeSingle();

    if (gardenError && gardenError.code !== 'PGRST205' && gardenError.code !== 'PGRST116') {
      throw gardenError;
    }

    if (gardenState && typeof gardenState.streak_days === 'number') {
      streakDays = Math.max(0, Math.floor(gardenState.streak_days));
    }
  } catch (error) {
    logger.warn('Failed to load garden streak; falling back to reading session streak', error);
  }

  const flashcardStats = await fetchFlashcardStats(userId, null);

  return {
    minutesRead,
    streakDays,
    wordsSaved,
    wordsReviewed,
    wordsLearned: flashcardStats.learned ?? 0,
  };
}

export async function fetchProgressTrendSnapshot(userId: string, range: ProgressRange): Promise<ProgressTrendSnapshot> {
  const windowDays = daysForRange(range);
  const currentWindow = buildWindow(windowDays, 0);
  const previousWindow = buildWindow(windowDays * 2, windowDays);
  const [current, previous] = await Promise.all([
    fetchProgressWindowStats(userId, currentWindow),
    fetchProgressWindowStats(userId, previousWindow),
  ]);

  return {
    windowDays,
    current,
    previous,
  };
}

export async function fetchProgressTimeline(
  userId: string,
  range: ProgressRange,
  timeZone: string
): Promise<ProgressTimeline> {
  const windowDays = chartDaysForRange(range);
  const today = todayDateKey(timeZone);
  const startDay = addDays(today, -(windowDays - 1));
  // Query one extra UTC day to avoid clipping early-day local activity in positive UTC offsets.
  const startISO = `${addDays(startDay, -1)}T00:00:00.000Z`;
  const endISO = new Date().toISOString();

  const readingQuery = supabase
    .from('reading_sessions')
    .select('minutes,started_at,ended_at')
    .eq('user_id', userId)
    .gte('ended_at', startISO)
    .lte('ended_at', endISO);
  const wordsSavedQuery = supabase
    .from('study_words')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', startISO)
    .lte('created_at', endISO);
  const wordsReviewedQuery = supabase
    .from('vocab_reviews')
    .select('reviewed_at')
    .eq('user_id', userId)
    .gte('reviewed_at', startISO)
    .lte('reviewed_at', endISO);

  const [
    { data: readingRows, error: readingError },
    { data: wordsSavedRows, error: wordsSavedError },
    { data: wordsReviewedRows, error: wordsReviewedError },
  ] = await Promise.all([readingQuery, wordsSavedQuery, wordsReviewedQuery]);

  if (readingError) throw readingError;
  if (wordsSavedError) throw wordsSavedError;
  if (wordsReviewedError) throw wordsReviewedError;

  const pointsByDay = new Map<string, ProgressTimelinePoint>();
  for (let i = 0; i < windowDays; i += 1) {
    const day = addDays(startDay, i);
    pointsByDay.set(day, {
      day,
      minutesRead: 0,
      wordsSaved: 0,
      wordsReviewed: 0,
    });
  }

  for (const row of readingRows ?? []) {
    const sessionDate = resolveSessionDate(row.ended_at, row.started_at);
    if (!sessionDate) continue;
    const day = toDateKey(sessionDate, timeZone);
    const point = pointsByDay.get(day);
    if (!point) continue;
    point.minutesRead += Math.max(0, row.minutes ?? 0);
  }

  for (const row of wordsSavedRows ?? []) {
    if (!row.created_at) continue;
    const day = toDateKey(row.created_at, timeZone);
    const point = pointsByDay.get(day);
    if (!point) continue;
    point.wordsSaved += 1;
  }

  for (const row of wordsReviewedRows ?? []) {
    if (!row.reviewed_at) continue;
    const day = toDateKey(row.reviewed_at, timeZone);
    const point = pointsByDay.get(day);
    if (!point) continue;
    point.wordsReviewed += 1;
  }

  return {
    windowDays,
    points: Array.from(pointsByDay.values()),
  };
}

export async function fetchTodayReadingMinutes(userId: string, timeZone: string): Promise<number> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('minutes,started_at,ended_at')
    .eq('user_id', userId)
    .gte('ended_at', since)
    .order('ended_at', { ascending: false });

  if (error) throw error;

  const today = todayDateKey(timeZone);
  return (data ?? []).reduce((sum, row) => {
    const sessionDate = resolveSessionDate(row.ended_at, row.started_at);
    if (!sessionDate || toDateKey(sessionDate, timeZone) !== today) return sum;
    return sum + Math.max(0, row.minutes ?? 0);
  }, 0);
}

export interface GardenSnapshot {
  state: UserGardenState;
  daily: UserGardenDailyProgress;
  goalMinutes: number;
  savedGoal: number;
  learnedGoal: number;
  primaryGoal: PrimaryGoal;
  goalPriority: PrimaryGoal[];
  recentGoalCompletion: {
    daysMet: number;
    daysConsidered: number;
    completionRate: number;
  };
}

async function fetchOrCreateGardenState(userId: string): Promise<UserGardenState> {
  const { data, error } = await supabase
    .from('user_garden_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (data) return data as UserGardenState;

  const { data: created, error: createError } = await supabase
    .from('user_garden_state')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as UserGardenState;
}

async function fetchGardenDailyProgress(userId: string, day: string): Promise<UserGardenDailyProgress | null> {
  const { data, error } = await supabase
    .from('user_garden_daily_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as UserGardenDailyProgress | null) ?? null;
}

async function fetchRecentGardenGoalCompletion(
  userId: string,
  day: string,
  lookbackDays: number
): Promise<{ daysMet: number; daysConsidered: number; completionRate: number }> {
  const safeDays = Math.max(1, Math.floor(lookbackDays));
  const startDay = addDays(day, -(safeDays - 1));
  const { data, error } = await supabase
    .from('user_garden_daily_progress')
    .select('goal_completed')
    .eq('user_id', userId)
    .gte('day', startDay)
    .lte('day', day);

  if (error) throw error;
  const daysMet = (data ?? []).reduce((sum, row) => (row.goal_completed ? sum + 1 : sum), 0);
  return {
    daysMet,
    daysConsidered: safeDays,
    completionRate: safeDays > 0 ? daysMet / safeDays : 0,
  };
}

export async function fetchGardenSnapshot(userId: string, day: string = localDateKey()): Promise<GardenSnapshot> {
  const [settings, state, daily, recentGoalCompletion] = await Promise.all([
    fetchUserSettings(userId),
    fetchOrCreateGardenState(userId),
    fetchGardenDailyProgress(userId, day),
    fetchRecentGardenGoalCompletion(userId, day, 7),
  ]);

  const goalRaw = settings?.daily_reading_goal_minutes;
  const goalMinutes =
    typeof goalRaw === 'number' && Number.isFinite(goalRaw) && goalRaw >= 5 && goalRaw <= 60
      ? Math.round(goalRaw / 5) * 5
      : 10;
  const savedGoalRaw = settings?.daily_words_saved_goal;
  const savedGoal =
    typeof savedGoalRaw === 'number' && Number.isFinite(savedGoalRaw) && savedGoalRaw >= 5 && savedGoalRaw <= 50
      ? Math.round(savedGoalRaw / 5) * 5
      : 10;
  const learnedGoalRaw = settings?.daily_words_learned_goal;
  const learnedGoal =
    typeof learnedGoalRaw === 'number' && Number.isFinite(learnedGoalRaw) && learnedGoalRaw >= 1 && learnedGoalRaw <= 15
      ? Math.round(learnedGoalRaw)
      : 5;
  const primaryGoal: PrimaryGoal = normalizePrimaryGoal(settings?.primary_goal);
  const goalPriority = Array.isArray(settings?.goal_priority)
    ? normalizeSubGoals(settings.goal_priority, primaryGoal)
    : defaultSubGoals(primaryGoal);

  const freshness = resolveGardenFreshness(state.last_activity_on, day);

  let nextTotalGp = state.total_gp;
  let nextStreakDays = state.streak_days;

  // One-time penalty when transitioning to dead: regress stage and reset streak
  const isDeathTransition = freshness === 'dead' && state.freshness !== 'dead';
  if (isDeathTransition) {
    const previousGp = state.total_gp;
    const previousStage = resolveGardenStage(previousGp);
    nextTotalGp = regressGardenGp(previousGp);
    nextStreakDays = 0;
    track('garden_died', {
      previous_stage: previousStage,
      new_stage: resolveGardenStage(nextTotalGp),
      previous_gp: previousGp,
      new_gp: nextTotalGp,
    });
  }

  const resolvedStage = resolveGardenStage(nextTotalGp);

  const needsUpsert =
    freshness !== state.freshness ||
    resolvedStage !== state.stage ||
    nextTotalGp !== state.total_gp ||
    nextStreakDays !== state.streak_days;

  const hydratedState = needsUpsert
    ? await upsertGardenState({
        ...state,
        total_gp: nextTotalGp,
        stage: resolvedStage,
        freshness,
        streak_days: nextStreakDays,
        updated_at: new Date().toISOString(),
      })
    : state;

  return {
    state: hydratedState,
    daily: daily ?? emptyDailyProgress(userId, day),
    goalMinutes,
    savedGoal,
    learnedGoal,
    primaryGoal,
    goalPriority,
    recentGoalCompletion,
  };
}

async function upsertGardenDailyProgress(progress: UserGardenDailyProgress): Promise<UserGardenDailyProgress> {
  const { data, error } = await supabase
    .from('user_garden_daily_progress')
    .upsert({
      ...progress,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as UserGardenDailyProgress;
}

async function upsertGardenState(state: UserGardenState): Promise<UserGardenState> {
  const { data, error } = await supabase
    .from('user_garden_state')
    .upsert({
      ...state,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as UserGardenState;
}

export interface GardenProgressResult {
  state: UserGardenState;
  daily: UserGardenDailyProgress;
  deltaGp: number;
  goalCompletedNow: boolean;
}

export async function applyGardenProgress(
  userId: string,
  input: GardenProgressInput,
  day: string = localDateKey()
): Promise<GardenProgressResult> {
  if (!userId) {
    throw new Error('missing_user_id');
  }

  const snapshot = await fetchGardenSnapshot(userId, day);
  const previousState = snapshot.state;
  const previousStage = previousState.stage;
  const previousStreak = previousState.streak_days;

  const computed = computeGardenProgressUpdate({
    daily: snapshot.daily,
    input,
    goalMinutes: snapshot.goalMinutes,
    savedGoal: snapshot.savedGoal,
    learnedGoal: snapshot.learnedGoal,
    primaryGoal: snapshot.primaryGoal,
    day,
    state: {
      streak_days: previousState.streak_days,
      last_goal_completed_on: previousState.last_goal_completed_on,
    },
  });

  const dailyChanged =
    computed.nextDaily.reading_minutes !== snapshot.daily.reading_minutes ||
    computed.nextDaily.saved_count !== snapshot.daily.saved_count ||
    computed.nextDaily.learned_count !== snapshot.daily.learned_count ||
    computed.nextDaily.gp_awarded !== snapshot.daily.gp_awarded ||
    computed.nextDaily.goal_completed !== snapshot.daily.goal_completed ||
    computed.nextDaily.streak_bonus_awarded !== snapshot.daily.streak_bonus_awarded;

  const nextTotalGp = previousState.total_gp + computed.deltaGp;
  const nextStage = resolveGardenStage(nextTotalGp);

  const anyGoalMet =
    computed.nextDaily.reading_minutes >= snapshot.goalMinutes ||
    computed.nextDaily.saved_count >= snapshot.savedGoal ||
    computed.nextDaily.learned_count >= snapshot.learnedGoal;

  const isStale = previousState.freshness !== 'fresh';
  const reviving = isStale && anyGoalMet;
  const staysStale = isStale && !anyGoalMet;

  const nextFreshness = staysStale ? previousState.freshness : 'fresh';
  const nextLastActivityOn = staysStale ? previousState.last_activity_on : day;

  if (reviving && previousState.freshness === 'dead') {
    track('garden_revived', {
      stage: nextStage,
      total_gp: nextTotalGp,
    });
  }

  const nextState: UserGardenState = {
    ...previousState,
    total_gp: nextTotalGp,
    stage: nextStage,
    freshness: nextFreshness,
    streak_days: computed.nextStreakDays,
    last_activity_on: nextLastActivityOn,
    last_goal_completed_on: computed.goalCompletedNow ? day : previousState.last_goal_completed_on,
    updated_at: new Date().toISOString(),
  };

  if (!dailyChanged && nextState.last_activity_on === previousState.last_activity_on) {
    return {
      state: previousState,
      daily: snapshot.daily,
      deltaGp: 0,
      goalCompletedNow: false,
    };
  }

  const [savedDaily, savedState] = await Promise.all([
    upsertGardenDailyProgress(computed.nextDaily),
    upsertGardenState(nextState),
  ]);

  if (computed.deltaGp > 0) {
    const targetValue =
      snapshot.primaryGoal === 'words_saved'
        ? snapshot.savedGoal
        : snapshot.primaryGoal === 'words_learned'
          ? snapshot.learnedGoal
          : snapshot.goalMinutes;
    track('garden_progressed', {
      delta_gp: computed.deltaGp,
      source: input.source ?? 'manual',
      minutes_done_today: savedDaily.reading_minutes,
      goal_minutes: targetValue,
    });
  }

  if (computed.goalCompletedNow) {
    const goalType =
      snapshot.primaryGoal === 'words_saved'
        ? 'saved'
        : snapshot.primaryGoal === 'words_learned'
          ? 'learned'
          : 'reading';
    const targetValue =
      snapshot.primaryGoal === 'words_saved'
        ? snapshot.savedGoal
        : snapshot.primaryGoal === 'words_learned'
          ? snapshot.learnedGoal
          : snapshot.goalMinutes;
    track('garden_watered', {
      goal_type: goalType,
      goal_value: targetValue,
      streak_days: savedState.streak_days,
    });
  }

  if (savedState.stage !== previousStage) {
    track('garden_stage_upgraded', {
      from_stage: previousStage,
      to_stage: savedState.stage,
      total_gp: savedState.total_gp,
    });
  }

  if (savedState.streak_days !== previousStreak) {
    track('garden_streak_changed', {
      old_streak: previousStreak,
      new_streak: savedState.streak_days,
      reason: computed.goalCompletedNow ? 'goal_completed' : 'manual',
    });
  }

  return {
    state: savedState,
    daily: savedDaily,
    deltaGp: computed.deltaGp,
    goalCompletedNow: computed.goalCompletedNow,
  };
}

export async function deleteUserAccount(_userId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_user_account');
  if (error) throw error;
}

export async function isUserSoftDeleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('deleted_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return Boolean(data?.deleted_at);
}

export async function reactivateUserAccount(): Promise<void> {
  const { error } = await supabase.rpc('reactivate_user_account');
  if (error) throw error;
}

// Translation
export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  if (isDemoMode()) {
    return demoTranslateText(request);
  }

  const { data, error } = await supabase.functions.invoke('translate', {
    body: request,
  });
  
  if (error) {
    logger.error('Edge Function error:', error);
    track('api_error', {
      endpoint: 'translate',
      code: String(error.message ?? 'invoke_failed'),
      source: 'supabase_queries',
    });
    throw new Error(`Translation failed: ${error.message || 'Unknown error'}`);
  }
  
  if (!data) {
    track('api_error', {
      endpoint: 'translate',
      code: 'no_data_returned',
      source: 'supabase_queries',
    });
    throw new Error('Translation failed: No data returned');
  }
  
  return data;
}

export async function generateStudyPackMetadata(
  request: StudyPackMetadataRequest
): Promise<StudyPackMetadataResponse> {
  const { data, error } = await supabase.functions.invoke('study-pack-metadata', {
    body: request,
  });

  if (error) {
    throw new Error(`Study pack metadata failed: ${error.message || 'Unknown error'}`);
  }

  if (!data?.title || !data?.coachLine) {
    throw new Error('Study pack metadata failed: No data returned');
  }

  return data as StudyPackMetadataResponse;
}

// User Books (per-user per-book metadata)
export async function fetchUserBook(userId: string, bookId: string): Promise<UserBook | null> {
  if (isDemoMode()) {
    return demoFetchUserBook(bookId);
  }

  const { data, error } = await supabase
    .from('user_books')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertUserBook(
  progress: Pick<UserBook, 'user_id' | 'book_id'> &
    Partial<Pick<UserBook, 'last_cfi' | 'highlights' | 'status'>>
): Promise<UserBook> {
  if (isDemoMode()) {
    return demoUpsertUserBook({
      book_id: progress.book_id,
      last_cfi: progress.last_cfi,
      highlights: progress.highlights,
      status: progress.status,
    });
  }

  const payload: Record<string, unknown> = {
    ...progress,
    updated_at: new Date().toISOString(),
  };
  if (progress.status != null) payload.status = progress.status;
  if (progress.status !== 'saved_for_later') {
    payload.last_read_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('user_books')
    .upsert(payload, { onConflict: 'user_id,book_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Save a book for later (add to history as saved_for_later). */
export async function saveBookForLater(userId: string, bookId: string): Promise<UserBook> {
  return upsertUserBook({ user_id: userId, book_id: bookId, status: 'saved_for_later' });
}

/** Mark a book as reading and update last_read_at (e.g. when starting from "Saved for later"). */
export async function setUserBookReading(userId: string, bookId: string): Promise<UserBook> {
  const { data, error } = await supabase
    .from('user_books')
    .update({
      status: 'reading',
      last_read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Fetch book_id and last_read_at for all user_books (for auto-remove downloads). */
export async function fetchUserBooksLastRead(
  userId: string
): Promise<Array<{ book_id: string; last_read_at: string | null }>> {
  if (isDemoMode()) {
    return demoFetchUserBooksLastRead();
  }

  const { data, error } = await supabase
    .from('user_books')
    .select('book_id, last_read_at')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function addUserBookHighlight(userId: string, bookId: string, highlight: UserBookHighlight): Promise<UserBook> {
  const existing = await fetchUserBook(userId, bookId);
  const prev = existing?.highlights ?? [];
  const next = [...prev, highlight];
  return await upsertUserBook({ user_id: userId, book_id: bookId, highlights: next });
}

export async function deleteUserBookHighlight(userId: string, bookId: string, highlightId: string): Promise<UserBook> {
  const existing = await fetchUserBook(userId, bookId);
  const prev = existing?.highlights ?? [];
  const next = prev.filter((h) => h.id !== highlightId);
  return await upsertUserBook({ user_id: userId, book_id: bookId, highlights: next });
}

export async function updateUserBookHighlightColor(userId: string, bookId: string, highlightId: string, color: string): Promise<UserBook> {
  const existing = await fetchUserBook(userId, bookId);
  const prev = existing?.highlights ?? [];
  const next = prev.map((h) => (h.id === highlightId ? { ...h, color } : h));
  return await upsertUserBook({ user_id: userId, book_id: bookId, highlights: next });
}

export async function updateUserBookHighlightTranslation(userId: string, bookId: string, highlightId: string, translation: string): Promise<UserBook> {
  const existing = await fetchUserBook(userId, bookId);
  const prev = existing?.highlights ?? [];
  const next = prev.map((h) => (h.id === highlightId ? { ...h, translation } : h));
  return await upsertUserBook({ user_id: userId, book_id: bookId, highlights: next });
}

export async function hasReadingHistory(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('user_books')
    .select('book_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'saved_for_later');

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function fetchHistoryBooks(userId: string, filters?: BookFilters): Promise<BookWithStatus[]> {
  if (isDemoMode()) {
    return demoFetchHistoryBooks(filters);
  }

  let query = supabase
    .from('books')
    .select('*, user_books!inner(user_id,last_read_at,status)')
    .eq('user_books.user_id', userId);

  const search = filters?.search?.trim();
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  const author = filters?.author?.trim();
  if (author) {
    query = query.ilike('author', `%${author}%`);
  }

  const languages = filters?.languages?.length
    ? filters.languages.map((l) => String(l).trim()).filter(Boolean)
    : null;
  if (languages && languages.length > 0) {
    query = query.in('source_lang', languages);
  } else {
    const language = filters?.language?.trim();
    if (language) {
      query = query.eq('source_lang', language);
    }
  }

  const subjects = filters?.subjects;
  if (subjects && Array.isArray(subjects) && subjects.length > 0) {
    const trimmed = subjects.map((s) => String(s).trim()).filter(Boolean);
    if (trimmed.length > 0) {
      query = query.overlaps('subjects', trimmed);
    }
  }

  const source = filters?.source?.trim();
  if (source) {
    query = query.eq('source', source);
  }

  // Stable order by last read, with tie-breaker
  query = query.order('last_read_at', { foreignTable: 'user_books', ascending: false }).order('id', { ascending: false });

  if (typeof filters?.limit === 'number' && filters.limit > 0) {
    const offset = typeof filters.offset === 'number' && filters.offset >= 0 ? filters.offset : 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  type Row = Book & { user_books: Array<{ last_read_at: string | null; status: UserBookStatus }> };
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  // Sort by last_read_at descending client-side as a safety net
  rows.sort((a, b) => {
    const aTime = a.user_books?.[0]?.last_read_at ?? '';
    const bTime = b.user_books?.[0]?.last_read_at ?? '';
    return bTime.localeCompare(aTime);
  });
  return rows.map((r) => {
    const { user_books: ub } = r;
    const { user_books: _ub, ...book } = r;
    const status = ub?.[0]?.status ?? 'reading';
    return { ...book, status };
  });
}
