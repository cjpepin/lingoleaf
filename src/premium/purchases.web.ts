/**
 * Purchase bridge (web)
 * IAP is unavailable in the browser demo build.
 */

import type { PremiumPlan } from './config';

export interface PurchaseResult {
  ok: boolean;
  isPremium: boolean;
  premiumPlan?: PremiumPlan | null;
  errorCode?: string;
}

const unavailable: PurchaseResult = {
  ok: false,
  isPremium: false,
  errorCode: 'iap_not_configured',
};

export async function syncRevenueCatIdentity(_appUserId: string | null): Promise<boolean> {
  return false;
}

export async function startPremiumPurchase(
  _plan: PremiumPlan,
  _appUserId: string | null = null
): Promise<PurchaseResult> {
  return unavailable;
}

export async function restorePremiumPurchases(_appUserId: string | null = null): Promise<PurchaseResult> {
  return unavailable;
}

export async function fetchCurrentPremiumStatus(
  _appUserId: string | null = null,
  _options: { forceRefresh?: boolean } = {}
): Promise<PurchaseResult> {
  return unavailable;
}

export async function subscribeToPremiumStatusUpdates(
  _appUserId: string | null,
  _onUpdate: (result: PurchaseResult) => void
): Promise<(() => void) | null> {
  return null;
}
