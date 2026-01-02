/**
 * epubCover
 *
 * Extract and cache an EPUB's embedded cover image for fast library display.
 * Best-effort: if cover isn't found or EPUB isn't cached, returns null.
 */

import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { logger } from '@/utils/logger';

const BOOKS_DIR = `${FileSystem.cacheDirectory}books/`;
const COVERS_DIR = `${FileSystem.cacheDirectory}book-covers/`;
const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;

type CoverExt = (typeof COVER_EXTS)[number];

function getCachedEpubUri(bookId: string): string {
  return `${BOOKS_DIR}${bookId}.epub`;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx + 1) : '';
}

function resolveZipPath(baseDir: string, href: string): string {
  const baseParts = stripLeadingSlash(baseDir).split('/').filter(Boolean);
  const hrefParts = stripLeadingSlash(href).split('/').filter(Boolean);

  const parts: string[] = [...baseParts];
  for (const p of hrefParts) {
    if (p === '.') continue;
    if (p === '..') {
      parts.pop();
      continue;
    }
    parts.push(p);
  }

  return parts.join('/');
}

function inferExt(href: string, mediaType: string | null): CoverExt | null {
  const lowerHref = href.toLowerCase();
  for (const ext of COVER_EXTS) {
    if (lowerHref.endsWith(`.${ext}`)) return ext;
  }
  if (!mediaType) return null;
  const lowerType = mediaType.toLowerCase();
  if (lowerType.includes('jpeg') || lowerType.includes('jpg')) return 'jpg';
  if (lowerType.includes('png')) return 'png';
  if (lowerType.includes('webp')) return 'webp';
  return null;
}

async function ensureDir(dirUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (info.exists) return;
  await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
}

async function getExistingCoverUri(bookId: string): Promise<string | null> {
  for (const ext of COVER_EXTS) {
    const uri = `${COVERS_DIR}${bookId}.${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && (info.size ?? 0) > 0) return uri;
  }
  return null;
}

function pickRootfilePath(containerXml: string): string | null {
  const m = containerXml.match(/full-path="([^"]+)"/i);
  return m?.[1] ?? null;
}

function pickCoverHref(opfXml: string): { href: string; mediaType: string | null } | null {
  // EPUB 3: properties="cover-image"
  const propMatch = opfXml.match(
    /<item\b[^>]*properties="[^"]*\bcover-image\b[^"]*"[^>]*href="([^"]+)"[^>]*?(?:media-type="([^"]+)")?[^>]*>/i
  );
  if (propMatch) {
    return { href: propMatch[1], mediaType: propMatch[2] ?? null };
  }

  // EPUB 2: <meta name="cover" content="coverId" />
  const coverIdMatch = opfXml.match(/<meta\b[^>]*name="cover"[^>]*content="([^"]+)"[^>]*\/?>/i);
  const coverId = coverIdMatch?.[1];
  if (!coverId) return null;

  const itemRegex = new RegExp(
    `<item\\b[^>]*id="${coverId}"[^>]*href="([^"]+)"[^>]*?(?:media-type="([^"]+)")?[^>]*>`,
    'i'
  );
  const itemMatch = opfXml.match(itemRegex);
  if (!itemMatch) return null;
  return { href: itemMatch[1], mediaType: itemMatch[2] ?? null };
}

async function extractCoverFromEpubUri(epubUri: string): Promise<{ base64: string; ext: CoverExt } | null> {
  const epubInfo = await FileSystem.getInfoAsync(epubUri);
  if (!epubInfo.exists) return null;

  const base64Zip = await FileSystem.readAsStringAsync(epubUri, { encoding: FileSystem.EncodingType.Base64 });
  const zip = await JSZip.loadAsync(base64Zip, { base64: true });

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) return null;

  const containerXml = await containerFile.async('string');
  const rootfilePath = pickRootfilePath(containerXml);
  if (!rootfilePath) return null;

  const opfFile = zip.file(rootfilePath);
  if (!opfFile) return null;

  const opfXml = await opfFile.async('string');
  const cover = pickCoverHref(opfXml);
  if (!cover) return null;

  const baseDir = dirname(rootfilePath);
  const coverZipPath = resolveZipPath(baseDir, cover.href);
  const coverFile = zip.file(coverZipPath);
  if (!coverFile) return null;

  const ext = inferExt(cover.href, cover.mediaType) ?? 'jpg';
  const coverBase64 = await coverFile.async('base64');
  if (!coverBase64) return null;

  return { base64: coverBase64, ext };
}

/**
 * Extract a cover from any local EPUB `file://` URI.
 * Returns base64 image data (no prefix) + inferred extension.
 */
export async function extractEpubCover(epubUri: string): Promise<{ base64: string; ext: CoverExt } | null> {
  try {
    return await extractCoverFromEpubUri(epubUri);
  } catch (error) {
    logger.warn('Failed to extract epub cover', { epubUri, error });
    return null;
  }
}

/**
 * Returns a local `file://` URI to a cached cover image if available.
 *
 * - If the cover is already cached, returns it.
 * - If the EPUB is cached, extracts the embedded cover and caches it.
 * - If the EPUB isn't cached or no cover can be found, returns null.
 */
export async function ensureBookCoverFromCache(bookId: string): Promise<string | null> {
  try {
    const existing = await getExistingCoverUri(bookId);
    if (existing) return existing;

    const epubUri = getCachedEpubUri(bookId);
    const extracted = await extractCoverFromEpubUri(epubUri);
    if (!extracted) return null;

    await ensureDir(COVERS_DIR);

    const coverUri = `${COVERS_DIR}${bookId}.${extracted.ext}`;
    await FileSystem.writeAsStringAsync(coverUri, extracted.base64, { encoding: FileSystem.EncodingType.Base64 });

    const verify = await FileSystem.getInfoAsync(coverUri);
    if (!verify.exists || !('size' in verify) || (verify.size ?? 0) === 0) {
      return null;
    }

    return coverUri;
  } catch (error) {
    logger.warn('Failed to ensure book cover', { bookId, error });
    return null;
  }
}


