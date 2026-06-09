/**
 * Sync Gutendex → Supabase books table
 *
 * Purpose:
 * - Populate LingoLeaf with a large, US-first public-domain catalog.
 * - Store enough metadata to filter by author/language/subject.
 *
 * Requires env:
 * - EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage examples:
 * - node scripts/sync-gutendex.mjs --pages 5
 * - node scripts/sync-gutendex.mjs --pages 5 --lang es
 * - node scripts/sync-gutendex.mjs --pages 1 --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function pickBestEpubUrl(formats) {
  if (!formats || typeof formats !== 'object') return null;
  const direct = formats['application/epub+zip'];
  if (typeof direct === 'string') return direct;

  // Fallback: sometimes formats keys vary slightly
  for (const [k, v] of Object.entries(formats)) {
    if (typeof v === 'string' && k.toLowerCase().includes('epub')) return v;
  }
  return null;
}

function pickCoverUrl(formats) {
  if (!formats || typeof formats !== 'object') return null;
  const jpg = formats['image/jpeg'];
  if (typeof jpg === 'string') return jpg;
  return null;
}

function toSubjectsText(subjects, bookshelves) {
  const s = Array.isArray(subjects) ? subjects : [];
  const b = Array.isArray(bookshelves) ? bookshelves : [];
  const all = [...s, ...b].filter((x) => typeof x === 'string' && x.trim().length > 0);
  return all.length > 0 ? all.join(' • ') : null;
}

async function main() {
  const pages = Number(argValue('--pages') ?? '1');
  const lang = (argValue('--lang') ?? argValue('--language'))?.trim() || null;
  const dryRun = hasFlag('--dry-run');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing env: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let nextUrl = `https://gutendex.com/books/?page=1${lang ? `&languages=${encodeURIComponent(lang)}` : ''}`;
  let pageCount = 0;
  let totalUpserts = 0;

  while (nextUrl && pageCount < pages) {
    pageCount += 1;
    // eslint-disable-next-line no-console
    console.log(`[gutendex] fetching page ${pageCount}: ${nextUrl}`);

    const res = await fetch(nextUrl);
    if (!res.ok) throw new Error(`Gutendex fetch failed: ${res.status}`);
    const json = await res.json();

    const results = Array.isArray(json?.results) ? json.results : [];
    const rows = results
      .map((b) => {
        const gutenbergId = b?.id;
        if (typeof gutenbergId !== 'number') return null;

        const title = typeof b?.title === 'string' ? b.title.trim() : '';
        if (!title) return null;

        const authors = Array.isArray(b?.authors) ? b.authors : [];
        const firstAuthor = authors.find((a) => typeof a?.name === 'string' && a.name.trim().length > 0)?.name ?? null;

        const languages = Array.isArray(b?.languages) ? b.languages.filter((x) => typeof x === 'string') : [];
        const sourceLang = languages.length > 0 ? languages[0] : null;

        const subjects = Array.isArray(b?.subjects) ? b.subjects.filter((x) => typeof x === 'string') : null;
        const bookshelves = Array.isArray(b?.bookshelves) ? b.bookshelves.filter((x) => typeof x === 'string') : null;

        const summaries = Array.isArray(b?.summaries) ? b.summaries.filter((x) => typeof x === 'string') : [];
        const description = summaries.length > 0 ? summaries[0] : null;

        const formats = b?.formats;
        const epubUrl = pickBestEpubUrl(formats);
        const coverUrl = pickCoverUrl(formats);
        const popularityScore = typeof b?.download_count === 'number' && Number.isFinite(b.download_count) ? b.download_count : null;

        return {
          // existing schema
          title,
          author: firstAuthor,
          storage_path: null,
          cover_path: null,
          description,
          source_lang: sourceLang,
          popularity_score: popularityScore,

          // catalog metadata
          source: 'gutenberg',
          source_id: String(gutenbergId),
          epub_url: epubUrl,
          cover_url: coverUrl,
          languages,
          subjects,
          bookshelves,
          subjects_text: toSubjectsText(subjects, bookshelves),

          // mark as globally available in your app (column added by existing migration)
          is_general: true,
        };
      })
      .filter(Boolean);

    // eslint-disable-next-line no-console
    console.log(`[gutendex] mapped ${rows.length} books (dryRun=${dryRun})`);

    if (!dryRun && rows.length > 0) {
      const { error } = await supabase.from('books').upsert(rows, { onConflict: 'source,source_id' });
      if (error) throw error;
      totalUpserts += rows.length;
    }

    nextUrl = typeof json?.next === 'string' ? json.next : null;
  }

  // eslint-disable-next-line no-console
  console.log(`[gutendex] done. pages=${pageCount} upserts=${totalUpserts}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


