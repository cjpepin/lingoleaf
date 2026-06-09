/**
 * analytics/events
 *
 * Typed analytics event taxonomy and development-time payload validation.
 */

export type EventName =
  | 'screen_viewed'
  | 'sign_up_started'
  | 'sign_up_completed'
  | 'login_started'
  | 'login_completed'
  | 'logout'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'goal_set'
  | 'goal_progress_viewed'
  | 'library_opened'
  | 'library_search'
  | 'library_filter_opened'
  | 'library_filter_applied'
  | 'books_tab_viewed'
  | 'books_default_decided'
  | 'search_performed'
  | 'filter_applied'
  | 'book_opened'
  | 'book_preview_started'
  | 'book_preview_opened'
  | 'book_detail_viewed'
  | 'reading_session_started'
  | 'reading_session_ended'
  | 'page_turned'
  | 'translate_opened'
  | 'translation_completed'
  | 'vocab_saved'
  | 'highlight_saved'
  | 'audio_pronunciation_played'
  | 'study_opened'
  | 'study_session_started'
  | 'study_question_answered'
  | 'study_session_completed'
  | 'paywall_viewed'
  | 'paywall_dismissed'
  | 'purchase_started'
  | 'purchase_success'
  | 'purchase_failed'
  | 'purchase_restore'
  | 'purchase_completed'
  | 'purchase_restored'
  | 'premium_status_changed'
  | 'export_clicked'
  | 'export_completed'
  | 'export_failed'
  | 'ad_removed_seen'
  | 'progress_viewed'
  | 'garden_viewed'
  | 'garden_progressed'
  | 'garden_watered'
  | 'garden_stage_upgraded'
  | 'garden_streak_changed'
  | 'garden_died'
  | 'garden_revived'
  | 'study_pack_created'
  | 'study_pack_started'
  | 'study_pack_completed'
  | 'study_pack_dismissed'
  | 'study_pack_ai_generated'
  | 'study_pack_ai_failed'
  | 'ai_study_started'
  | 'book_started'
  | 'session_ended'
  | 'ad_impression'
  | 'ad_clicked'
  | 'api_error'
  | 'analytics_flush_failed';

export interface CommonEventProperties {
  app_version: string;
  build_number: string;
  platform: string;
  locale: string;
  timezone: string;
  is_premium: boolean;
  session_id: string;
  device_id: string;
  install_id: string;
}

export interface EventPayloadMap {
  screen_viewed: { screen_name: string; route_params?: Record<string, unknown> };

  sign_up_started: { method: 'email' | 'google' | 'apple'; source?: string };
  sign_up_completed: { method: 'email' | 'google' | 'apple'; source?: string };
  login_started: { method: 'email' | 'google' | 'apple'; source?: string };
  login_completed: { method: 'email' | 'google' | 'apple'; source?: string };
  logout: { source?: string };

  onboarding_started: { source?: string };
  onboarding_completed: { source?: string };
  goal_set: {
    minutes_per_day?: number;
    minutes?: number;
    source?: string;
    primary_goal?: 'reading_minutes' | 'words_saved' | 'words_learned';
    goal_priority?: string;
  };
  goal_progress_viewed: { minutes_goal: number; minutes_done_today: number };

  library_opened: { source?: string };
  library_search: { query_len: number; has_filters: boolean; language?: string };
  library_filter_opened: Record<string, never>;
  library_filter_applied: {
    difficulty?: 'Easy' | 'Med' | 'Hard' | null;
    length_bucket?: 'short' | 'medium' | 'long' | null;
    tags_count: number;
    short_wins: boolean;
  };
  books_tab_viewed: { tab: 'history' | 'saved'; source?: string };
  books_default_decided: { has_history: boolean; default_tab: 'history' | 'library' };
  search_performed: { query_length: number; source?: string };
  filter_applied: { language_count: number; subject_count: number; source?: string };
  book_opened: { book_id_hash: string; source?: string; placement?: string };
  book_preview_started: { book_id_hash: string; source?: string; placement?: string };
  book_preview_opened: { book_id: string };
  book_detail_viewed: {
    book_id: string;
    estimated_cefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
    difficulty?: 'Easy' | 'Med' | 'Hard' | null;
  };

