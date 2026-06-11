/**
 * Web stub for react-native-purchases.
 */

export const LOG_LEVEL = { DEBUG: 'DEBUG' };
export const PRODUCT_CATEGORY = {
  SUBSCRIPTION: 'SUBSCRIPTION',
  NON_SUBSCRIPTION: 'NON_SUBSCRIPTION',
};

export type CustomerInfo = {
  entitlements: { active: Record<string, unknown> };
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
};

export type PurchasesStoreProduct = {
  identifier: string;
};

const Purchases = {
  setLogLevel: () => undefined,
  configure: async () => undefined,
  getAppUserID: async () => '',
  logIn: async () => ({ customerInfo: {} }),
  logOut: async () => ({ customerInfo: {} }),
  isAnonymous: async () => true,
  getProducts: async () => [],
  purchaseStoreProduct: async () => ({ customerInfo: {} }),
  restorePurchases: async () => ({}),
  invalidateCustomerInfoCache: async () => undefined,
  getCustomerInfo: async () => ({}),
  addCustomerInfoUpdateListener: () => undefined,
  removeCustomerInfoUpdateListener: () => undefined,
};

export default Purchases;
