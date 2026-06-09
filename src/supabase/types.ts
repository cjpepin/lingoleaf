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
  language?: string | null;
  word_count?: number | null;
  unique_word_count?: number | null;
  avg_sentence_len?: number | null;
  lexical_score?: number | null;
  estimated_cefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
  lookup_rate_est?: 'Low' | 'Med' | 'High' | null;
  difficulty?: 'Easy' | 'Med' | 'Hard' | null;
  tags?: string[] | null;
  processed_at?: string | null;
  metadata_version?: number | null;
  sample_text?: string | null;
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

export interface ReadingSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  book_id: string | null;
  book_title: string | null;
  created_at?: string;
}

export interface VocabReview {
  id: string;
  user_id: string;
  vocab_id: string;
  reviewed_at: string;
  created_at?: string;
}

export interface UserGardenState {
  user_id: string;
  total_gp: number;
  stage: 'seed' | 'sprout' | 'sapling' | 'young_tree' | 'mature_tree' | 'blooming_tree' | 'ancient_tree';
  freshness: 'fresh' | 'resting' | 'dead';
  streak_days: number;
  last_goal_completed_on: string | null;
  last_activity_on: string | null;
  unlocks: string[];
  created_at?: string;
  updated_at?: string;
}

export interface UserGardenDailyProgress {
  user_id: string;
  day: string;
  reading_minutes: number;
  saved_count: number;
  learned_count: number;
  gp_awarded: number;
  goal_completed: boolean;
  streak_bonus_awarded: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Fluency for "languages you know": native, fluent, advanced, intermediate, beginner */
export type KnownLangLevel = 'native' | 'fluent' | 'advanced' | 'intermediate' | 'beginner';
/** CEFR level for "languages you're learning" */
export type GoalLangLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface UserSettings {
  user_id: string;
  admin?: boolean;
  deleted_at?: string | null;
  translate_count?: number | null;
  translate_window_start?: string | null;
  target_lang: string;
  is_premium?: boolean;
  premium_plan?: 'monthly' | 'yearly' | 'lifetime' | null;
  premium_updated_at?: string | null;
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
  /** Remove local book files if not read in this many days; 0 = never. Default 14. */
  auto_remove_downloads_after_days?: number;
  /** Daily reading goal minutes. Supported values: 5..60 in steps of 5. */
  daily_reading_goal_minutes?: number;
  /** Daily saved words/phrases goal. Supported values: 5..50 in steps of 5. */
  daily_words_saved_goal?: number;
  /** Daily learned words/phrases goal. Supported values: 1..15. */
  daily_words_learned_goal?: number;
  /** Main garden-health goal. */
  primary_goal?: 'reading_minutes' | 'words_saved' | 'words_learned';
  /** Ordered secondary goals used for hierarchy in onboarding/profile. */
  goal_priority?: Array<'reading_minutes' | 'words_saved' | 'words_learned'>;
  /** Daily local reminder toggle for goals. */
  daily_goal_reminder_enabled?: boolean;
  /** Reminder hour in local device time. */
  daily_goal_reminder_hour?: number;
  /** Reminder minute in local device time. */
  daily_goal_reminder_minute?: number;
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
  /**
   * Default true. When enabled, replace ambiguous gendered pronouns with neutral alternatives
   * in supported target languages.
   */
  neutralize_pronouns?: boolean;
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