  reading_session_started: { book_id_hash: string; source?: string };
  reading_session_ended: {
    book_id_hash: string;
    duration_ms: number;
    page_turns?: number;
    percent_complete?: number;
    source?: string;
  };
  page_turned: { book_id_hash: string; current_page: number; total_pages: number; source?: string };
  translate_opened: { book_id_hash: string; word_length: number; source?: string; placement?: string };
  translation_completed: {
    book_id_hash: string;
    word_length: number;
    success: boolean;
    source?: string;
    placement?: string;
  };
  vocab_saved: {
    book_id_hash: string;
    list_id_hash: string;
    source?: string;
    placement?: string;
    book_id?: string;
    word?: string;
    language?: string;
  };
  highlight_saved: { book_id_hash: string; source?: string; placement?: string };
  audio_pronunciation_played: { book_id_hash?: string; source?: string; placement?: string };

  study_opened: { source?: string };
  study_session_started: { mode: 'spaced' | 'free' | 'focus_pack'; source?: string; placement?: string };
  study_question_answered: { correct: boolean; mode: 'spaced' | 'free' | 'focus_pack'; source?: string };
  study_session_completed: { mode: 'spaced' | 'free' | 'focus_pack'; answered_count: number; source?: string };

  paywall_viewed: { placement: string; source?: string; plan_selected?: string };
  paywall_dismissed: { placement: string; source?: string; plan_selected?: string };
  purchase_started: {
    sku?: string;
    plan?: 'monthly' | 'yearly' | 'lifetime';
    placement?: string;
    source?: string;
    price?: number;
    currency?: string;
    result?: 'success' | 'cancel' | 'error';
    error_code?: string;
  };
  purchase_success: {
    plan: 'monthly' | 'yearly' | 'lifetime';
    source: string;
    price?: number;
    currency?: string;
    result?: 'success' | 'cancel' | 'error';
    error_code?: string;
  };
  purchase_failed: {
    plan: 'monthly' | 'yearly' | 'lifetime';
    source: string;
    placement?: string;
    error_code?: string;
    severity: 'critical';
    stage: 'purchase';
  };
  purchase_restore: {
    plan: 'monthly' | 'yearly' | 'lifetime';
    source: string;
    price?: number;
    currency?: string;
    result?: 'success' | 'cancel' | 'error';
    error_code?: string;
  };
  purchase_completed: { sku: string; placement?: string; source?: string };
  purchase_restored: { source?: string };
  premium_status_changed: { is_premium: boolean; source?: string };
  export_clicked: { locked: boolean; file_type?: string; format?: 'csv' | 'anki'; is_premium?: boolean };
  export_completed: { format: 'csv' | 'anki'; rows_count: number };
  export_failed: { format: 'csv' | 'anki'; error: string };
  progress_viewed: { range: 'day' | 'week' | 'month' | 'year'; is_premium: boolean; locked?: boolean };
  garden_viewed: {
    placement: string;
    stage: 'seed' | 'sprout' | 'sapling' | 'young_tree' | 'mature_tree' | 'blooming_tree' | 'ancient_tree';
    streak_days: number;
  };
  garden_progressed: {
    delta_gp: number;
    source: 'reading' | 'saved' | 'learned' | 'manual';
    minutes_done_today: number;
    goal_minutes: number;
  };
  garden_watered: { goal_type: 'reading' | 'saved' | 'learned'; goal_value: number; streak_days: number };
  garden_stage_upgraded: {
    from_stage: 'seed' | 'sprout' | 'sapling' | 'young_tree' | 'mature_tree' | 'blooming_tree' | 'ancient_tree';
    to_stage: 'seed' | 'sprout' | 'sapling' | 'young_tree' | 'mature_tree' | 'blooming_tree' | 'ancient_tree';
    total_gp: number;
  };
  garden_streak_changed: { old_streak: number; new_streak: number; reason: string };
  garden_died: { previous_stage: string; new_stage: string; previous_gp: number; new_gp: number };
  garden_revived: { stage: string; total_gp: number };
  study_pack_created: { pack_id: string; target_count: number; review_count: number; new_count: number };
  study_pack_started: { pack_id: string; target_count: number; review_count: number; new_count: number; source?: string };
  study_pack_completed: { pack_id: string; answered_count: number; review_count: number; new_count: number; source?: string };
  study_pack_dismissed: { pack_id: string; destination: string; source?: string };
  study_pack_ai_generated: { pack_id: string; word_count: number; group_count: number };
  study_pack_ai_failed: { pack_id: string; word_count: number; error: string };
  ad_removed_seen: { impression_count: number };
  ai_study_started: { mode: string; vocab_count?: number };
  book_started: { book_id: string; language?: string; difficulty?: string };
  session_ended: { duration_ms: number };

