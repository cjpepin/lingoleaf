import type { User } from '@supabase/supabase-js';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@lingoleaf.local',
  phone: '',
  app_metadata: { provider: 'demo' },
  user_metadata: { name: 'Demo Reader' },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: true,
};
