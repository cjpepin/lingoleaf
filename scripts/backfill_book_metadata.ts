/**
 * Backfill computed book metadata into public.books.
 *
 * Usage examples:
 *   npx tsx scripts/backfill_book_metadata.ts --language=es --skipProcessed --concurrency=2
 *   npx tsx scripts/backfill_book_metadata.ts --force --concurrency=2
 *   npx tsx scripts/backfill_book_metadata.ts --bookId=<uuid> --dryRun
 *   npx tsx scripts/backfill_book_metadata.ts --report
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type DifficultyLegacy = 'Easy' | 'Med' | 'Hard';
type DifficultyLabel = 'easy' | 'medium' | 'hard';
type LookupRate = 'Low' | 'Medium' | 'High';
type FrequencySets = { top5k: Set<string>; top20k: Set<string>; hasExternalLists: boolean };

type BookRow = {
  id: string;
  title: string | null;
  author: string | null;
  source: string | null;
  source_id: string | null;
  source_lang: string | null;
  language: string | null;
  epub_url: string | null;
  tags: string[] | null;
  subjects: string[] | null;
  bookshelves: string[] | null;
  description: string | null;
  sample_text: string | null;
  processed_at: string | null;
  metadata_version: number | null;
  content?: string | null;
  full_text?: string | null;
};

type CliArgs = {
  language?: string;
  limit?: number;
  concurrency: number;
  skipProcessed: boolean;
  force: boolean;
  bookId?: string;
  dryRun: boolean;
  fromOffset?: number;
  cursor?: number;
  report: boolean;
};

type Checkpoint = {
  offset: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  updatedAt: string;
};

type ResolvedText = {
  text: string | null;
  source: 'full_text' | 'epub_url' | 'sample_text' | 'book_chapters' | 'gutendex' | 'none';
};

type TokenSpan = {
  token: string;
  matchToken: string;
  start: number;
  end: number;
};

type WindowMetrics = {
  avg_sentence_len: number;
  sentence_len_p90: number;
  comma_per_1k_chars: number;
  avg_word_len: number;
  dialogue_ratio: number;
  oov_5k: number;
  oov_20k: number;
  hapax_rate: number;
};

type BookMetrics = {
  word_count: number;
  unique_word_count: number;
  avg_sentence_len: number;
  sentence_len_p90: number;
  comma_per_1k_chars: number;
  avg_word_len: number;
  dialogue_ratio: number;
  oov_5k: number;
  oov_20k: number;
  hapax_rate: number;
  lex_subscore: number;
  syn_subscore: number;
  difficulty_score: number;
  difficulty_label: DifficultyLabel;
  difficulty: DifficultyLegacy;
  estimated_cefr: Cefr;
  lookup_rate_est: LookupRate;
  lexical_score: number;
  tags: string[];
  sample_text: string;
};

type PendingResult = {
  book: BookRow;
  metrics: Omit<BookMetrics, 'difficulty_label' | 'difficulty' | 'estimated_cefr'>;
};

type DifficultyThresholds = {
  easyThreshold: number;
  hardThreshold: number;
  source: 'fixed';
};

const METADATA_VERSION = 2;
const CHECKPOINT_FILE = path.resolve(process.cwd(), '.metadata_backfill_checkpoint.json');
const WINDOW_TOKEN_SIZE = 800;
const WINDOW_PERCENTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;
const PROGRESS_LOG_EVERY = 20;
const STEP_TIMEOUT_MS = 30_000;
const EPUB_FETCH_TIMEOUT_MS = 25_000;
const EPUB_PARSE_MAX_CHARS = 2_000_000;
const FALLBACK_EASY_THRESHOLD = 0.22;
const FALLBACK_HARD_THRESHOLD = 0.4;

const frequencyCache = new Map<string, FrequencySets>();

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    concurrency: 2,
    skipProcessed: false,
    force: false,
    dryRun: false,
    report: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, rawV] = arg.replace(/^--/, '').split('=');
    const v = rawV ?? '';
    if (k === 'language') out.language = v || undefined;
    if (k === 'limit') out.limit = Number(v);
    if (k === 'concurrency') out.concurrency = Math.max(1, Number(v) || 2);
    if (k === 'skipProcessed') out.skipProcessed = true;
    if (k === 'force') out.force = true;
    if (k === 'bookId') out.bookId = v || undefined;
    if (k === 'dryRun') out.dryRun = true;
    if (k === 'fromOffset') out.fromOffset = Number(v);
    if (k === 'cursor') out.cursor = Number(v);
    if (k === 'report') out.report = true;
  }

  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(nums: number[], q: number): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function normalizeLangCode(raw: string | null | undefined): string {
  if (!raw) return 'es';
  const primary = raw.toLowerCase().split(/[-_]/)[0]?.trim();
  return primary || 'es';
}

function isCjkLanguage(lang: string): boolean {
  return lang === 'zh' || lang === 'ja' || lang === 'ko';
}

function normalizeTextGeneral(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\d_]+/g, ' ')
    .replace(/[^\p{L}\p{M}'’\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(token: string): string {
  return token
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase();
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSampleText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 2200) return clean;
  const slice = clean.slice(0, 2200);
  const lastPunct = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastPunct > 1400) return slice.slice(0, lastPunct + 1).trim();
  return `${slice.trim()}...`;
}

function tokenizeWithSpans(text: string, langRaw: string | null | undefined): TokenSpan[] {
  const lang = normalizeLangCode(langRaw);
  const spans: TokenSpan[] = [];

  if (isCjkLanguage(lang) && typeof (Intl as any).Segmenter === 'function') {
    const Seg = (Intl as any).Segmenter;
    const seg = new Seg(lang, { granularity: 'word' });
    for (const part of seg.segment(text) as Iterable<{ segment: string; index: number; isWordLike?: boolean }>) {
      if (part.isWordLike === false) continue;
      const cleaned = normalizeTextGeneral(part.segment);
      if (!cleaned) continue;
      const tok = cleaned.trim();
      if (!tok) continue;
      spans.push({
        token: tok,
        matchToken: normalizeForMatch(tok),
        start: part.index,
        end: part.index + part.segment.length,
      });
    }
    return spans;
  }

  const re = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const normalized = normalizeTextGeneral(raw);
    if (!normalized) continue;
    const token = normalized.replace(/\s+/g, '');
    if (token.length < 2) continue;
    spans.push({
      token,
      matchToken: normalizeForMatch(token),
      start: m.index,
      end: m.index + raw.length,
    });
  }
  return spans;
}

function loadWordsSet(filePath: string): Set<string> {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return new Set<string>();
  const txt = fs.readFileSync(abs, 'utf8');
  return new Set(
    txt
      .split(/\r?\n/)
      .map((s) => normalizeForMatch(s.trim()))
      .filter(Boolean)
  );
}

function buildTop20kFrom5k(top5k: Set<string>, top20kFile: Set<string>, top10kFallback: Set<string>): Set<string> {
  if (top20kFile.size > 0) return top20kFile;
  if (top10kFallback.size > 0) return top10kFallback;
  return top5k;
}

function getFrequencySetsForLanguage(langRaw: string | null | undefined): FrequencySets {
  const lang = normalizeLangCode(langRaw);
  if (frequencyCache.has(lang)) return frequencyCache.get(lang)!;

  const top5k = loadWordsSet(`data/frequency/${lang}_top_5k.txt`);
  const top20k = loadWordsSet(`data/frequency/${lang}_top_20k.txt`);
  const top10k = loadWordsSet(`data/frequency/${lang}_top_10k.txt`);
  const mergedTop20k = buildTop20kFrom5k(top5k, top20k, top10k);
  const hasExternalLists = top5k.size > 0 && mergedTop20k.size > 0;

  const sets: FrequencySets = {
    top5k,
    top20k: mergedTop20k,
    hasExternalLists,
  };
  frequencyCache.set(lang, sets);
  return sets;
}

function buildDynamicFrequencySets(tokens: TokenSpan[]): FrequencySets {
  const counts = new Map<string, number>();
  for (const tok of tokens) counts.set(tok.matchToken, (counts.get(tok.matchToken) ?? 0) + 1);
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tok]) => tok);

  const n5 = clamp(Math.floor(ranked.length * 0.05), 200, 5000);
  const n20 = clamp(Math.floor(ranked.length * 0.2), 500, 20000);

  return {
    top5k: new Set(ranked.slice(0, n5)),
    top20k: new Set(ranked.slice(0, n20)),
    hasExternalLists: false,
  };
}

function extractWindows(text: string, tokens: TokenSpan[]): Array<{ text: string; tokens: TokenSpan[] }> {
  if (tokens.length === 0) return [];

  if (tokens.length < WINDOW_TOKEN_SIZE || tokens.length < 3 * Math.floor(WINDOW_TOKEN_SIZE / 2)) {
    return [{ text, tokens }];
  }

  const half = Math.floor(WINDOW_TOKEN_SIZE / 2);
  const starts = new Set<number>();

  for (const p of WINDOW_PERCENTILES) {
    const center = Math.floor(tokens.length * p);
    const maxStart = Math.max(0, tokens.length - WINDOW_TOKEN_SIZE);
    const start = clamp(center - half, 0, maxStart);
    starts.add(start);
  }

  const windows = Array.from(starts)
    .sort((a, b) => a - b)
    .map((start) => {
      const slice = tokens.slice(start, start + WINDOW_TOKEN_SIZE);
      const startChar = slice[0]?.start ?? 0;
      const endChar = slice[slice.length - 1]?.end ?? text.length;
      return {
        tokens: slice,
        text: text.slice(startChar, endChar),
      };
    });

  return windows.length >= 3 ? windows : [{ text, tokens }];
}

function estimateDialogueRatio(windowText: string): number {
  const text = windowText || '';
  if (text.length === 0) return 0;

  let dialogueChars = 0;
  const quoteRe = /["“”«»][\s\S]{5,}?["“”«»]/g;
  let qm: RegExpExecArray | null;
  while ((qm = quoteRe.exec(text))) dialogueChars += qm[0].length;

  const lineRe = /^[\s]*[—-].+$/gm;
  let lm: RegExpExecArray | null;
  while ((lm = lineRe.exec(text))) dialogueChars += lm[0].length;

  return clamp(dialogueChars / text.length, 0, 1);
}

function sentenceTokenLengths(text: string, langRaw: string | null | undefined): number[] {
  const lang = normalizeLangCode(langRaw);
  const parts = text
    .split(/[.!?]+|[。！？]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];

  if (!isCjkLanguage(lang)) {
    return parts.map((s) => {
      const normalized = normalizeTextGeneral(s);
      if (!normalized) return 0;
      return normalized.split(/\s+/).filter((tok) => tok.length >= 2).length;
    }).filter((n) => n > 0);
  }

  return parts.map((s) => tokenizeWithSpans(s, lang).length).filter((n) => n > 0);
}

function computeWindowMetrics(
  windowText: string,
  windowTokens: TokenSpan[],
  frequencySets: FrequencySets,
  langRaw: string | null | undefined
): WindowMetrics {
  if (windowTokens.length === 0) {
    return {
      avg_sentence_len: 0,
      sentence_len_p90: 0,
      comma_per_1k_chars: 0,
      avg_word_len: 0,
      dialogue_ratio: 0,
      oov_5k: 0,
      oov_20k: 0,
      hapax_rate: 0,
    };
  }

  const activeSets = frequencySets.hasExternalLists ? frequencySets : buildDynamicFrequencySets(windowTokens);
  let oov5 = 0;
  let oov20 = 0;
  let totalWordLen = 0;

  const freqs = new Map<string, number>();
  for (const tok of windowTokens) {
    totalWordLen += tok.token.length;
    freqs.set(tok.matchToken, (freqs.get(tok.matchToken) ?? 0) + 1);
    if (!activeSets.top5k.has(tok.matchToken)) oov5 += 1;
    if (!activeSets.top20k.has(tok.matchToken)) oov20 += 1;
  }

  const sentenceLens = sentenceTokenLengths(windowText, langRaw);
  const avgSentenceLen = sentenceLens.length > 0 ? sentenceLens.reduce((a, b) => a + b, 0) / sentenceLens.length : 0;
  const sentenceP90 = sentenceLens.length > 0 ? percentile(sentenceLens, 0.9) : 0;

  const commaCount = (windowText.match(/[,،，]/g) ?? []).length;
  const commaPer1k = windowText.length > 0 ? (commaCount * 1000) / windowText.length : 0;

  const uniqueCount = freqs.size;
  let hapax = 0;
  for (const v of freqs.values()) {
    if (v === 1) hapax += 1;
  }

  return {
    avg_sentence_len: avgSentenceLen,
    sentence_len_p90: sentenceP90,
    comma_per_1k_chars: commaPer1k,
    avg_word_len: totalWordLen / windowTokens.length,
    dialogue_ratio: estimateDialogueRatio(windowText),
    oov_5k: oov5 / windowTokens.length,
    oov_20k: oov20 / windowTokens.length,
    hapax_rate: uniqueCount > 0 ? hapax / uniqueCount : 0,
  };
}

function aggregateWindowMedians(windows: WindowMetrics[]): WindowMetrics {
  const pick = (k: keyof WindowMetrics): number => median(windows.map((w) => w[k]));
  return {
    avg_sentence_len: pick('avg_sentence_len'),
    sentence_len_p90: pick('sentence_len_p90'),
    comma_per_1k_chars: pick('comma_per_1k_chars'),
    avg_word_len: pick('avg_word_len'),
    dialogue_ratio: pick('dialogue_ratio'),
    oov_5k: pick('oov_5k'),
    oov_20k: pick('oov_20k'),
    hapax_rate: pick('hapax_rate'),
  };
}

function deriveTags(book: BookRow): string[] {
  const existing = (book.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (existing.length > 0) return Array.from(new Set(existing));

  const base = [
    ...(book.subjects ?? []),
    ...(book.bookshelves ?? []),
    book.title ?? '',
    book.description ?? '',
  ].join(' ').toLowerCase();

  const tags: string[] = [];
  const rules: Array<[string, RegExp]> = [
    ['romance', /\b(romance|love|amour|amor)\b/i],
    ['mystery', /\b(mystery|detective|crime|murder)\b/i],
    ['fantasy', /\b(fantasy|dragon|magic|wizard)\b/i],
    ['history', /\b(history|historical|war|revolution)\b/i],
    ['sci-fi', /\b(science fiction|sci[- ]?fi|space|future)\b/i],
    ['classic', /\b(classic|literature|novel)\b/i],
    ['adventure', /\b(adventure|journey|voyage)\b/i],
  ];
  for (const [tag, re] of rules) {
    if (re.test(base)) tags.push(tag);
  }
  return Array.from(new Set(tags));
}

function computeScores(features: WindowMetrics): { lex: number; syn: number; final: number } {
  const lex = clamp(
    0.55 * features.oov_5k + 0.3 * features.oov_20k + 0.15 * features.hapax_rate,
    0,
    1
  );

  const syn = clamp(
    0.45 * clamp(features.avg_sentence_len / 22, 0, 1) +
      0.25 * clamp(features.sentence_len_p90 / 45, 0, 1) +
      0.15 * clamp(features.comma_per_1k_chars / 25, 0, 1) +
      0.1 * clamp(features.avg_word_len / 6.0, 0, 1) +
      0.05 * (1 - clamp(features.dialogue_ratio / 0.35, 0, 1)),
    0,
    1
  );

  const final = Math.max(lex, syn);
  return { lex, syn, final };
}

function mapLookupRate(oov20k: number): LookupRate {
  if (oov20k < 0.12) return 'Low';
  if (oov20k <= 0.22) return 'Medium';
  return 'High';
}

function mapCefr(score: number): Cefr {
  if (score < 0.12) return 'A1';
  if (score < 0.18) return 'A2';
  if (score < 0.27) return 'B1';
  if (score < 0.36) return 'B2';
  if (score < 0.48) return 'C1';
  return 'C2';
}

function applyGuardrails(baseLabel: DifficultyLabel, f: WindowMetrics): DifficultyLabel {
  let label = baseLabel;

  if (f.oov_20k > 0.3 || f.sentence_len_p90 > 60) label = 'hard';

  if ((f.avg_sentence_len > 18 && f.sentence_len_p90 > 35) || f.oov_20k > 0.2) {
    if (label === 'easy') label = 'medium';
  }

  if (f.avg_word_len > 5.9 && f.oov_20k > 0.24 && label === 'easy') {
    label = 'medium';
  }

  return label;
}

function toLegacyDifficulty(label: DifficultyLabel): DifficultyLegacy {
  if (label === 'easy') return 'Easy';
  if (label === 'medium') return 'Med';
  return 'Hard';
}

function labelFromThreshold(score: number, t: DifficultyThresholds): DifficultyLabel {
  if (score <= t.easyThreshold) return 'easy';
  if (score >= t.hardThreshold) return 'hard';
  return 'medium';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}_timeout_${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function dirnamePosix(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.slice(0, idx) : '';
}

function resolveZipPath(baseDir: string, href: string): string {
  if (!href) return '';
  if (!baseDir) return href.replace(/^\/+/, '');
  return `${baseDir}/${href}`.replace(/\/+/g, '/').replace(/^\/+/, '');
}

function extractRootfilePath(containerXml: string): string | null {
  const m = containerXml.match(/full-path\s*=\s*['"]([^'"]+)['"]/i);
  return m?.[1] ?? null;
}

function parseManifest(opf: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<item\b[^>]*\bid\s*=\s*['"]([^'"]+)['"][^>]*\bhref\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(opf))) map.set(m[1], m[2]);
  return map;
}

function parseSpineIds(opf: string): string[] {
  const ids: string[] = [];
  const re = /<itemref\b[^>]*\bidref\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(opf))) ids.push(m[1]);
  return ids;
}

async function extractTextFromEpubUrl(epubUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EPUB_FETCH_TIMEOUT_MS);
  const res = await fetch(epubUrl, { signal: controller.signal }).finally(() => clearTimeout(timeout));
  if (!res.ok) return null;

  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) return null;
  const containerXml = await containerEntry.async('string');
  const rootfilePath = extractRootfilePath(containerXml);
  if (!rootfilePath) return null;

  const opfEntry = zip.file(rootfilePath);
  if (!opfEntry) return null;
  const opf = await opfEntry.async('string');
  const manifest = parseManifest(opf);
  const spineIds = parseSpineIds(opf);
  const opfDir = dirnamePosix(rootfilePath);

  const orderedContentFiles = spineIds
    .map((id) => manifest.get(id))
    .filter((href): href is string => Boolean(href))
    .map((href) => resolveZipPath(opfDir, href));

  const fallbackContentFiles = Object.keys(zip.files).filter((name) => /\.(xhtml|html|htm)$/i.test(name));
  const candidates = orderedContentFiles.length > 0 ? orderedContentFiles : fallbackContentFiles;

  const chunks: string[] = [];
  let totalChars = 0;
  for (const filePath of candidates) {
    const file = zip.file(filePath);
    if (!file) continue;
    const html = await file.async('string');
    const text = stripHtmlToText(html);
    if (!text) continue;
    chunks.push(text);
    totalChars += text.length;
    if (totalChars >= EPUB_PARSE_MAX_CHARS) break;
  }

  return chunks.length > 0 ? chunks.join('\n\n') : null;
}

async function fetchGutendexPlainText(sourceId: string): Promise<string | null> {
  const url = `https://gutendex.com/books/${encodeURIComponent(sourceId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
  if (!res.ok) return null;

  const json = await res.json();
  const formats = (json?.formats ?? {}) as Record<string, string>;
  const candidates = Object.entries(formats).filter(([k, v]) =>
    typeof v === 'string' && (k.includes('text/plain') || k.includes('text/plain; charset=utf-8'))
  );
  const textUrl = candidates[0]?.[1];
  if (!textUrl) return null;

  const txtController = new AbortController();
  const txtTimeout = setTimeout(() => txtController.abort(), 15_000);
  const txtRes = await fetch(textUrl, { signal: txtController.signal }).finally(() => clearTimeout(txtTimeout));
  if (!txtRes.ok) return null;

  return await txtRes.text();
}

async function fetchChapterText(supabase: SupabaseClient, bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('book_chapters')
    .select('*')
    .eq('book_id', bookId)
    .limit(2000);
  if (error || !data || data.length === 0) return null;

  const chunks = data
    .map((row: any) => String(row?.content ?? row?.text ?? row?.body ?? '').trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks.join('\n\n') : null;
}

async function resolveBookText(supabase: SupabaseClient, book: BookRow): Promise<ResolvedText> {
  const direct = String((book as any).full_text ?? (book as any).content ?? '').trim();
  if (direct.length > 0) return { text: direct, source: 'full_text' };

  if (book.epub_url) {
    const epubText = await extractTextFromEpubUrl(book.epub_url);
    if (epubText && epubText.length > 0) return { text: epubText, source: 'epub_url' };
  }

  const sample = String(book.sample_text ?? '').trim();
  if (sample.length >= 800) return { text: sample, source: 'sample_text' };

  const chapters = await fetchChapterText(supabase, book.id);
  if (chapters && chapters.length > 0) return { text: chapters, source: 'book_chapters' };

  if (book.source === 'gutenberg' && book.source_id) {
    const gut = await fetchGutendexPlainText(book.source_id);
    if (gut && gut.length > 0) return { text: gut, source: 'gutendex' };
  }

  return { text: null, source: 'none' };
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) as Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

function getDefaultThresholds(): DifficultyThresholds {
  return {
    easyThreshold: FALLBACK_EASY_THRESHOLD,
    hardThreshold: FALLBACK_HARD_THRESHOLD,
    source: 'fixed',
  };
}

function computeBookMetrics(book: BookRow, text: string, langRaw: string | null | undefined): Omit<BookMetrics, 'difficulty_label' | 'difficulty' | 'estimated_cefr'> {
  const lang = normalizeLangCode(langRaw);
  const allTokens = tokenizeWithSpans(text, lang);

  const windows = extractWindows(text, allTokens);
  const baseSets = getFrequencySetsForLanguage(lang);
  const windowFeatures = windows.map((w) => computeWindowMetrics(w.text, w.tokens, baseSets, lang));
  const featureMedian = aggregateWindowMedians(windowFeatures.length > 0 ? windowFeatures : [
    {
      avg_sentence_len: 0,
      sentence_len_p90: 0,
      comma_per_1k_chars: 0,
      avg_word_len: 0,
      dialogue_ratio: 0,
      oov_5k: 0,
      oov_20k: 0,
      hapax_rate: 0,
    },
  ]);

  const { lex, syn, final } = computeScores(featureMedian);

  const uniqueCount = new Set(allTokens.map((t) => t.matchToken)).size;

  return {
    word_count: allTokens.length,
    unique_word_count: uniqueCount,
    avg_sentence_len: Number(featureMedian.avg_sentence_len.toFixed(4)),
    sentence_len_p90: Number(featureMedian.sentence_len_p90.toFixed(4)),
    comma_per_1k_chars: Number(featureMedian.comma_per_1k_chars.toFixed(4)),
    avg_word_len: Number(featureMedian.avg_word_len.toFixed(4)),
    dialogue_ratio: Number(featureMedian.dialogue_ratio.toFixed(4)),
    oov_5k: Number(featureMedian.oov_5k.toFixed(6)),
    oov_20k: Number(featureMedian.oov_20k.toFixed(6)),
    hapax_rate: Number(featureMedian.hapax_rate.toFixed(6)),
    lex_subscore: Number(lex.toFixed(6)),
    syn_subscore: Number(syn.toFixed(6)),
    difficulty_score: Number(final.toFixed(6)),
    lookup_rate_est: mapLookupRate(featureMedian.oov_20k),
    lexical_score: Number(lex.toFixed(6)),
    tags: deriveTags(book),
    sample_text: buildSampleText(text),
  };
}

function buildReportRows(rows: Array<{ title: string; metrics: BookMetrics; id: string }>): Array<Record<string, string | number>> {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    score: r.metrics.difficulty_score,
    label: r.metrics.difficulty_label,
    oov20k: r.metrics.oov_20k,
    avgSent: r.metrics.avg_sentence_len,
    p90Sent: r.metrics.sentence_len_p90,
    dialogue: r.metrics.dialogue_ratio,
    lex: r.metrics.lex_subscore,
    syn: r.metrics.syn_subscore,
  }));
}

async function printReport(supabase: SupabaseClient, pendingLabeled: Array<{ id: string; title: string; metrics: BookMetrics }>): Promise<void> {
  let rows = pendingLabeled;
  if (rows.length === 0) {
    const { data } = await supabase
      .from('books')
      .select('id,title,difficulty_score,difficulty_label,oov_20k,avg_sentence_len,sentence_len_p90,dialogue_ratio,lex_subscore,syn_subscore')
      .not('difficulty_score', 'is', null)
      .limit(4000);

    rows = (data ?? []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title ?? 'Untitled'),
      metrics: {
        word_count: 0,
        unique_word_count: 0,
        avg_sentence_len: Number(r.avg_sentence_len ?? 0),
        sentence_len_p90: Number(r.sentence_len_p90 ?? 0),
        comma_per_1k_chars: 0,
        avg_word_len: 0,
        dialogue_ratio: Number(r.dialogue_ratio ?? 0),
        oov_5k: 0,
        oov_20k: Number(r.oov_20k ?? 0),
        hapax_rate: 0,
        lex_subscore: Number(r.lex_subscore ?? 0),
        syn_subscore: Number(r.syn_subscore ?? 0),
        difficulty_score: Number(r.difficulty_score ?? 0),
        difficulty_label: (String(r.difficulty_label ?? 'medium').toLowerCase() as DifficultyLabel),
        difficulty: 'Med',
        estimated_cefr: 'B1',
        lookup_rate_est: 'Medium',
        lexical_score: 0,
        tags: [],
        sample_text: '',
      },
    }));
  }

  const sorted = [...rows].sort((a, b) => a.metrics.difficulty_score - b.metrics.difficulty_score);
  const easiest = sorted.slice(0, 10);
  const hardest = sorted.slice(-10).reverse();

  // eslint-disable-next-line no-console
  console.log('[metadata] report easiest_top10', buildReportRows(easiest));
  // eslint-disable-next-line no-console
  console.log('[metadata] report hardest_top10', buildReportRows(hardest));

  const crimen = rows.find((r) => /crimen y castigo|crime and punishment/i.test(r.title));
  if (crimen) {
    // eslint-disable-next-line no-console
    console.log('[metadata] sanity_check_crimen_y_castigo', {
      title: crimen.title,
      label: crimen.metrics.difficulty_label,
      score: crimen.metrics.difficulty_score,
      ok: crimen.metrics.difficulty_label !== 'easy',
    });
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (args.report && !args.force && !args.bookId) {
    await printReport(supabase, []);
    return;
  }

  const existingCheckpoint = loadCheckpoint();
  const hasExplicitOffset = typeof args.fromOffset === 'number' || typeof args.cursor === 'number';
  const defaultOffset = args.force && !hasExplicitOffset ? 0 : (existingCheckpoint?.offset ?? 0);
  let offset = args.fromOffset ?? args.cursor ?? defaultOffset;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let inFlight = 0;
  let lastBookCompletedAt = Date.now();

  const batchSize = Math.min(args.limit ?? 200, 200);
  let remaining = args.limit ?? Number.MAX_SAFE_INTEGER;
  const pending: PendingResult[] = [];

  // eslint-disable-next-line no-console
  console.log('[metadata] start', { ...args, offset, metadataVersion: METADATA_VERSION });

  const heartbeat = setInterval(() => {
    const staleSec = Math.round((Date.now() - lastBookCompletedAt) / 1000);
    // eslint-disable-next-line no-console
    console.log('[metadata] heartbeat', { processed, succeeded, failed, skipped, inFlight, pending: pending.length, lastCompletionSecAgo: staleSec });
  }, 15_000);

  try {
    if (args.bookId) {
      const { data, error } = await supabase.from('books').select('*').eq('id', args.bookId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Book not found: ${args.bookId}`);
      await processBatch([data as BookRow]);
    } else {
      while (remaining > 0) {
        const pageLimit = Math.min(batchSize, remaining);
        const fetchStartedAt = Date.now();
        // eslint-disable-next-line no-console
        console.log('[metadata] batch_fetch_start', { offset, pageLimit });

        let query = supabase
          .from('books')
          .select('*')
          .order('id', { ascending: true })
          .range(offset, offset + pageLimit - 1);
        if (args.language) {
          query = query.or(`language.eq.${args.language},source_lang.eq.${args.language}`);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data ?? []) as BookRow[];
        // eslint-disable-next-line no-console
        console.log('[metadata] batch_fetch_done', { offset, rows: rows.length, ms: Date.now() - fetchStartedAt });
        if (rows.length === 0) break;

        await processBatch(rows);
        offset += rows.length;
        remaining -= rows.length;

        saveCheckpoint({ offset, processed, succeeded, failed, skipped, updatedAt: new Date().toISOString() });
      }
    }
  } finally {
    clearInterval(heartbeat);
  }

  const thresholds = getDefaultThresholds();
  // eslint-disable-next-line no-console
  console.log('[metadata] thresholds', thresholds);

  const labeled: Array<{ id: string; title: string; metrics: BookMetrics }> = pending.map((p) => {
    const base = labelFromThreshold(p.metrics.difficulty_score, thresholds);
    const guarded = applyGuardrails(base, p.metrics);
    const cefr = mapCefr(p.metrics.difficulty_score);

    return {
      id: p.book.id,
      title: p.book.title ?? 'Untitled',
      metrics: {
        ...p.metrics,
        difficulty_label: guarded,
        difficulty: toLegacyDifficulty(guarded),
        estimated_cefr: cefr,
      },
    };
  });

  if (args.report || args.dryRun) {
    await printReport(supabase, labeled);
  }

  if (!args.dryRun) {
    let updateCount = 0;
    for (const item of labeled) {
      const p = pending.find((x) => x.book.id === item.id)!;
      const payload = {
        word_count: item.metrics.word_count,
        unique_word_count: item.metrics.unique_word_count,
        avg_sentence_len: item.metrics.avg_sentence_len,
        sentence_len_p90: item.metrics.sentence_len_p90,
        comma_per_1k_chars: item.metrics.comma_per_1k_chars,
        avg_word_len: item.metrics.avg_word_len,
        dialogue_ratio: item.metrics.dialogue_ratio,
        oov_5k: item.metrics.oov_5k,
        oov_20k: item.metrics.oov_20k,
        hapax_rate: item.metrics.hapax_rate,
        lex_subscore: item.metrics.lex_subscore,
        syn_subscore: item.metrics.syn_subscore,
        difficulty_score: item.metrics.difficulty_score,
        difficulty_label: item.metrics.difficulty_label,
        lexical_score: item.metrics.lexical_score,
        difficulty: item.metrics.difficulty,
        estimated_cefr: item.metrics.estimated_cefr,
        lookup_rate_est: item.metrics.lookup_rate_est,
        tags: item.metrics.tags,
        sample_text: item.metrics.sample_text,
        language: p.book.language ?? p.book.source_lang,
        processed_at: new Date().toISOString(),
        metadata_version: METADATA_VERSION,
      };

      const { error } = await supabase.from('books').update(payload).eq('id', item.id);
      if (error) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error('[metadata] db_update_failed', { id: item.id, error: String(error.message ?? error) });
      } else {
        updateCount += 1;
        succeeded += 1;
      }

      if (updateCount % PROGRESS_LOG_EVERY === 0) {
        // eslint-disable-next-line no-console
        console.log('[metadata] db_update_progress', { updateCount, total: labeled.length });
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('[metadata] done', {
    processed,
    computed: pending.length,
    succeeded,
    failed,
    skipped,
    offset,
    dryRun: args.dryRun,
  });

  async function processBatch(rows: BookRow[]): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: args.concurrency }).map(async () => {
      while (index < rows.length) {
        const current = rows[index++];
        await processOne(current);
      }
    });
    await Promise.all(workers);
  }

  async function processOne(book: BookRow): Promise<void> {
    inFlight += 1;
    processed += 1;
    const lang = normalizeLangCode(book.language ?? book.source_lang ?? args.language);

    // eslint-disable-next-line no-console
    console.log('[metadata] processing', { n: processed, id: book.id, lang, title: book.title ?? 'Untitled' });

    const alreadyProcessed = !!book.processed_at && (book.metadata_version ?? 1) === METADATA_VERSION;
    if (!args.force && args.skipProcessed && alreadyProcessed) {
      skipped += 1;
      // eslint-disable-next-line no-console
      console.log('[metadata] skipped', { id: book.id, reason: 'already_processed' });
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[metadata] step', { id: book.id, step: 'resolve_text_start' });
      const t0 = Date.now();
      const resolved = await withTimeout(resolveBookText(supabase, book), STEP_TIMEOUT_MS, 'resolve_text');
      const text = resolved.text;
      // eslint-disable-next-line no-console
      console.log('[metadata] step', {
        id: book.id,
        step: 'resolve_text_done',
        source: resolved.source,
        chars: text?.length ?? 0,
        ms: Date.now() - t0,
      });

      if (!text || text.trim().length < 300) {
        skipped += 1;
        // eslint-disable-next-line no-console
        console.log('[metadata] skipped', { id: book.id, reason: `missing_text_${resolved.source}` });
        return;
      }

      const t1 = Date.now();
      const metrics = computeBookMetrics(book, text, lang);
      // eslint-disable-next-line no-console
      console.log('[metadata] step', {
        id: book.id,
        step: 'compute_done',
        ms: Date.now() - t1,
        score: metrics.difficulty_score,
        lex: metrics.lex_subscore,
        syn: metrics.syn_subscore,
      });

      pending.push({ book, metrics });
      if (processed % PROGRESS_LOG_EVERY === 0) {
        // eslint-disable-next-line no-console
        console.log('[metadata] progress', { processed, pending: pending.length, failed, skipped });
      }
    } catch (error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error('[metadata] failed', {
        id: book.id,
        title: book.title,
        error: String((error as Error)?.message ?? error),
      });
    } finally {
      inFlight = Math.max(0, inFlight - 1);
      lastBookCompletedAt = Date.now();
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
