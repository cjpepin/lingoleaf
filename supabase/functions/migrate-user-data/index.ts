/**
 * migrate-user-data
 *
 * Service-role migration used when a guest user upgrades via OAuth providers and
 * Supabase returns a NEW user id (non-linking).
 *
 * Input:
 *  - from_user_id: string (old guest id)
 *  - to_user_id: string (new authenticated id)
 *
 * Security:
 *  - Requires Authorization header for the NEW session.
 *  - Verifies auth.uid() === to_user_id before migrating.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Body {
  from_user_id: string;
  to_user_id: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(500, { error: 'Missing Supabase env vars' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json(401, { error: 'Missing Authorization' });

    const body = (await req.json()) as Body;
    const from = body?.from_user_id;
    const to = body?.to_user_id;
    if (!from || !to) return json(400, { error: 'Missing from_user_id/to_user_id' });
    if (from === to) return json(200, { ok: true, migrated: false });

    // Verify caller is the NEW user.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user?.id) return json(401, { error: 'Invalid session' });
    if (userData.user.id !== to) return json(403, { error: 'to_user_id must match auth.uid()' });

    const admin = createClient(supabaseUrl, serviceKey);

    // Tables with user_id columns we own.
    const updates: Array<Promise<{ table: string; count: number }>> = [];
    const doUpdate = async (table: string, userCol: string = 'user_id'): Promise<{ table: string; count: number }> => {
      const { data, error } = await admin
        .from(table)
        .update({ [userCol]: to })
        .eq(userCol, from)
        .select('id', { count: 'exact' });
      if (error) throw error;
      return { table, count: Array.isArray(data) ? data.length : 0 };
    };

    updates.push(doUpdate('user_settings'));
    updates.push(doUpdate('user_prompt_state'));
    updates.push(doUpdate('vocab_lists'));
    updates.push(doUpdate('study_words'));
    updates.push(doUpdate('highlights'));
    updates.push(doUpdate('user_books'));

    const results = await Promise.all(updates);
    return json(200, { ok: true, migrated: true, results });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});


