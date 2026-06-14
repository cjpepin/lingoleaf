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
 * - EXPO_PUBLIC_SUPABASE_DB_SCHEMA (optional; defaults to lingoleaf)
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

function resolveSupabaseDbSchema() {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_DB_SCHEMA?.trim();
  return raw && raw.length > 0 ? raw : 'lingoleaf';
}

const GUTENDEX_BASE_URL = 'https://gutendex.com';
const DEFAULT_FETCH_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BASE_MS = 2_000;
const DEFAULT_PAGE_DELAY_MS = 1_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchGutendex(url, options = {}) {
  const {
    maxRetries = Number(process.env.GUTENDEX_MAX_RETRIES ?? DEFAULT_MAX_RETRIES),
    retryBaseMs = Number(process.env.GUTENDEX_RETRY_BASE_MS ?? DEFAULT_RETRY_BASE_MS),
    timeoutMs = Number(process.env.GUTENDEX_FETCH_TIMEOUT_MS ?? DEFAULT_FETCH_TIMEOUT_MS),
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LingoLeaf/1.0 (Gutendex catalog sync; +https://github.com/cjpepin/lingoleaf)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        return res;
      }

      const body = await res.text().catch(() => '');
      const detail = body.trim().slice(0, 200);
      lastError = new Error(
        `Gutendex fetch failed: ${res.status}${detail ? ` — ${detail}` : ''}`,
      );

      if (!isRetryableStatus(res.status) || attempt === maxRetries) {
        throw lastError;
      }

      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : retryBaseMs * 2 ** (attempt - 1);

      // eslint-disable-next-line no-console
      console.warn(
        `[gutendex] ${res.status} from ${url}; retry ${attempt}/${maxRetries} in ${Math.round(delayMs / 1000)}s`,
      );
      await sleep(delayMs);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        err instanceof Error &&
        (err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          err.message.includes('fetch failed') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('ETIMEDOUT'));

      if (!retryable || attempt === maxRetries) {
        throw lastError;
      }

      const delayMs = retryBaseMs * 2 ** (attempt - 1);
      // eslint-disable-next-line no-console
      console.warn(
        `[gutendex] network error (${lastError.message}); retry ${attempt}/${maxRetries} in ${Math.round(delayMs / 1000)}s`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Gutendex fetch failed');

}

function formatGutendexError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('timeout') ||
    message.includes('TimeoutError') ||
    message.includes('AbortError') ||
    message.includes('fetch failed')
  ) {
    return new Error(
      `Gutendex (gutendex.com) is unavailable right now (${message}). ` +
        'This is a transient server-side issue — wait a few minutes and re-run, or host your own Gutendex instance.',
    );
  }
  return err instanceof Error ? err : new Error(message);
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

  const dbSchema = resolveSupabaseDbSchema();
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: dbSchema },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // eslint-disable-next-line no-console
  console.log(`[gutendex] target schema: ${dbSchema}.books`);

  let nextUrl = `${GUTENDEX_BASE_URL}/books/?page=1${lang ? `&languages=${encodeURIComponent(lang)}` : ''}`;
  let pageCount = 0;
  let totalUpserts = 0;
  const pageDelayMs = Number(process.env.GUTENDEX_PAGE_DELAY_MS ?? DEFAULT_PAGE_DELAY_MS);

  while (nextUrl && pageCount < pages) {
    pageCount += 1;
    // eslint-disable-next-line no-console
    console.log(`[gutendex] fetching page ${pageCount}: ${nextUrl}`);

    const res = await fetchGutendex(nextUrl);
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

    if (nextUrl && pageCount < pages && pageDelayMs > 0) {
      await sleep(pageDelayMs);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[gutendex] done. pages=${pageCount} upserts=${totalUpserts}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(formatGutendexError(err));
  process.exit(1);
});


