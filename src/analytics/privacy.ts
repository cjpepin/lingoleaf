/**
 * analytics/privacy
 *
 * Centralized redaction/sanitization helpers to keep event payloads privacy-safe.
 */

const DISALLOWED_KEY_PATTERNS = [
  /email/i,
  /token/i,
  /password/i,
  /raw_text/i,
  /selected_text/i,
  /chapter_text/i,
  /book_content/i,
  /content/i,
  /context/i,
  /selection/i,
];

const ROUTE_PARAM_BLOCKLIST = [/path/i, /url/i, /token/i, /email/i];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldDropKey(key: string): boolean {
  return DISALLOWED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function shouldDropRouteKey(key: string): boolean {
  return ROUTE_PARAM_BLOCKLIST.some((pattern) => pattern.test(key));
}

export function hashIdentifier(value: string): string {
  // FNV-1a 32-bit hash (stable, lightweight, non-reversible enough for analytics IDs).
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `h_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function sanitizeProperties(value: unknown, depth: number = 0): unknown {
  if (depth > 6) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProperties(item, depth + 1)).filter((item) => item !== undefined);
  }

  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, v]) => {
      if (shouldDropKey(key)) return;
      const sanitized = sanitizeProperties(v, depth + 1);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    });
    return out;
  }

  if (typeof value === 'string') {
    // Keep short metadata strings only.
    return value.length > 120 ? value.slice(0, 120) : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value;
  }

  return undefined;
}

export function redactRouteParams(params: unknown): Record<string, unknown> {
  if (!isObject(params)) return {};

  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (shouldDropRouteKey(key)) return;

    if (typeof value === 'string') {
      if (/_id$/i.test(key) || key === 'bookId' || key === 'listId') {
        out[`${key}_hash`] = hashIdentifier(value);
      } else {
        out[`${key}_length`] = value.length;
      }
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      return;
    }

    if (Array.isArray(value)) {
      out[`${key}_count`] = value.length;
    }
  });

  return out;
}
