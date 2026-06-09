/**
 * migrate-user-data
 *
 * Service-role migration used when a guest user upgrades via OAuth providers and
 * Supabase returns a NEW user id (non-linking).
 *
 * Supports 2 modes:
 * - preflight: returns exactly what would transfer + cap violations (no writes)
 * - migrate: executes migration (blocked if preflight violations exist)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Body {
  from_user_id: string;
  to_user_id: string;
  mode?: 'preflight' | 'migrate';
  merge_strategy?: 'strict' | 'consolidate_into_existing';
  merge_target_list_id?: string | null;
}

interface VocabListRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface StudyWordRow {
  id: string;
  user_id: string;
  book_id: string;
  list_id: string | null;
  source_lang: string;
  target_lang: string;
  term_normalized: string;
  [key: string]: unknown;
}

interface UserBookRow {
  user_id: string;
  book_id: string;
  last_read_at: string | null;
  last_cfi: string | null;
  highlights: unknown;
}

interface ListPlan {
  sourceListId: string;
  sourceListName: string;
  sourceWordCount: number;
  targetAction: 'merge_into_existing' | 'create_new';
  targetListName: string;
  targetListId: string | null;
  wordsAdded: number;
  wordsSkippedDuplicates: number;
  resultingWordCount: number;
}

interface PreflightResult {
  ok: true;
  mode: 'preflight';
  can_migrate: boolean;
  summary: {
    hasUserSettings: boolean;
    hasUserPromptState: boolean;
    guestUserBookCount: number;
    overlappingUserBookCount: number;
    guestListCount: number;
    targetListCount: number;
    resultingListCount: number;
    guestStudyWordCount: number;
    guestOrphanWordCount: number;
  };
  list_plans: Array<{
    sourceListName: string;
    sourceWordCount: number;
    targetAction: 'merge_into_existing' | 'create_new';
    targetListName: string;
    wordsAdded: number;
    wordsSkippedDuplicates: number;
    resultingWordCount: number;
  }>;
  violations: string[];
}

const MAX_VOCAB_LISTS = 5;
const MAX_STUDY_LIST_WORDS = 512;
const ORPHAN_LIST_KEY = '__ORPHAN__';
type MergeStrategy = 'strict' | 'consolidate_into_existing';

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

function wordKey(w: Pick<StudyWordRow, 'book_id' | 'source_lang' | 'target_lang' | 'term_normalized'>): string {
  return `${w.book_id}|${w.source_lang}|${w.target_lang}|${w.term_normalized}`;
}

async function buildPreflightPlan(
  admin: ReturnType<typeof createClient>,
  from: string,
  to: string,
  strategy: MergeStrategy,
  mergeTargetListId?: string | null
): Promise<{ preflight: PreflightResult; listPlansById: Map<string, ListPlan> }> {
  const [
    guestListsResp,
    targetListsResp,
    guestWordsResp,
    targetWordsResp,
    guestBooksResp,
    hasSettingsResp,
    hasPromptResp,
  ] = await Promise.all([
    admin.from('vocab_lists').select('id,user_id,name,created_at,updated_at,last_used_at').eq('user_id', from),
    admin.from('vocab_lists').select('id,user_id,name,created_at,updated_at,last_used_at').eq('user_id', to),
    admin.from('study_words').select('id,user_id,book_id,list_id,source_lang,target_lang,term_normalized').eq('user_id', from),
    admin.from('study_words').select('book_id,list_id,source_lang,target_lang,term_normalized').eq('user_id', to),
    admin.from('user_books').select('book_id').eq('user_id', from),
    admin.from('user_settings').select('user_id').eq('user_id', from).maybeSingle(),
    admin.from('user_prompt_state').select('user_id').eq('user_id', from).maybeSingle(),
  ]);

  if (guestListsResp.error) throw guestListsResp.error;
  if (targetListsResp.error) throw targetListsResp.error;
  if (guestWordsResp.error) throw guestWordsResp.error;
  if (targetWordsResp.error) throw targetWordsResp.error;
  if (guestBooksResp.error) throw guestBooksResp.error;

  const guestLists = (guestListsResp.data ?? []) as VocabListRow[];
  const targetLists = (targetListsResp.data ?? []) as VocabListRow[];
  const guestWords = (guestWordsResp.data ?? []) as StudyWordRow[];
  const targetWords = (targetWordsResp.data ?? []) as StudyWordRow[];
  const guestBookIds = (guestBooksResp.data ?? []).map((r) => r.book_id as string);

  let overlappingUserBookCount = 0;
  if (guestBookIds.length > 0) {
    const overlapResp = await admin
      .from('user_books')
      .select('book_id')
      .eq('user_id', to)
      .in('book_id', guestBookIds);
    if (overlapResp.error) throw overlapResp.error;
    overlappingUserBookCount = (overlapResp.data ?? []).length;
  }

  const targetByName = new Map<string, VocabListRow>();
  targetLists.forEach((l) => targetByName.set(l.name.toLowerCase(), l));
  const targetById = new Map<string, VocabListRow>();
  targetLists.forEach((l) => targetById.set(l.id, l));

  const guestWordsByList = new Map<string, StudyWordRow[]>();
  guestWords.forEach((w) => {
    const key = w.list_id ?? ORPHAN_LIST_KEY;
    const arr = guestWordsByList.get(key) ?? [];
    arr.push(w);
    guestWordsByList.set(key, arr);
  });

  const targetWordKeysByList = new Map<string, Set<string>>();
  const targetWordCountsByList = new Map<string, number>();
  targetWords.forEach((w) => {
    const key = w.list_id ?? ORPHAN_LIST_KEY;
    const keySet = targetWordKeysByList.get(key) ?? new Set<string>();
    keySet.add(wordKey(w));
    targetWordKeysByList.set(key, keySet);
    targetWordCountsByList.set(key, (targetWordCountsByList.get(key) ?? 0) + 1);
  });

  const violations: string[] = [];
  const listPlansById = new Map<string, ListPlan>();
  let resultingListCount = targetLists.length;

  for (const gList of guestLists) {
    const sourceWords = guestWordsByList.get(gList.id) ?? [];
    const existingTarget = strategy === 'strict'
      ? (targetByName.get(gList.name.toLowerCase()) ?? null)
      : (mergeTargetListId ? targetById.get(mergeTargetListId) ?? null : null);

    let targetAction: ListPlan['targetAction'];
    let targetListName: string;
    let mappedTargetListId: string | null;
    let targetKeyForWords: string;

    if (existingTarget) {
      targetAction = 'merge_into_existing';
      targetListName = existingTarget.name;
      mappedTargetListId = existingTarget.id;
      targetKeyForWords = existingTarget.id;
    } else {
      if (strategy === 'consolidate_into_existing') {
        violations.push('Consolidation target list is required and must belong to this account.');
        targetAction = 'merge_into_existing';
        targetListName = 'Unknown';
        mappedTargetListId = null;
        targetKeyForWords = 'invalid_target';
        listPlansById.set(gList.id, {
          sourceListId: gList.id,
          sourceListName: gList.name,
          sourceWordCount: sourceWords.length,
          targetAction,
          targetListName,
          targetListId: mappedTargetListId,
          wordsAdded: 0,
          wordsSkippedDuplicates: 0,
          resultingWordCount: 0,
        });
        continue;
      }
      targetAction = 'create_new';
      targetListName = gList.name;
      mappedTargetListId = null;
      targetKeyForWords = `new:${gList.id}`;
      resultingListCount += 1;
      if (resultingListCount > MAX_VOCAB_LISTS) {
        violations.push(
          `List limit exceeded. Cannot add guest list "${gList.name}" because account already has ${targetLists.length} list(s) and max is ${MAX_VOCAB_LISTS}.`
        );
      }
    }

    const targetKeys = targetWordKeysByList.get(targetKeyForWords) ?? new Set<string>();
    const baseCount = targetWordCountsByList.get(targetKeyForWords) ?? 0;
    let wordsAdded = 0;
    let wordsSkippedDuplicates = 0;

    sourceWords.forEach((w) => {
      const k = wordKey(w);
      if (targetKeys.has(k)) {
        wordsSkippedDuplicates += 1;
      } else {
        targetKeys.add(k);
        wordsAdded += 1;
      }
    });

    targetWordKeysByList.set(targetKeyForWords, targetKeys);
    const resultingWordCount = baseCount + wordsAdded;
    targetWordCountsByList.set(targetKeyForWords, resultingWordCount);

    if (resultingWordCount > MAX_STUDY_LIST_WORDS) {
      violations.push(
        `List "${targetListName}" would have ${resultingWordCount} words after transfer (max ${MAX_STUDY_LIST_WORDS}).`
      );
    }

    listPlansById.set(gList.id, {
      sourceListId: gList.id,
      sourceListName: gList.name,
      sourceWordCount: sourceWords.length,
      targetAction,
      targetListName,
      targetListId: mappedTargetListId,
      wordsAdded,
      wordsSkippedDuplicates,
      resultingWordCount,
    });
  }

  // For consolidation strategy, include orphan words in the target list capacity check.
  if (strategy === 'consolidate_into_existing') {
    if (!mergeTargetListId || !targetById.has(mergeTargetListId)) {
      violations.push('Consolidation target list is required and must belong to this account.');
    } else {
      const targetWords = targetWordKeysByList.get(mergeTargetListId) ?? new Set<string>();
      const baseCount = targetWordCountsByList.get(mergeTargetListId) ?? 0;
      let addedFromOrphans = 0;
      const orphanWords = guestWordsByList.get(ORPHAN_LIST_KEY) ?? [];
      orphanWords.forEach((w) => {
        const k = wordKey(w);
        if (!targetWords.has(k)) {
          targetWords.add(k);
          addedFromOrphans += 1;
        }
      });
      const resultingWordCount = baseCount + addedFromOrphans;
      if (resultingWordCount > MAX_STUDY_LIST_WORDS) {
        const t = targetById.get(mergeTargetListId);
        violations.push(
          `List "${t?.name ?? mergeTargetListId}" would have ${resultingWordCount} words after transfer (max ${MAX_STUDY_LIST_WORDS}).`
        );
      }
    }
  }

  const preflight: PreflightResult = {
    ok: true,
    mode: 'preflight',
    can_migrate: violations.length === 0,
    summary: {
      hasUserSettings: Boolean(hasSettingsResp.data),
      hasUserPromptState: Boolean(hasPromptResp.data),
      guestUserBookCount: guestBookIds.length,
      overlappingUserBookCount,
      guestListCount: guestLists.length,
      targetListCount: targetLists.length,
      resultingListCount,
      guestStudyWordCount: guestWords.length,
      guestOrphanWordCount: (guestWordsByList.get(ORPHAN_LIST_KEY) ?? []).length,
    },
    list_plans: Array.from(listPlansById.values()).map((p) => ({
      sourceListName: p.sourceListName,
      sourceWordCount: p.sourceWordCount,
      targetAction: p.targetAction,
      targetListName: p.targetListName,
      wordsAdded: p.wordsAdded,
      wordsSkippedDuplicates: p.wordsSkippedDuplicates,
      resultingWordCount: p.resultingWordCount,
    })),
    violations,
  };

  return { preflight, listPlansById };
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
    const mode = body?.mode ?? 'migrate';
    const strategy = (body?.merge_strategy ?? 'strict') as MergeStrategy;
    const mergeTargetListId = body?.merge_target_list_id ?? null;
    if (!from || !to) return json(400, { error: 'Missing from_user_id/to_user_id' });
    if (mode !== 'preflight' && mode !== 'migrate') return json(400, { error: 'Invalid mode' });
    if (strategy !== 'strict' && strategy !== 'consolidate_into_existing') {
      return json(400, { error: 'Invalid merge_strategy' });
    }
    if (from === to) return json(200, { ok: true, migrated: false });

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json(401, { error: 'Invalid session' });
    if (userData.user.id !== to) return json(403, { error: 'to_user_id must match auth.uid()' });

    const { preflight, listPlansById } = await buildPreflightPlan(admin, from, to, strategy, mergeTargetListId);
    if (mode === 'preflight') {
      return json(200, preflight);
    }

    if (!preflight.can_migrate) {
      return json(409, {
        error: 'Migration blocked by limits',
        mode: 'preflight',
        can_migrate: false,
        violations: preflight.violations,
        summary: preflight.summary,
      });
    }

    const results: Array<{ table: string; added: number; skipped: number }> = [];

    const mergeSingletonTable = async (table: string): Promise<void> => {
      const { data: targetRow } = await admin.from(table).select('user_id').eq('user_id', to).maybeSingle();
      if (targetRow) {
        await admin.from(table).delete().eq('user_id', from);
        results.push({ table, added: 0, skipped: 1 });
        return;
      }
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

    const mergeOrphanStudyWords = async (): Promise<void> => {
      const { data: orphans } = await admin.from('study_words').select('*').eq('user_id', from).is('list_id', null);
      if (!orphans?.length) return;

      const { data: targetOrphans } = await admin
        .from('study_words')
        .select('book_id,source_lang,target_lang,term_normalized')
        .eq('user_id', to)
        .is('list_id', null);

      const keys = new Set((targetOrphans ?? []).map((w) => wordKey(w as StudyWordRow)));
      for (const word of orphans as StudyWordRow[]) {
        const k = wordKey(word);
        if (keys.has(k)) continue;
        const { id: _id, user_id: _uid, ...rest } = word;
        await admin.from('study_words').insert({ ...rest, user_id: to }).catch(() => {});
        keys.add(k);
      }

      await admin.from('study_words').delete().eq('user_id', from).is('list_id', null);
    };

    const mergeVocabAndWords = async (): Promise<void> => {
      const { data: guestLists, error: glErr } = await admin
        .from('vocab_lists')
        .select('id,user_id,name,created_at,updated_at,last_used_at')
        .eq('user_id', from);
      if (glErr) throw glErr;

      if (!guestLists?.length) {
        results.push({ table: 'vocab_lists', added: 0, skipped: 0 });
        results.push({ table: 'study_words', added: 0, skipped: 0 });
        await mergeOrphanStudyWords();
        return;
      }

      const { data: targetLists } = await admin
        .from('vocab_lists')
        .select('id,user_id,name,created_at,updated_at,last_used_at')
        .eq('user_id', to);

      let currentTargetListCount = (targetLists ?? []).length;
      const targetByName = new Map<string, VocabListRow>();
      (targetLists ?? []).forEach((l) => targetByName.set((l as VocabListRow).name.toLowerCase(), l as VocabListRow));
      const targetById = new Map<string, VocabListRow>();
      (targetLists ?? []).forEach((l) => targetById.set((l as VocabListRow).id, l as VocabListRow));

      let listsAdded = 0;
      let listsSkipped = 0;
      let wordsAdded = 0;
      let wordsSkipped = 0;

      for (const gListRaw of guestLists as VocabListRow[]) {
        const gList = gListRaw;
        const plan = listPlansById.get(gList.id);
        if (!plan) continue;

        let resolvedTargetListId: string;
        const existingByName = strategy === 'strict'
          ? (targetByName.get(plan.targetListName.toLowerCase()) ?? null)
          : (mergeTargetListId ? targetById.get(mergeTargetListId) ?? null : null);
        if (plan.targetAction === 'merge_into_existing' && existingByName) {
          resolvedTargetListId = existingByName.id;
          listsSkipped++;
        } else {
          if (currentTargetListCount >= MAX_VOCAB_LISTS) {
            throw new Error(`List limit exceeded while migrating "${gList.name}" (max ${MAX_VOCAB_LISTS})`);
          }
          const { id: _id, user_id: _uid, ...rest } = gList;
          const insertResp = await admin
            .from('vocab_lists')
            .insert({ ...rest, user_id: to })
            .select('id,user_id,name,created_at,updated_at,last_used_at')
            .single();
          if (insertResp.error || !insertResp.data) {
            throw insertResp.error ?? new Error(`Failed to create target list for ${gList.name}`);
          }
          const created = insertResp.data as VocabListRow;
          resolvedTargetListId = created.id;
          targetByName.set(created.name.toLowerCase(), created);
          currentTargetListCount += 1;
          listsAdded++;
        }

        const guestWordsResp = await admin
          .from('study_words')
          .select('*')
          .eq('user_id', from)
          .eq('list_id', gList.id);
        if (guestWordsResp.error) throw guestWordsResp.error;

        const targetWordsResp = await admin
          .from('study_words')
          .select('book_id,source_lang,target_lang,term_normalized')
          .eq('user_id', to)
          .eq('list_id', resolvedTargetListId);
        if (targetWordsResp.error) throw targetWordsResp.error;

        const targetKeys = new Set((targetWordsResp.data ?? []).map((w) => wordKey(w as StudyWordRow)));

        for (const word of (guestWordsResp.data ?? []) as StudyWordRow[]) {
          const k = wordKey(word);
          if (targetKeys.has(k)) {
            wordsSkipped++;
            continue;
          }

          const { id: _id, user_id: _uid, list_id: _lid, ...rest } = word;
          const insResp = await admin.from('study_words').insert({ ...rest, user_id: to, list_id: resolvedTargetListId });
          if (insResp.error) {
            wordsSkipped++;
          } else {
            wordsAdded++;
            targetKeys.add(k);
          }
        }
      }

      await admin.from('vocab_lists').delete().eq('user_id', from);

      results.push({ table: 'vocab_lists', added: listsAdded, skipped: listsSkipped });
      results.push({ table: 'study_words', added: wordsAdded, skipped: wordsSkipped });

      await mergeOrphanStudyWords();
    };

    const mergeUserBooks = async (): Promise<void> => {
      const table = 'user_books';
      const guestResp = await admin.from(table).select('*').eq('user_id', from);
      if (guestResp.error) throw guestResp.error;
      const guestRows = (guestResp.data ?? []) as UserBookRow[];
      if (guestRows.length === 0) {
        results.push({ table, added: 0, skipped: 0 });
        return;
      }

      const bookIds = guestRows.map((r) => r.book_id);
      const existingResp = await admin.from(table).select('*').eq('user_id', to).in('book_id', bookIds);
      if (existingResp.error) throw existingResp.error;
      const existingByBook = new Map((existingResp.data ?? []).map((r) => [(r as UserBookRow).book_id, r as UserBookRow]));

      let added = 0;
      let merged = 0;
      const nowIso = new Date().toISOString();

      for (const g of guestRows) {
        const existing = existingByBook.get(g.book_id);
        if (!existing) {
          const { user_id: _uid, ...rest } = g;
          await admin.from(table).upsert({ ...rest, user_id: to, updated_at: nowIso }, { onConflict: 'user_id,book_id' });
          added++;
          continue;
        }

        const guestMs = toMillis(g.last_read_at);
        const existingMs = toMillis(existing.last_read_at);
        const useGuest = guestMs >= existingMs;
        const mergedRow = {
          user_id: to,
          book_id: g.book_id,
          last_read_at: useGuest
            ? (g.last_read_at ?? existing.last_read_at ?? nowIso)
            : (existing.last_read_at ?? g.last_read_at ?? nowIso),
          last_cfi: useGuest ? (g.last_cfi ?? existing.last_cfi) : (existing.last_cfi ?? g.last_cfi),
          highlights: mergeHighlightsJson(existing.highlights, g.highlights),
          updated_at: nowIso,
        };
        await admin.from(table).update(mergedRow).eq('user_id', to).eq('book_id', g.book_id);
        merged++;
      }

      await admin.from(table).delete().eq('user_id', from);
      results.push({ table, added, skipped: merged });
    };

    await mergeSingletonTable('user_settings');
    await mergeSingletonTable('user_prompt_state');
    await mergeVocabAndWords();
    await mergeUserBooks();

    return json(200, { ok: true, migrated: true, results });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
