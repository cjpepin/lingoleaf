export type PremiumPlan = 'monthly' | 'yearly' | 'lifetime';

export interface PremiumStatus {
  is_premium: boolean;
  premium_plan: PremiumPlan | null;
}

export interface RevenueCatWebhookEvent {
  app_user_id?: string | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  type?: string | null;
}

export interface RevenueCatWebhookPayload {
  event?: RevenueCatWebhookEvent | null;
}

export interface RevenueCatSubscriberEntitlement {
  product_identifier?: string | null;
  expires_date?: string | null;
}

export interface RevenueCatSubscriberSubscription {
  expires_date?: string | null;
}

export interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatSubscriberEntitlement> | null;
    subscriptions?: Record<string, RevenueCatSubscriberSubscription> | null;
    non_subscriptions?: Record<string, Array<Record<string, unknown>>> | null;
  } | null;
}

export interface RevenueCatEntitlementConfig {
  monthlySku: string;
  yearlySku: string;
  lifetimeSku: string;
}

function readEnv(name: string): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  if (!denoEnv?.get) return '';
  return denoEnv.get(name) || '';
}

function hasActiveDate(expiresDate: string | null | undefined, nowMs: number): boolean {
  if (!expiresDate) return true;
  const expiresAt = Date.parse(expiresDate);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt > nowMs;
}

export function getDefaultRevenueCatEntitlementConfig(): RevenueCatEntitlementConfig {
  return {
    monthlySku: readEnv('PREMIUM_SKU_MONTHLY')
      || readEnv('EXPO_PUBLIC_PREMIUM_SKU_MONTHLY')
      || 'monthly',
    yearlySku: readEnv('PREMIUM_SKU_YEARLY')
      || readEnv('EXPO_PUBLIC_PREMIUM_SKU_YEARLY')
      || 'yearly',
    lifetimeSku: readEnv('PREMIUM_SKU_LIFETIME')
      || readEnv('EXPO_PUBLIC_PREMIUM_SKU_LIFETIME')
      || 'lifetime_2',
  };
}

export function getWebhookAuthorizationHeader(): string {
  return readEnv('REVENUECAT_WEBHOOK_AUTH_HEADER');
}

export function isRevenueCatWebhookAuthorized(
  authorizationHeader: string | null,
  expectedHeader: string
): boolean {
  if (!expectedHeader) return false;
  return authorizationHeader === expectedHeader;
}

export function parseRevenueCatWebhookAppUserIds(
  payload: RevenueCatWebhookPayload
): string[] {
  const event = payload?.event;
  if (!event) {
    throw new Error('Missing RevenueCat event payload');
  }

  const appUserIds = new Set<string>();
  if (typeof event.app_user_id === 'string' && event.app_user_id.trim().length > 0) {
    appUserIds.add(event.app_user_id.trim());
  }

  const transferredFrom = Array.isArray(event.transferred_from) ? event.transferred_from : [];
  const transferredTo = Array.isArray(event.transferred_to) ? event.transferred_to : [];
  for (const appUserId of [...transferredFrom, ...transferredTo]) {
    if (typeof appUserId === 'string' && appUserId.trim().length > 0) {
      appUserIds.add(appUserId.trim());
    }
  }

  if (appUserIds.size === 0) {
    throw new Error('RevenueCat event missing app_user_id');
  }

  return [...appUserIds];
}

export function mapRevenueCatSubscriberToPremiumStatus(
  response: RevenueCatSubscriberResponse,
  config: RevenueCatEntitlementConfig,
  now = new Date()
): PremiumStatus {
  const subscriber = response?.subscriber;
  if (!subscriber) {
    throw new Error('RevenueCat subscriber payload missing subscriber');
  }

  const nowMs = now.getTime();
  const activeProductIds = new Set<string>();

  const subscriptions = subscriber.subscriptions ?? {};
  for (const [productId, subscription] of Object.entries(subscriptions)) {
    if (hasActiveDate(subscription?.expires_date, nowMs)) {
      activeProductIds.add(productId);
    }
  }

  const entitlements = subscriber.entitlements ?? {};
  let hasActiveEntitlement = false;
  for (const entitlement of Object.values(entitlements)) {
    if (!hasActiveDate(entitlement?.expires_date, nowMs)) continue;
    hasActiveEntitlement = true;
    if (typeof entitlement?.product_identifier === 'string' && entitlement.product_identifier.length > 0) {
      activeProductIds.add(entitlement.product_identifier);
    }
  }

  const nonSubscriptions = subscriber.non_subscriptions ?? {};
  const hasLifetimePurchase = Array.isArray(nonSubscriptions[config.lifetimeSku])
    && nonSubscriptions[config.lifetimeSku].length > 0;

  if (activeProductIds.has(config.lifetimeSku) || hasLifetimePurchase) {
    return {
      is_premium: true,
      premium_plan: 'lifetime',
    };
  }

  if (activeProductIds.has(config.yearlySku)) {
    return {
      is_premium: true,
      premium_plan: 'yearly',
    };
  }

  if (activeProductIds.has(config.monthlySku)) {
    return {
      is_premium: true,
      premium_plan: 'monthly',
    };
  }

  if (hasActiveEntitlement) {
    return {
      is_premium: true,
      premium_plan: null,
    };
  }

  return {
    is_premium: false,
    premium_plan: null,
  };
}
