/**
 * Premium config and product identifiers.
 */

export type PremiumPlan = 'monthly' | 'yearly' | 'lifetime';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function allowDevFallback(): boolean {
  if (typeof __DEV__ === 'boolean') return __DEV__;
  return process.env.NODE_ENV !== 'production';
}

function readPremiumSku(name: string, fallback: string): string {
  const value = readEnv(name);
  if (value) return value;
  return allowDevFallback() ? fallback : '';
}

export const PREMIUM_PRODUCT_IDS: Record<PremiumPlan, string> = {
  monthly: readPremiumSku('EXPO_PUBLIC_PREMIUM_SKU_MONTHLY', 'monthly'),
  yearly: readPremiumSku('EXPO_PUBLIC_PREMIUM_SKU_YEARLY', 'yearly'),
  lifetime: readPremiumSku('EXPO_PUBLIC_PREMIUM_SKU_LIFETIME', 'lifetime_2'),
};

export const REVENUECAT_IOS_API_KEY = readEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');

export function getPremiumSku(plan: PremiumPlan): string {
  return PREMIUM_PRODUCT_IDS[plan];
}
