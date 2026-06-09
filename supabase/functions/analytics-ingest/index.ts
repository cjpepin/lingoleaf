/**
 * analytics-ingest
 *
 * JWT-validated analytics ingest + admin analytics endpoints.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type PostgrestError } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_PUBLIC_KEY');

const MAX_BATCH = 100;
const MAX_EVENT_NAME_LENGTH = 120;
const MAX_STRING_FIELD_LENGTH = 200;

const DISALLOWED_KEY_PATTERNS = [
  /email/i,
  /token/i,
  /password/i,
  /raw_text/i,
  /selected_text/i,
  /chapter_text/i,
  /book_content/i,
  /context/i,
  /selection/i,
];

interface IncomingEvent {
  event_name?: unknown;
  event_version?: unknown;
  properties?: unknown;
  session_id?: unknown;
  device_id?: unknown;
  install_id?: unknown;
  app_version?: unknown;
  platform?: unknown;
  locale?: unknown;
}

interface SanitizedEvent {
  event_name: string;
  event_version: number;
  properties: Record<string, unknown>;
  session_id: string | null;
  device_id: string | null;
  install_id: string | null;
  app_version: string | null;
  platform: string | null;
  locale: string | null;
}

interface AdminRequestBody {
  from?: string;
  to?: string;
  limit?: number;
}

function responseHeaders(noStore: boolean = false): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...(noStore ? { 'Cache-Control': 'no-store' } : {}),
  };
}

function json(status: number, body: unknown, noStore: boolean = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(noStore),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDisallowedKey(key: string): boolean {
  return DISALLOWED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, depth + 1)).filter((v) => v !== undefined);
  }

  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (isDisallowedKey(key)) continue;
      const sanitized = sanitizeValue(v, depth + 1);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_FIELD_LENGTH ? value.slice(0, MAX_STRING_FIELD_LENGTH) : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }

  return undefined;
}

function sanitizeString(value: unknown, maxLength: number = MAX_STRING_FIELD_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function parseEventVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  return 1;
}

function normalizeEvent(event: unknown): SanitizedEvent | null {
  if (!isRecord(event)) return null;

  const input = event as IncomingEvent;
  const eventName = sanitizeString(input.event_name, MAX_EVENT_NAME_LENGTH);
  if (!eventName) return null;

  const properties = sanitizeValue(isRecord(input.properties) ? input.properties : {}, 0);

  return {
    event_name: eventName,
    event_version: parseEventVersion(input.event_version),
    properties: isRecord(properties) ? properties : {},
    session_id: sanitizeString(input.session_id),
    device_id: sanitizeString(input.device_id),
    install_id: sanitizeString(input.install_id),
    app_version: sanitizeString(input.app_version),
    platform: sanitizeString(input.platform),
    locale: sanitizeString(input.locale),
  };
}

function parseBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return match[1].trim() || null;
}

async function verifyJwt(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  return resp.ok;
}

function routeForRequest(req: Request): 'ingest' | 'dashboard' {
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith('/dashboard')) return 'dashboard';
  return 'ingest';
}

function isUnauthorizedRpcError(error: PostgrestError | null): boolean {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return error.code === '42501'
    || text.includes('only forum admins')
    || text.includes('only authenticated users')
    || text.includes('permission denied')
    || text.includes('not authorized');
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders() });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, { error: 'Missing Supabase anon configuration' });
  }

  const route = routeForRequest(req);
  const token = parseBearerToken(req);

  // Ingest supports both anonymous and authenticated callers.
  // Dashboard requires a valid authenticated JWT.
  if (route === 'dashboard' && !token) {
    return json(401, { error: 'Missing bearer token' }, true);
  }

  let verifiedToken: string | null = null;
  if (token) {
    const isValidToken = await verifyJwt(token);
    if (!isValidToken) {
      if (route === 'dashboard') {
        return json(401, { error: 'Invalid or expired token' }, true);
      }
    } else {
      verifiedToken = token;
    }
  }

  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, verifiedToken
    ? {
      global: {
        headers: {
          Authorization: `Bearer ${verifiedToken}`,
        },
      },
    }
    : undefined);

  if (route === 'dashboard') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return json(405, { error: 'Method not allowed' }, true);
    }

    let body: AdminRequestBody = {};
    if (req.method === 'POST') {
      try {
        body = (await req.json()) as AdminRequestBody;
      } catch {
        return json(400, { error: 'Invalid JSON body' }, true);
      }
    } else {
      const url = new URL(req.url);
      const limitRaw = url.searchParams.get('limit');
      body = {
        from: url.searchParams.get('from') ?? undefined,
        to: url.searchParams.get('to') ?? undefined,
        limit: limitRaw ? Number.parseInt(limitRaw, 10) : undefined,
      };
    }

    const from = parseIsoTimestamp(body.from);
    const to = parseIsoTimestamp(body.to);

    const limit = typeof body.limit === 'number' && Number.isInteger(body.limit)
      ? Math.min(Math.max(body.limit, 1), 200)
      : 50;

    const { data: dashboard, error: dashboardError } = await caller.rpc('analytics_admin_dashboard', {
      p_from: from ?? null,
      p_to: to ?? null,
    });

    if (dashboardError) {
      if (isUnauthorizedRpcError(dashboardError)) {
        return json(403, { error: 'Forbidden' }, true);
      }
      return json(500, { error: 'Failed to load analytics dashboard' }, true);
    }

    const { data: recent, error: recentError } = await caller.rpc('analytics_admin_recent_events', {
      p_limit: limit,
      p_from: from ?? null,
      p_to: to ?? null,
    });

    if (recentError) {
      if (isUnauthorizedRpcError(recentError)) {
        return json(403, { error: 'Forbidden' }, true);
      }
      return json(500, { error: 'Failed to load recent analytics events' }, true);
    }

    return json(200, {
      dashboard: dashboard ?? {},
      recent_events: Array.isArray(recent) ? recent : [],
    }, true);
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body: { events?: unknown };
  try {
    body = (await req.json()) as { events?: unknown };
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!Array.isArray(body.events)) {
    return json(400, { error: 'events must be an array' });
  }

  if (body.events.length === 0) {
    return json(400, { error: 'events must be a non-empty array' });
  }

  if (body.events.length > MAX_BATCH) {
    return json(413, { error: `events exceeds max batch size of ${MAX_BATCH}` });
  }

  const sanitized = body.events
    .map((evt) => normalizeEvent(evt))
    .filter((evt): evt is SanitizedEvent => evt !== null);

  if (sanitized.length === 0) {
    return json(400, { error: 'No valid events in batch' });
  }

  const { data, error } = await caller.rpc('analytics_ingest_batch', {
    p_events: sanitized,
  });

  if (error) {
    if (isUnauthorizedRpcError(error)) {
      return json(403, { error: 'Forbidden' });
    }
    return json(500, { error: 'Failed to insert analytics events' });
  }

  const inserted = typeof data === 'number' ? data : 0;
  return json(200, { inserted });
});
