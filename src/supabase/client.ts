/**
 * Supabase client configuration
 * Uses AsyncStorage for session persistence
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// IMPORTANT:
// Do not throw at import-time. Production builds can crash on launch if env vars are missing.
// App.tsx gates initialization and shows a config error screen when supabaseConfigured=false.
export const supabase = createClient(supabaseUrl || 'https://invalid.supabase.co', supabaseAnonKey || 'invalid', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

