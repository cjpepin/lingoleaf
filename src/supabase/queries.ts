/**
 * Centralized Supabase queries
 * All database operations go through here
 */

import { logger } from '@/utils/logger';
import { supabase } from './client';
import type {
  Book,
  Highlight,
  StudyWord,
  UserSettings,
  TranslationRequest,
  TranslationResponse,
  UserBook,
  VocabList,
  UserBookHighlight,
  UserPromptState,
} from './types';

// Books
export interface BookFilters {
  search?: string;
  author?: string;
  language?: string;
  subject?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export async function fetchBooks(filters?: BookFilters): Promise<Book[]> {
  let query = supabase.from('books').select('*');

  const search = filters?.search?.trim();
  if (search) {
    // Search across title + author (simple, fast MVP)
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  const author = filters?.author?.trim();
  if (author) {
    query = query.ilike('author', `%${author}%`);
  }

  const language = filters?.language?.trim();
  if (language) {
    query = query.eq('source_lang', language);
  }

  const subject = filters?.subject?.trim();
  if (subject) {
    // We store a flattened string for flexible "contains" matching (avoids array operator UX issues)
    query = query.ilike('subjects_text', `%${subject}%`);
  }

  const source = filters?.source?.trim();
  if (source) {
    query = query.eq('source', source);
  }

  // Stable ordering for pagination
  query = query
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (typeof filters?.limit === 'number' && filters.limit > 0) {
    const offset = typeof filters.offset === 'number' && filters.offset >= 0 ? filters.offset : 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchBook(id: string): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
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

// Highlights
export async function fetchHighlights(userId: string, bookId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function createHighlight(highlight: Omit<Highlight, 'id' | 'created_at'>): Promise<Highlight> {
  const { data, error } = await supabase
    .from('highlights')
    .insert(highlight)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Study Words
export async function fetchStudyWords(userId: string, listId?: string | null): Promise<StudyWord[]> {
  let query = supabase
    .from('study_words')
    .select('*')
    .eq('user_id', userId);

  if (typeof listId === 'string') {
    query = query.eq('list_id', listId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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

export async function createStudyWord(word: Omit<StudyWord, 'id' | 'created_at'>): Promise<StudyWord> {
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
  const { data, error } = await supabase
    .from('vocab_lists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

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

export async function createVocabList(userId: string, name: string): Promise<VocabList> {
  // Enforce max 5 lists (app-level)
  const { count, error: countError } = await supabase
    .from('vocab_lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count ?? 0) >= 5) {
    throw new Error('List limit reached (max 5)');
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

export async function upsertUserSettings(settings: Partial<Omit<UserSettings, 'created_at' | 'updated_at'>> & { user_id: string }): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteUserAccount(userId: string): Promise<void> {
  // Delete user account (cascades to all related data via RLS)
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// Translation
export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  const { data, error } = await supabase.functions.invoke('translate', {
    body: request,
  });
  
  if (error) {
    logger.error('Edge Function error:', error);
    throw new Error(`Translation failed: ${error.message || 'Unknown error'}`);
  }
  
  if (!data) {
    throw new Error('Translation failed: No data returned');
  }
  
  return data;
}

// User Books (per-user per-book metadata)
export async function fetchUserBook(userId: string, bookId: string): Promise<UserBook | null> {
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
  progress: Pick<UserBook, 'user_id' | 'book_id'> & Partial<Pick<UserBook, 'last_cfi' | 'highlights'>>
): Promise<UserBook> {
  const { data, error } = await supabase
    .from('user_books')
    .upsert(
      {
        ...progress,
        updated_at: new Date().toISOString(),
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
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

export async function hasReadingHistory(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('user_books')
    .select('book_id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function fetchHistoryBooks(userId: string, filters?: BookFilters): Promise<Book[]> {
  // Select books that the user has opened (exists in user_books)
  let query = supabase
    .from('books')
    .select('*, user_books!inner(user_id,last_read_at)')
    .eq('user_books.user_id', userId);

  const search = filters?.search?.trim();
  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  const author = filters?.author?.trim();
  if (author) {
    query = query.ilike('author', `%${author}%`);
  }

  const language = filters?.language?.trim();
  if (language) {
    query = query.eq('source_lang', language);
  }

  const subject = filters?.subject?.trim();
  if (subject) {
    query = query.ilike('subjects_text', `%${subject}%`);
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

  type Row = Book & { user_books: Array<{ last_read_at: string | null }> };
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  return rows.map((r) => {
    const { user_books: _ub, ...book } = r;
    return book;
  });
}

