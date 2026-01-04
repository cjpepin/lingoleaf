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

type UserBookRow = {
  user_id: string;
  book_id: string;
  last_cfi: string | null;
  last_read_at: string | null;
  highlights: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

function safeParseHighlights(value: unknown): Array<{ id?: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((h) => h && typeof h === 'object') as Array<{ id?: string }>;
}

function mergeHighlights(a: unknown, b: unknown): unknown {
  const left = safeParseHighlights(a);
  const right = safeParseHighlights(b);
  const out: Array<{ id?: string }> = [];
  const seen = new Set<string>();

  const push = (h: { id?: string }) => {
    const id = typeof h.id === 'string' ? h.id : null;
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(h);
  };

  left.forEach(push);
  right.forEach(push);
  return out;
}

function toMillis(ts: string | null | undefined): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
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

    const mergeUserBooks = async (): Promise<{ table: string; count: number }> => {
      // `user_books` has a composite PK (user_id, book_id). When the target user already has history
      // for the same book, a naïve "update user_id=to" will violate the PK. We merge instead.
      const { data: guestRows, error: guestErr } = await admin
        .from('user_books')
        .select('user_id,book_id,last_cfi,last_read_at,highlights,created_at,updated_at')
        .eq('user_id', from);
      if (guestErr) throw guestErr;
      const rows = (guestRows ?? []) as UserBookRow[];
      if (rows.length === 0) return { table: 'user_books', count: 0 };

      const bookIds = rows.map((r) => r.book_id);
      const { data: existingRows, error: existErr } = await admin
        .from('user_books')
        .select('user_id,book_id,last_cfi,last_read_at,highlights')
        .eq('user_id', to)
        .in('book_id', bookIds);
      if (existErr) throw existErr;
      const existing = (existingRows ?? []) as Array<Pick<UserBookRow, 'book_id' | 'last_cfi' | 'last_read_at' | 'highlights'>>;
      const existingByBook = new Map(existing.map((r) => [r.book_id, r]));

      let migrated = 0;
      const nowIso = new Date().toISOString();

      for (const g of rows) {
        const e = existingByBook.get(g.book_id) ?? null;
        if (!e) {
          const { error } = await admin.from('user_books').upsert(
            {
              user_id: to,
              book_id: g.book_id,
              last_cfi: g.last_cfi,
              last_read_at: g.last_read_at ?? nowIso,
              highlights: Array.isArray(g.highlights) ? g.highlights : [],
              updated_at: nowIso,
              created_at: nowIso,
            },
            { onConflict: 'user_id,book_id' }
          );
          if (error) throw error;
          migrated += 1;
          continue;
        }

        const guestMs = toMillis(g.last_read_at ?? null);
        const existingMs = toMillis(e.last_read_at ?? null);
        const useGuest = guestMs >= existingMs;

        const merged = {
          user_id: to,
          book_id: g.book_id,
          last_read_at: useGuest ? (g.last_read_at ?? e.last_read_at ?? nowIso) : (e.last_read_at ?? g.last_read_at ?? nowIso),
          last_cfi: useGuest ? (g.last_cfi ?? e.last_cfi) : (e.last_cfi ?? g.last_cfi),
          highlights: mergeHighlights(e.highlights, g.highlights),
          updated_at: nowIso,
        };

        const { error } = await admin.from('user_books').update(merged).eq('user_id', to).eq('book_id', g.book_id);
        if (error) throw error;
        migrated += 1;
      }

      // Remove the guest rows so history doesn't remain duplicated under the old guest id.
      const { error: delErr } = await admin.from('user_books').delete().eq('user_id', from);
      if (delErr) throw delErr;

      return { table: 'user_books', count: migrated };
    };

    updates.push(doUpdate('user_settings'));
    updates.push(doUpdate('user_prompt_state'));
    updates.push(doUpdate('vocab_lists'));
    updates.push(doUpdate('study_words'));
    updates.push(doUpdate('highlights'));
    updates.push(mergeUserBooks());

    const results = await Promise.all(updates);
    return json(200, { ok: true, migrated: true, results });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});


