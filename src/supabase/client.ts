/**
 * Supabase client configuration
 * Uses AsyncStorage for session persistence
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

type SupabaseSchemaEnv = {
  EXPO_PUBLIC_SUPABASE_DB_SCHEMA?: string;
};

export function resolveSupabaseDbSchema(env?: SupabaseSchemaEnv): string {
  const raw = env?.EXPO_PUBLIC_SUPABASE_DB_SCHEMA ?? process.env.EXPO_PUBLIC_SUPABASE_DB_SCHEMA;
  const fromEnv = raw?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'lingoleaf';
}

export const supabaseDbSchema = resolveSupabaseDbSchema();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// IMPORTANT:
// Do not throw at import-time. Production builds can crash on launch if env vars are missing.
// App.tsx gates initialization and shows a config error screen when supabaseConfigured=false.
export const supabase = createClient(supabaseUrl || 'https://invalid.supabase.co', supabaseAnonKey || 'invalid', {
  db: { schema: supabaseDbSchema },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
