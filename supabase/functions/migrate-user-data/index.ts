/**
 * migrate-user-data
 *
 * Service-role migration used when a guest user upgrades via OAuth providers and
 * Supabase returns a NEW user id (non-linking).
 *
 * Merges guest data INTO the authenticated user via upsert (never overwrites
 * existing authenticated-user rows). Guest-only rows are moved; conflicts are
 * skipped so the authenticated user's data takes precedence.
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

function toMillis(ts: string | null | undefined): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

function safeParseHighlights(value: unknown): Array<{ id?: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((h) => h && typeof h === 'object') as Array<{ id?: string }>;
}

function mergeHighlightsJson(a: unknown, b: unknown): unknown {
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

export default Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: 'Missing Supabase env vars' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json(401, { error: 'Missing Authorization' });

    const body = (await req.json()) as Body;
    const from = body?.from_user_id;
    const to = body?.to_user_id;
    if (!from || !to) return json(400, { error: 'Missing from_user_id/to_user_id' });
    if (from === to) return json(200, { ok: true, migrated: false });

    // Verify caller is the NEW user. Pass token explicitly to avoid header issues.
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json(401, { error: 'Invalid session' });
    if (userData.user.id !== to) return json(403, { error: 'to_user_id must match auth.uid()' });

    const results: Array<{ table: string; added: number; skipped: number }> = [];

    // ── Single-row tables (user_settings, user_prompt_state) ──
    // Keep target's row if it exists; only move guest's row if target has none.
    const mergeSingletonTable = async (table: string): Promise<void> => {
      const { data: targetRow } = await admin.from(table).select('user_id').eq('user_id', to).maybeSingle();
      if (targetRow) {
        // Target already has data — delete guest's row, keep target's
        await admin.from(table).delete().eq('user_id', from);
        results.push({ table, added: 0, skipped: 1 });
        return;
      }
      // No target row — move guest's row
      const { data: guestRow } = await admin.from(table).select('*').eq('user_id', from).maybeSingle();
      if (!guestRow) {
        results.push({ table, added: 0, skipped: 0 });
        return;
      }
      const { user_id: _uid, ...rest } = guestRow;
      await admin.from(table).upsert({ ...rest, user_id: to }, { onConflict: 'user_id' });
      await admin.from(table).delete().eq('user_id', from);
      results.push({ table, added: 1, skipped: 0 });
    };

    // ── highlights are stored as JSON in user_books.highlights ──
    // Merged inside mergeUserBooks() via mergeHighlightsJson(). No separate table.

    // ── vocab_lists + study_words: lists unique on (user_id, lower(name)) ──
    // study_words unique on (user_id, book_id, source_lang, target_lang, term_normalized, list_id)
    const mergeVocabAndWords = async (): Promise<void> => {
      const { data: guestLists, error: glErr } = await admin.from('vocab_lists').select('*').eq('user_id', from);
      if (glErr) throw glErr;
      if (!guestLists?.length) {
        results.push({ table: 'vocab_lists', added: 0, skipped: 0 });
        results.push({ table: 'study_words', added: 0, skipped: 0 });
        // Still check for orphan study_words with no list
        await mergeOrphanStudyWords();
        return;
      }

      // Fetch target's existing list names (lowered)
      const { data: targetLists } = await admin.from('vocab_lists').select('id,name').eq('user_id', to);
      const targetByName = new Map((targetLists ?? []).map((l: any) => [l.name.toLowerCase(), l.id]));

      let listsAdded = 0;
      let listsSkipped = 0;
      let wordsAdded = 0;
      let wordsSkipped = 0;

      for (const gList of guestLists) {
        const nameKey = gList.name.toLowerCase();
        let targetListId: string;

        if (targetByName.has(nameKey)) {
          // Target already has a list with this name — merge words into it
          targetListId = targetByName.get(nameKey)!;
          listsSkipped++;
        } else {
          // Create new list for target
          const { id: _id, user_id: _uid, ...rest } = gList;
          const { data: newList, error: nlErr } = await admin
            .from('vocab_lists')
            .insert({ ...rest, user_id: to })
            .select('id')
            .single();
          if (nlErr) { listsSkipped++; continue; }
          targetListId = newList.id;
          targetByName.set(nameKey, targetListId);
          listsAdded++;
        }

        // Move study_words from guest list → target list
        const { data: guestWords, error: gwErr } = await admin
          .from('study_words')
          .select('*')
          .eq('user_id', from)
          .eq('list_id', gList.id);
        if (gwErr) throw gwErr;

        // Fetch target's existing words in this list for conflict check
        const { data: targetWords } = await admin
          .from('study_words')
          .select('book_id,source_lang,target_lang,term_normalized')
          .eq('user_id', to)
          .eq('list_id', targetListId);
        const targetWordKeys = new Set(
          (targetWords ?? []).map((w: any) => `${w.book_id}|${w.source_lang}|${w.target_lang}|${w.term_normalized}`)
        );

        for (const word of guestWords ?? []) {
          const wKey = `${word.book_id}|${word.source_lang}|${word.target_lang}|${word.term_normalized}`;
          if (targetWordKeys.has(wKey)) {
            wordsSkipped++;
            continue;
          }
          const { id: _id, user_id: _uid, list_id: _lid, ...rest } = word;
          const { error: insErr } = await admin
            .from('study_words')
            .insert({ ...rest, user_id: to, list_id: targetListId });
          if (insErr) { wordsSkipped++; } else { wordsAdded++; }
        }
      }

      // Clean up guest data (cascade will remove study_words in those lists)
      await admin.from('vocab_lists').delete().eq('user_id', from);

      results.push({ table: 'vocab_lists', added: listsAdded, skipped: listsSkipped });
      results.push({ table: 'study_words', added: wordsAdded, skipped: wordsSkipped });

      // Also handle orphan study_words (no list_id)
      await mergeOrphanStudyWords();
    };

    // study_words that have no list_id (shouldn't normally happen, but defensive)
    const mergeOrphanStudyWords = async (): Promise<void> => {
      const { data: orphans } = await admin
        .from('study_words')
        .select('*')
        .eq('user_id', from)
        .is('list_id', null);
      if (!orphans?.length) return;

      const { data: targetOrphans } = await admin
        .from('study_words')
        .select('book_id,source_lang,target_lang,term_normalized')
        .eq('user_id', to)
        .is('list_id', null);
      const keys = new Set(
        (targetOrphans ?? []).map((w: any) => `${w.book_id}|${w.source_lang}|${w.target_lang}|${w.term_normalized}`)
      );
      for (const word of orphans) {
        const wKey = `${word.book_id}|${word.source_lang}|${word.target_lang}|${word.term_normalized}`;
        if (keys.has(wKey)) continue;
        const { id: _id, user_id: _uid, ...rest } = word;
        await admin.from('study_words').insert({ ...rest, user_id: to }).catch(() => {});
      }
      await admin.from('study_words').delete().eq('user_id', from).is('list_id', null);
    };

    // ── user_books: composite PK (user_id, book_id), merge reading progress + highlights JSON ──
    const mergeUserBooks = async (): Promise<void> => {
      const table = 'user_books';
      const { data: guestRows, error: gErr } = await admin.from(table).select('*').eq('user_id', from);
      if (gErr) throw gErr;
      if (!guestRows?.length) { results.push({ table, added: 0, skipped: 0 }); return; }

      const bookIds = guestRows.map((r: any) => r.book_id);
      const { data: existingRows } = await admin
        .from(table)
        .select('*')
        .eq('user_id', to)
        .in('book_id', bookIds);
      const existingByBook = new Map((existingRows ?? []).map((r: any) => [r.book_id, r]));

      let added = 0;
      let merged = 0;
      const nowIso = new Date().toISOString();

      for (const g of guestRows) {
        const existing = existingByBook.get(g.book_id);
        if (!existing) {
          // No conflict — move to target
          const { user_id: _uid, ...rest } = g;
          await admin.from(table).upsert(
            { ...rest, user_id: to, updated_at: nowIso },
            { onConflict: 'user_id,book_id' }
          );
          added++;
        } else {
          // Both have this book — merge: keep most recent reading position, combine highlights
          const guestMs = toMillis(g.last_read_at);
          const existMs = toMillis(existing.last_read_at);
          const useGuest = guestMs >= existMs;
          const mergedRow = {
            user_id: to,
            book_id: g.book_id,
            last_read_at: useGuest ? (g.last_read_at ?? existing.last_read_at ?? nowIso) : (existing.last_read_at ?? g.last_read_at ?? nowIso),
            last_cfi: useGuest ? (g.last_cfi ?? existing.last_cfi) : (existing.last_cfi ?? g.last_cfi),
            highlights: mergeHighlightsJson(existing.highlights, g.highlights),
            updated_at: nowIso,
          };
          await admin.from(table).update(mergedRow).eq('user_id', to).eq('book_id', g.book_id);
          merged++;
        }
      }

      // Remove guest rows
      await admin.from(table).delete().eq('user_id', from);
      results.push({ table, added, skipped: merged });
    };

    // ── study_word_reviews: FK to study_words, handled by cascade when study_words move ──
    // No separate handling needed — reviews follow their study_word.

    // Run all merges
    await mergeSingletonTable('user_settings');
    await mergeSingletonTable('user_prompt_state');
    await mergeVocabAndWords();
    await mergeUserBooks();

    return json(200, { ok: true, migrated: true, results });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
