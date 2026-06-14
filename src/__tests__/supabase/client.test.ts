import { resolveSupabaseDbSchema } from '@/supabase/client';

describe('supabase client', () => {
  it('defaults db schema to lingoleaf', () => {
    expect(resolveSupabaseDbSchema({})).toBe('lingoleaf');
    expect(resolveSupabaseDbSchema({ EXPO_PUBLIC_SUPABASE_DB_SCHEMA: '' })).toBe('lingoleaf');
  });

  it('reads EXPO_PUBLIC_SUPABASE_DB_SCHEMA when set', () => {
    expect(resolveSupabaseDbSchema({ EXPO_PUBLIC_SUPABASE_DB_SCHEMA: 'lingoleaf' })).toBe('lingoleaf');
    expect(resolveSupabaseDbSchema({ EXPO_PUBLIC_SUPABASE_DB_SCHEMA: ' custom ' })).toBe('custom');
  });
});
