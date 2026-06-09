import type { UserSettings } from './types';

const MUTABLE_USER_SETTINGS_KEYS = [
  'target_lang',
  'native_lang',
  'known_langs',
  'goal_langs',
  'known_lang_levels',
  'goal_lang_levels',
  'reader_highlight_on_translate',
  'reader_font_size',
  'reader_font_family',
  'reader_highlight_color',
  'flashcard_again_cards',
  'flashcard_interval_hard_min',
  'flashcard_interval_good_min',
  'flashcard_interval_easy_min',
  'flashcard_interval_multiplier',
  'flashcard_preferred_study_method',
  'app_lang',
  'auto_remove_downloads_after_days',
  'daily_reading_goal_minutes',
  'daily_words_saved_goal',
  'daily_words_learned_goal',
  'primary_goal',
  'goal_priority',
  'daily_goal_reminder_enabled',
  'daily_goal_reminder_hour',
  'daily_goal_reminder_minute',
] as const satisfies ReadonlyArray<keyof UserSettings>;

type MutableUserSettingsKey = (typeof MUTABLE_USER_SETTINGS_KEYS)[number];

export type ClientUserSettingsUpsert = {
  user_id: string;
} & Partial<Pick<UserSettings, MutableUserSettingsKey>>;

export function sanitizeMutableUserSettingsInput(
  settings: ClientUserSettingsUpsert | (Record<string, unknown> & { user_id: string })
): ClientUserSettingsUpsert {
  const sanitized: ClientUserSettingsUpsert = {
    user_id: settings.user_id,
  };

  for (const key of MUTABLE_USER_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      const value = settings[key];
      if (value !== undefined) {
        (sanitized as Record<string, unknown>)[key] = value;
      }
    }
  }

  return sanitized;
}
