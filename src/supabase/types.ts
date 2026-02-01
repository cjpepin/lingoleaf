/**
 * Database types
 * Matches Supabase schema
 */

export interface Book {
  id: string;
  title: string;
  author: string | null;
  storage_path: string | null;
  cover_path: string | null;
  cover_url?: string | null;
  description?: string | null;
  source_lang: string | null;
  source?: string;
  source_id?: string | null;
  epub_url?: string | null;
  popularity_score?: number | null;
  languages?: string[] | null;
  subjects?: string[] | null;
  bookshelves?: string[] | null;
  subjects_text?: string | null;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  cfi_range: string;
  selected_text: string;
  context_snippet: string | null;
  color: string | null;
  created_at: string;
}

export interface StudyWord {
  id: string;
  user_id: string;
  book_id: string;
  list_id: string | null;
  source_lang: string;
  target_lang: string;
  term: string;
  term_normalized: string;
  translation: string;
  context_snippet: string | null;
  created_at: string;
}

export interface StudyWordReview {
  study_word_id: string;
  next_review_at: string;
  interval_minutes: number;
  last_rating: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface TranslationCache {
  source_lang: string;
  target_lang: string;
  term_normalized: string;
  translation: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  target_lang: string;
  native_lang: string;
  known_langs: string[];
  goal_langs: string[];
  reader_highlight_on_translate?: boolean;
  reader_font_size?: string;
  reader_font_family?: string;
  reader_highlight_color?: string;
  flashcard_again_cards?: number;
  flashcard_interval_hard_min?: number;
  flashcard_interval_good_min?: number;
  flashcard_interval_easy_min?: number;
  flashcard_interval_multiplier?: number;
  app_lang?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPromptState {
  user_id: string;
  last_upgrade_prompt_at: string | null;
  upgrade_prompt_dismiss_count: number;
  upgrade_prompt_last_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranslationRequest {
  source_lang: string;
  target_lang: string;
  text: string;
  /**
   * Optional surrounding context to improve translation accuracy.
   * Example: "wordBefore <selection> wordAfter"
   */
  context?: string;
}

export interface TranslationResponse {
  term: string;
  term_normalized: string;
  translation: string;
  from_cache: boolean;
  detected_lang?: string;
  same_language?: boolean;
}

export interface UserBook {
  user_id: string;
  book_id: string;
  last_cfi: string | null;
  highlights: UserBookHighlight[];
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserBookHighlight {
  id: string;
  cfi_range: string;
  selected_text: string;
  created_at: string;
  color: string;
}

export interface VocabList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