  ad_impression: { network: string; placement: string; source?: string };
  ad_clicked: { placement: string; source?: string };

  api_error: { endpoint: string; code: string; source?: string };
  analytics_flush_failed: { endpoint: string; code: string; source?: string };
}

export type EventPayload<Name extends EventName> = EventPayloadMap[Name];

interface FieldRule {
  type: 'string' | 'number' | 'boolean' | 'object';
  optional?: boolean;
}

type EventSchema = { [K in EventName]: Record<string, FieldRule> };

const EVENT_SCHEMA: EventSchema = {
  screen_viewed: {
    screen_name: { type: 'string' },
    route_params: { type: 'object', optional: true },
  },
  sign_up_started: { method: { type: 'string' }, source: { type: 'string', optional: true } },
  sign_up_completed: { method: { type: 'string' }, source: { type: 'string', optional: true } },
  login_started: { method: { type: 'string' }, source: { type: 'string', optional: true } },
  login_completed: { method: { type: 'string' }, source: { type: 'string', optional: true } },
  logout: { source: { type: 'string', optional: true } },
  onboarding_started: { source: { type: 'string', optional: true } },
  onboarding_completed: { source: { type: 'string', optional: true } },
  goal_set: {
    minutes_per_day: { type: 'number', optional: true },
    minutes: { type: 'number', optional: true },
    source: { type: 'string', optional: true },
    primary_goal: { type: 'string', optional: true },
    goal_priority: { type: 'string', optional: true },
  },
  goal_progress_viewed: {
    minutes_goal: { type: 'number' },
    minutes_done_today: { type: 'number' },
  },
  library_opened: { source: { type: 'string', optional: true } },
  library_search: {
    query_len: { type: 'number' },
    has_filters: { type: 'boolean' },
    language: { type: 'string', optional: true },
  },
  library_filter_opened: {},
  library_filter_applied: {
    difficulty: { type: 'string', optional: true },
    length_bucket: { type: 'string', optional: true },
    tags_count: { type: 'number' },
    short_wins: { type: 'boolean' },
  },
  books_tab_viewed: {
    tab: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  books_default_decided: {
    has_history: { type: 'boolean' },
    default_tab: { type: 'string' },
  },
  search_performed: { query_length: { type: 'number' }, source: { type: 'string', optional: true } },
  filter_applied: {
    language_count: { type: 'number' },
    subject_count: { type: 'number' },
    source: { type: 'string', optional: true },
  },
  book_opened: {
    book_id_hash: { type: 'string' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  book_preview_started: {
    book_id_hash: { type: 'string' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  book_preview_opened: {
    book_id: { type: 'string' },
  },
  book_detail_viewed: {
    book_id: { type: 'string' },
    estimated_cefr: { type: 'string', optional: true },
    difficulty: { type: 'string', optional: true },
  },
  reading_session_started: { book_id_hash: { type: 'string' }, source: { type: 'string', optional: true } },
  reading_session_ended: {
    book_id_hash: { type: 'string' },
    duration_ms: { type: 'number' },
    page_turns: { type: 'number', optional: true },
    percent_complete: { type: 'number', optional: true },
    source: { type: 'string', optional: true },
  },
  page_turned: {
    book_id_hash: { type: 'string' },
    current_page: { type: 'number' },
    total_pages: { type: 'number' },
    source: { type: 'string', optional: true },
  },
  translate_opened: {
    book_id_hash: { type: 'string' },
    word_length: { type: 'number' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  translation_completed: {
    book_id_hash: { type: 'string' },
    word_length: { type: 'number' },
    success: { type: 'boolean' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  vocab_saved: {
    book_id_hash: { type: 'string' },
    list_id_hash: { type: 'string' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
    book_id: { type: 'string', optional: true },
    word: { type: 'string', optional: true },
    language: { type: 'string', optional: true },
  },
  highlight_saved: {
    book_id_hash: { type: 'string' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  audio_pronunciation_played: {
    book_id_hash: { type: 'string', optional: true },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  study_opened: { source: { type: 'string', optional: true } },
  study_session_started: {
    mode: { type: 'string' },
    source: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
  },
  study_question_answered: {
    correct: { type: 'boolean' },
    mode: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  study_session_completed: {
    mode: { type: 'string' },
    answered_count: { type: 'number' },
    source: { type: 'string', optional: true },
  },
  paywall_viewed: {
    placement: { type: 'string' },
    source: { type: 'string', optional: true },
    plan_selected: { type: 'string', optional: true },
  },
  paywall_dismissed: {
    placement: { type: 'string' },
    source: { type: 'string', optional: true },
    plan_selected: { type: 'string', optional: true },
  },
  purchase_started: {
    sku: { type: 'string', optional: true },
    plan: { type: 'string', optional: true },
    placement: { type: 'string', optional: true },
    source: { type: 'string', optional: true },
    price: { type: 'number', optional: true },
    currency: { type: 'string', optional: true },
    result: { type: 'string', optional: true },
    error_code: { type: 'string', optional: true },
  },
  purchase_success: {
    plan: { type: 'string' },
    source: { type: 'string' },
    price: { type: 'number', optional: true },
    currency: { type: 'string', optional: true },
    result: { type: 'string', optional: true },
    error_code: { type: 'string', optional: true },
  },
  purchase_failed: {
    plan: { type: 'string' },
    source: { type: 'string' },
    placement: { type: 'string', optional: true },
    error_code: { type: 'string', optional: true },
    severity: { type: 'string' },
    stage: { type: 'string' },
  },
  purchase_restore: {
    plan: { type: 'string' },
    source: { type: 'string' },
    price: { type: 'number', optional: true },
    currency: { type: 'string', optional: true },
    result: { type: 'string', optional: true },
    error_code: { type: 'string', optional: true },
  },
  purchase_completed: {
    sku: { type: 'string' },
    placement: { type: 'string', optional: true },
    source: { type: 'string', optional: true },
  },
  purchase_restored: { source: { type: 'string', optional: true } },
  premium_status_changed: { is_premium: { type: 'boolean' }, source: { type: 'string', optional: true } },
  export_clicked: {
    locked: { type: 'boolean' },
    file_type: { type: 'string', optional: true },
    format: { type: 'string', optional: true },
    is_premium: { type: 'boolean', optional: true },
  },
  export_completed: {
    format: { type: 'string' },
    rows_count: { type: 'number' },
  },
  export_failed: {
    format: { type: 'string' },
    error: { type: 'string' },
  },
  progress_viewed: {
    range: { type: 'string' },
    is_premium: { type: 'boolean' },
    locked: { type: 'boolean', optional: true },
  },
  garden_viewed: {
    placement: { type: 'string' },
    stage: { type: 'string' },
    streak_days: { type: 'number' },
  },
  garden_progressed: {
    delta_gp: { type: 'number' },
    source: { type: 'string' },
    minutes_done_today: { type: 'number' },
    goal_minutes: { type: 'number' },
  },
  garden_watered: {
    goal_type: { type: 'string' },
    goal_value: { type: 'number' },
    streak_days: { type: 'number' },
  },
  garden_stage_upgraded: {
    from_stage: { type: 'string' },
    to_stage: { type: 'string' },
    total_gp: { type: 'number' },
  },
  garden_streak_changed: {
    old_streak: { type: 'number' },
    new_streak: { type: 'number' },
    reason: { type: 'string' },
  },
  garden_died: {
    previous_stage: { type: 'string' },
    new_stage: { type: 'string' },
    previous_gp: { type: 'number' },
    new_gp: { type: 'number' },
  },
  garden_revived: {
    stage: { type: 'string' },
    total_gp: { type: 'number' },
  },
  study_pack_created: {
    pack_id: { type: 'string' },
    target_count: { type: 'number' },
    review_count: { type: 'number' },
    new_count: { type: 'number' },
  },
  study_pack_started: {
    pack_id: { type: 'string' },
    target_count: { type: 'number' },
    review_count: { type: 'number' },
    new_count: { type: 'number' },
    source: { type: 'string', optional: true },
  },
  study_pack_completed: {
    pack_id: { type: 'string' },
    answered_count: { type: 'number' },
    review_count: { type: 'number' },
    new_count: { type: 'number' },
    source: { type: 'string', optional: true },
  },
  study_pack_dismissed: {
    pack_id: { type: 'string' },
    destination: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  study_pack_ai_generated: {
    pack_id: { type: 'string' },
    word_count: { type: 'number' },
    group_count: { type: 'number' },
  },
  study_pack_ai_failed: {
    pack_id: { type: 'string' },
    word_count: { type: 'number' },
    error: { type: 'string' },
  },
  ad_removed_seen: {
    impression_count: { type: 'number' },
  },
  ai_study_started: {
    mode: { type: 'string' },
    vocab_count: { type: 'number', optional: true },
  },
  book_started: {
    book_id: { type: 'string' },
    language: { type: 'string', optional: true },
    difficulty: { type: 'string', optional: true },
  },
  session_ended: {
    duration_ms: { type: 'number' },
  },
  ad_impression: {
    network: { type: 'string' },
    placement: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  ad_clicked: {
    placement: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  api_error: {
    endpoint: { type: 'string' },
    code: { type: 'string' },
    source: { type: 'string', optional: true },
  },
  analytics_flush_failed: {
    endpoint: { type: 'string' },
    code: { type: 'string' },
    source: { type: 'string', optional: true },
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertFieldType(name: string, key: string, rule: FieldRule, value: unknown): void {
  if (rule.type === 'object') {
    if (!isPlainObject(value)) {
      throw new Error(`Invalid analytics payload for ${name}: ${key} must be object`);
    }
    return;
  }
  if (typeof value !== rule.type) {
    throw new Error(`Invalid analytics payload for ${name}: ${key} must be ${rule.type}`);
  }
}

export function validatePayloadDev<Name extends EventName>(name: Name, payload: EventPayload<Name>): void {
  if (!__DEV__) return;

  const schema = EVENT_SCHEMA[name];
  const data = payload as Record<string, unknown>;

  Object.entries(schema).forEach(([key, rule]) => {
    const value = data[key];
    if (value == null) {
      if (!rule.optional) {
        throw new Error(`Invalid analytics payload for ${name}: missing ${key}`);
      }
      return;
    }
    assertFieldType(name, key, rule, value);
  });
}
