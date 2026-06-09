import { sanitizeMutableUserSettingsInput } from '@/supabase/userSettingsInput';

describe('sanitizeMutableUserSettingsInput', () => {
  it('keeps client-editable settings fields', () => {
    expect(
      sanitizeMutableUserSettingsInput({
        user_id: 'user-1',
        target_lang: 'es',
        app_lang: 'fr',
        daily_reading_goal_minutes: 15,
      })
    ).toEqual({
      user_id: 'user-1',
      target_lang: 'es',
      app_lang: 'fr',
      daily_reading_goal_minutes: 15,
    });
  });

  it('drops privileged and server-managed fields', () => {
    expect(
      sanitizeMutableUserSettingsInput({
        user_id: 'user-2',
        target_lang: 'de',
        admin: true,
        is_premium: true,
        premium_plan: 'lifetime',
        premium_updated_at: '2026-03-18T00:00:00.000Z',
        deleted_at: '2026-03-18T00:00:00.000Z',
        translate_count: 999,
        translate_window_start: '2026-03-18T00:00:00.000Z',
      } as unknown as Record<string, unknown> & { user_id: string })
    ).toEqual({
      user_id: 'user-2',
      target_lang: 'de',
    });
  });
});
