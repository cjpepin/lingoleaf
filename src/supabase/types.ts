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
  starred?: boolean;
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

/** Fluency for "languages you know": native, fluent, advanced, intermediate, beginner */
export type KnownLangLevel = 'native' | 'fluent' | 'advanced' | 'intermediate' | 'beginner';
/** CEFR level for "languages you're learning" */
export type GoalLangLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface UserSettings {
  user_id: string;
  target_lang: string;
  native_lang: string;
  known_langs: string[];
  goal_langs: string[];
  /** Map of language code -> known level (optional, for profile UI) */
  known_lang_levels?: Record<string, KnownLangLevel>;
  /** Map of language code -> CEFR goal level (optional) */
  goal_lang_levels?: Record<string, GoalLangLevel>;
  reader_highlight_on_translate?: boolean;
  reader_font_size?: string;
  reader_font_family?: string;
  reader_highlight_color?: string;
  flashcard_again_cards?: number;
  flashcard_interval_hard_min?: number;
  flashcard_interval_good_min?: number;
  flashcard_interval_easy_min?: number;
  flashcard_interval_multiplier?: number;
  /**
   * Default flashcard study method when opening the deck.
   * Matches client-side StudyMethod union: 'spaced' | 'free'.
   */
  flashcard_preferred_study_method?: 'spaced' | 'free';
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

export type UserBookStatus = 'reading' | 'saved_for_later' | 'completed';

export interface UserBook {
  user_id: string;
  book_id: string;
  last_cfi: string | null;
  highlights: UserBookHighlight[];
  last_read_at: string;
  status?: UserBookStatus;
  created_at: string;
  updated_at: string;
}

export interface UserBookHighlight {
  id: string;
  cfi_range: string;
  selected_text: string;
  created_at: string;
  color: string;
  /** Translation for this highlight (nullable); set when user translates in popup or when saving from translate sheet */
  translation?: string | null;
  /** Page number (1-based) when highlight was created; may be stale if font/size changed */
  page?: number | null;
}

export interface VocabList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

