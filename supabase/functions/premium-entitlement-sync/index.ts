/**
 * Premium Entitlement Sync Edge Function
 *
 * - Receives RevenueCat webhooks and persists authoritative premium status
 * - Allows authenticated users to trigger a server-side entitlement refresh
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  getDefaultRevenueCatEntitlementConfig,
  getWebhookAuthorizationHeader,
  isRevenueCatWebhookAuthorized,
  mapRevenueCatSubscriberToPremiumStatus,
  parseRevenueCatWebhookAppUserIds,
  type PremiumStatus,
  type RevenueCatSubscriberResponse,
  type RevenueCatWebhookPayload,
} from '../_shared/revenuecatEntitlement.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY');
const REVENUECAT_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_API_KEY') || '';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
}

async function fetchRevenueCatSubscriber(appUserId: string): Promise<RevenueCatSubscriberResponse> {
  if (!REVENUECAT_SECRET_API_KEY) {
    throw new Error('RevenueCat secret API key is not configured');
  }

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RevenueCat subscriber fetch failed: ${response.status} ${errorText}`);
  }

  return await response.json() as RevenueCatSubscriberResponse;
}

async function persistPremiumStatus(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  status: PremiumStatus
): Promise<PremiumStatus> {
  const { data, error } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: userId,
      is_premium: status.is_premium,
      premium_plan: status.premium_plan,
      premium_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('is_premium,premium_plan')
    .single();

  if (error) throw error;

  return {
    is_premium: data.is_premium === true,
    premium_plan: data.premium_plan ?? null,
  };
}

async function syncUserPremiumStatus(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<PremiumStatus> {
  const subscriber = await fetchRevenueCatSubscriber(userId);
  const status = mapRevenueCatSubscriberToPremiumStatus(
    subscriber,
    getDefaultRevenueCatEntitlementConfig()
  );
  return await persistPremiumStatus(supabaseAdmin, userId, status);
}

async function handleWebhook(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!isRevenueCatWebhookAuthorized(authHeader, getWebhookAuthorizationHeader())) {
    return json(401, { error: 'Unauthorized RevenueCat webhook' });
  }

  const payload = await req.json() as RevenueCatWebhookPayload;
  const appUserIds = parseRevenueCatWebhookAppUserIds(payload);
  const supabaseAdmin = getSupabaseAdmin();

  for (const appUserId of appUserIds) {
    await syncUserPremiumStatus(supabaseAdmin, appUserId);
  }

  return json(200, { ok: true, updated_users: appUserIds.length });
}

async function handleAuthenticatedSync(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return json(401, { error: 'Missing Authorization header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user?.id) {
    return json(401, { error: 'Invalid or expired session' });
  }

  const status = await syncUserPremiumStatus(supabaseAdmin, userData.user.id);
  return json(200, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const isWebhook = isRevenueCatWebhookAuthorized(authHeader, getWebhookAuthorizationHeader());
    if (isWebhook) {
      return await handleWebhook(req);
    }
    return await handleAuthenticatedSync(req);
  } catch (error) {
    return json(500, { error: String((error as Error)?.message ?? error) });
  }
});
