/**
 * Lightweight iOS purchase bridge with safe fallback when RevenueCat native module
 * is not configured in the current build.
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PRODUCT_CATEGORY, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';
import { logger } from '@/utils/logger';
import { REVENUECAT_IOS_API_KEY, getPremiumSku, type PremiumPlan } from './config';

export interface PurchaseResult {
  ok: boolean;
  isPremium: boolean;
  premiumPlan?: PremiumPlan | null;
  errorCode?: string;
}

interface FetchCurrentPremiumStatusOptions {
  forceRefresh?: boolean;
}

let configured = false;
let configuredAppUserId: string | null = null;

async function configureRevenueCatIfNeeded(appUserId: string | null = null): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (!REVENUECAT_IOS_API_KEY) return false;

  if (configured) return true;

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({
      apiKey: REVENUECAT_IOS_API_KEY,
      appUserID: appUserId ?? undefined,
    });
    configured = true;
    configuredAppUserId = appUserId ?? null;
    return true;
  } catch (error) {
    logger.warn('RevenueCat configure failed', error);
    return false;
  }
}

export async function syncRevenueCatIdentity(appUserId: string | null): Promise<boolean> {
  const moduleReady = await configureRevenueCatIfNeeded(appUserId);
  if (!moduleReady) return false;

  let sdkAppUserId: string | null = configuredAppUserId;
  try {
    const liveAppUserId = await Purchases.getAppUserID();
    sdkAppUserId = typeof liveAppUserId === 'string' && liveAppUserId.length > 0 ? liveAppUserId : null;
  } catch (error) {
    logger.warn('RevenueCat getAppUserID failed', error);
  }

  if (appUserId && sdkAppUserId !== appUserId) {
    try {
      await Purchases.logIn(appUserId);
      configuredAppUserId = appUserId;
    } catch (error) {
      logger.warn('RevenueCat logIn failed', error);
      return false;
    }
  }

  if (!appUserId && sdkAppUserId) {
    try {
      const isAnonymous = await Purchases.isAnonymous();
      if (isAnonymous) {
        configuredAppUserId = null;
        return true;
      }
    } catch (error) {
      logger.warn('RevenueCat isAnonymous check failed', error);
    }

    try {
      await Purchases.logOut();
      configuredAppUserId = null;
    } catch (error) {
      const message = String((error as any)?.message ?? '').toLowerCase();
      if (message.includes('anonymous')) {
        configuredAppUserId = null;
        return true;
      }
      logger.warn('RevenueCat logOut failed', error);
      return false;
    }
  }

  configuredAppUserId = appUserId ?? null;
  return true;
}

function inferPremiumFromCustomerInfo(info: CustomerInfo): boolean {
  if (Object.keys(info.entitlements.active).length > 0) return true;
  if (Array.isArray(info.activeSubscriptions) && info.activeSubscriptions.length > 0) return true;
  return false;
}

function inferPremiumPlanFromCustomerInfo(info: CustomerInfo): PremiumPlan | null {
  const activeSkus = new Set<string>([
    ...(Array.isArray(info.activeSubscriptions) ? info.activeSubscriptions : []),
    ...(Array.isArray(info.allPurchasedProductIdentifiers) ? info.allPurchasedProductIdentifiers : []),
  ]);

  const lifetimeSku = getPremiumSku('lifetime');
  const yearlySku = getPremiumSku('yearly');
  const monthlySku = getPremiumSku('monthly');

  if (activeSkus.has(lifetimeSku)) return 'lifetime';
  if (activeSkus.has(yearlySku)) return 'yearly';
  if (activeSkus.has(monthlySku)) return 'monthly';
  return null;
}

function isPurchaseCancelledError(error: any): boolean {
  const code = String(error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? '').toLowerCase();
  return (
    code === '1' ||
    code.includes('purchasecancelled') ||
    code.includes('usercancel') ||
    code.includes('cancel') ||
    message.includes('cancel')
  );
}

function getProductCategory(plan: PremiumPlan): typeof PRODUCT_CATEGORY[keyof typeof PRODUCT_CATEGORY] {
  return plan === 'lifetime' ? PRODUCT_CATEGORY.NON_SUBSCRIPTION : PRODUCT_CATEGORY.SUBSCRIPTION;
}

async function fetchStoreProduct(
  plan: PremiumPlan
): Promise<{ product: PurchasesStoreProduct | null; errorCode?: string }> {
  const sku = getPremiumSku(plan);
  if (!sku) {
    return {
      product: null,
      errorCode: 'iap_not_configured',
    };
  }

  try {
    const products = await Purchases.getProducts([sku], getProductCategory(plan));
    const product = products[0] ?? null;
    if (!product) {
      return {
        product: null,
        errorCode: 'product_not_available',
      };
    }

    return { product };
  } catch (error: any) {
    logger.warn('RevenueCat product lookup failed', error);
    return {
      product: null,
      errorCode: String(error?.code ?? error?.message ?? 'product_lookup_failed'),
    };
  }
}

export async function startPremiumPurchase(
  plan: PremiumPlan,
  appUserId: string | null = null
): Promise<PurchaseResult> {
  const moduleReady = await syncRevenueCatIdentity(appUserId);
  if (!moduleReady) {
    return {
      ok: false,
      isPremium: false,
      errorCode: 'iap_not_configured',
    };
  }

  const productResult = await fetchStoreProduct(plan);
  if (!productResult.product) {
    return {
      ok: false,
      isPremium: false,
      errorCode: productResult.errorCode ?? 'product_not_available',
    };
  }

  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(productResult.product);
    const isPremium = inferPremiumFromCustomerInfo(customerInfo);
    return {
      ok: true,
      isPremium,
      premiumPlan: isPremium ? (inferPremiumPlanFromCustomerInfo(customerInfo) ?? plan) : null,
    };
  } catch (error: any) {
    logger.warn('Purchase failed', error);
    if (isPurchaseCancelledError(error)) {
      return {
        ok: true,
        isPremium: false,
        errorCode: 'purchase_cancelled',
      };
    }
    return {
      ok: false,
      isPremium: false,
      errorCode: String(error?.code ?? error?.message ?? 'purchase_failed'),
    };
  }
}

export async function restorePremiumPurchases(appUserId: string | null = null): Promise<PurchaseResult> {
  const moduleReady = await syncRevenueCatIdentity(appUserId);
  if (!moduleReady) {
    return {
      ok: false,
      isPremium: false,
      errorCode: 'iap_not_configured',
    };
  }

  try {
    const restored = await Purchases.restorePurchases();
    const isPremium = inferPremiumFromCustomerInfo(restored);
    return {
      ok: true,
      isPremium,
      premiumPlan: isPremium ? inferPremiumPlanFromCustomerInfo(restored) : null,
    };
  } catch (error: any) {
    logger.warn('Restore failed', error);
    return {
      ok: false,
      isPremium: false,
      errorCode: String(error?.code ?? error?.message ?? 'restore_failed'),
    };
  }
}

export async function fetchCurrentPremiumStatus(
  appUserId: string | null = null,
  options: FetchCurrentPremiumStatusOptions = {}
): Promise<PurchaseResult> {
  const moduleReady = await syncRevenueCatIdentity(appUserId);
  if (!moduleReady) {
    return {
      ok: false,
      isPremium: false,
      errorCode: 'iap_not_configured',
    };
  }

  try {
    if (options.forceRefresh) {
      await Purchases.invalidateCustomerInfoCache();
    }
    const info = await Purchases.getCustomerInfo();
    const isPremium = inferPremiumFromCustomerInfo(info);
    return {
      ok: true,
      isPremium,
      premiumPlan: isPremium ? inferPremiumPlanFromCustomerInfo(info) : null,
    };
  } catch (error: any) {
    logger.warn('Fetch customer info failed', error);
    return {
      ok: false,
      isPremium: false,
      errorCode: String(error?.code ?? error?.message ?? 'customer_info_failed'),
    };
  }
}

export async function subscribeToPremiumStatusUpdates(
  appUserId: string | null,
  onUpdate: (result: PurchaseResult) => void
): Promise<(() => void) | null> {
  const moduleReady = await syncRevenueCatIdentity(appUserId);
  if (!moduleReady) return null;

  const listener = (info: CustomerInfo) => {
    const isPremium = inferPremiumFromCustomerInfo(info);
    onUpdate({
      ok: true,
      isPremium,
      premiumPlan: isPremium ? inferPremiumPlanFromCustomerInfo(info) : null,
    });
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}
