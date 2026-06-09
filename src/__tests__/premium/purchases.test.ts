jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    getAppUserID: jest.fn().mockResolvedValue('$RCAnonymousID:test'),
    isAnonymous: jest.fn().mockResolvedValue(false),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getProducts: jest.fn(),
    purchaseProduct: jest.fn(),
    purchaseStoreProduct: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    invalidateCustomerInfoCache: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn().mockReturnValue(true),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
  PRODUCT_CATEGORY: {
    SUBSCRIPTION: 'SUBSCRIPTION',
    NON_SUBSCRIPTION: 'NON_SUBSCRIPTION',
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

function loadPurchasesModule(apiKey = 'test_key') {
  jest.doMock('@/premium/config', () => ({
    REVENUECAT_IOS_API_KEY: apiKey,
    getPremiumSku: (plan: string) => `sku_${plan}`,
  }));

  return require('@/premium/purchases') as typeof import('@/premium/purchases');
}

describe('premium purchases bridge', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns not configured when API key is missing', async () => {
    const { startPremiumPurchase } = loadPurchasesModule('');
    const result = await startPremiumPurchase('monthly');

    expect(result).toEqual({
      ok: false,
      isPremium: false,
      errorCode: 'iap_not_configured',
    });
  });

  it('returns success with entitlement from purchase', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getProducts.mockResolvedValue([{ identifier: 'sku_yearly' }]);
    purchases.purchaseStoreProduct.mockResolvedValue({
      customerInfo: {
        entitlements: { active: { pro: {} } },
        activeSubscriptions: ['sku_yearly'],
        allPurchasedProductIdentifiers: ['sku_yearly'],
      },
    });

    const { startPremiumPurchase } = loadPurchasesModule();
    const result = await startPremiumPurchase('yearly');

    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: 'test_key', appUserID: undefined });
    expect(purchases.getProducts).toHaveBeenCalledWith(['sku_yearly'], 'SUBSCRIPTION');
    expect(purchases.purchaseStoreProduct).toHaveBeenCalledWith({ identifier: 'sku_yearly' });
    expect(result).toEqual({ ok: true, isPremium: true, premiumPlan: 'yearly' });
  });

  it('maps cancelled purchase errors to purchase_cancelled', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getProducts.mockResolvedValue([{ identifier: 'sku_monthly' }]);
    purchases.purchaseStoreProduct.mockRejectedValue({ code: 1, message: 'User cancelled' });

    const { startPremiumPurchase } = loadPurchasesModule();
    const result = await startPremiumPurchase('monthly');

    expect(result).toEqual({
      ok: true,
      isPremium: false,
      errorCode: 'purchase_cancelled',
    });
  });

  it('returns product_not_available when RevenueCat cannot resolve the store product', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getProducts.mockResolvedValue([]);

    const { startPremiumPurchase } = loadPurchasesModule();
    const result = await startPremiumPurchase('yearly');

    expect(result).toEqual({
      ok: false,
      isPremium: false,
      errorCode: 'product_not_available',
    });
    expect(purchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });

  it('returns restore success when active subscriptions exist', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.restorePurchases.mockResolvedValue({
      entitlements: { active: {} },
      activeSubscriptions: ['sku_monthly'],
      allPurchasedProductIdentifiers: ['sku_monthly'],
    });

    const { restorePremiumPurchases } = loadPurchasesModule();
    const result = await restorePremiumPurchases();

    expect(result).toEqual({ ok: true, isPremium: true, premiumPlan: 'monthly' });
  });

  it('returns restore failure error code on exception', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.restorePurchases.mockRejectedValue({ message: 'restore exploded' });

    const { restorePremiumPurchases } = loadPurchasesModule();
    const result = await restorePremiumPurchases();

    expect(result).toEqual({
      ok: false,
      isPremium: false,
      errorCode: 'restore exploded',
    });
  });

  it('returns current entitlement status from customer info', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
      activeSubscriptions: ['sku_monthly'],
      allPurchasedProductIdentifiers: ['sku_monthly'],
    });

    const { fetchCurrentPremiumStatus } = loadPurchasesModule();
    const result = await fetchCurrentPremiumStatus();

    expect(result).toEqual({ ok: true, isPremium: true, premiumPlan: 'monthly' });
  });

  it('invalidates the customer info cache before a forced entitlement refresh', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
    });

    const { fetchCurrentPremiumStatus } = loadPurchasesModule();
    await fetchCurrentPremiumStatus('user-1', { forceRefresh: true });

    expect(purchases.invalidateCustomerInfoCache).toHaveBeenCalledTimes(1);
    expect(purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('returns customer info error code on entitlement fetch exception', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getCustomerInfo.mockRejectedValue({ message: 'info exploded' });

    const { fetchCurrentPremiumStatus } = loadPurchasesModule();
    const result = await fetchCurrentPremiumStatus();

    expect(result).toEqual({
      ok: false,
      isPremium: false,
      errorCode: 'info exploded',
    });
  });

  it('configures RevenueCat only once across calls', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getProducts.mockResolvedValue([{ identifier: 'sku_monthly' }]);
    purchases.purchaseStoreProduct.mockResolvedValue({
      customerInfo: {
        entitlements: { active: {} },
        activeSubscriptions: [],
      },
    });

    const { startPremiumPurchase } = loadPurchasesModule();
    await startPremiumPurchase('monthly');
    await startPremiumPurchase('yearly');

    expect(purchases.configure).toHaveBeenCalledTimes(1);
  });

  it('syncs identity with logIn when app user id is provided after anonymous configure', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getAppUserID.mockResolvedValue('$RCAnonymousID:test');
    const { syncRevenueCatIdentity } = loadPurchasesModule();

    await syncRevenueCatIdentity(null);
    await syncRevenueCatIdentity('user-1');

    expect(purchases.logIn).toHaveBeenCalledWith('user-1');
  });

  it('syncs identity with logOut when clearing app user id', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getAppUserID.mockResolvedValue('user-1');
    const { syncRevenueCatIdentity } = loadPurchasesModule();

    await syncRevenueCatIdentity('user-1');
    await syncRevenueCatIdentity(null);

    expect(purchases.logOut).toHaveBeenCalled();
  });

  it('skips logOut when RevenueCat already reports an anonymous user', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getAppUserID.mockResolvedValue('user-1');
    purchases.isAnonymous.mockResolvedValue(true);
    const { syncRevenueCatIdentity } = loadPurchasesModule();

    await syncRevenueCatIdentity('user-1');
    await syncRevenueCatIdentity(null);

    expect(purchases.logOut).not.toHaveBeenCalled();
  });

  it('returns false when logIn fails to avoid stale-identity entitlement reads', async () => {
    const purchases = require('react-native-purchases').default;
    purchases.getAppUserID.mockResolvedValue('$RCAnonymousID:test');
    purchases.logIn.mockRejectedValue(new Error('login failed'));
    const { syncRevenueCatIdentity } = loadPurchasesModule();

    const result = await syncRevenueCatIdentity('user-1');
    expect(result).toBe(false);
  });

  it('subscribes to RevenueCat customer info updates and maps entitlement changes', async () => {
    const purchases = require('react-native-purchases').default;
    let listener: ((info: { entitlements: { active: Record<string, unknown> }; activeSubscriptions: string[]; allPurchasedProductIdentifiers: string[] }) => void) | undefined;
    purchases.addCustomerInfoUpdateListener.mockImplementation((nextListener: typeof listener) => {
      listener = nextListener;
    });

    const { subscribeToPremiumStatusUpdates } = loadPurchasesModule();
    const onUpdate = jest.fn();
    const unsubscribe = await subscribeToPremiumStatusUpdates('user-1', onUpdate);

    listener?.({
      entitlements: { active: {} },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
    });

    expect(onUpdate).toHaveBeenCalledWith({
      ok: true,
      isPremium: false,
      premiumPlan: null,
    });

    unsubscribe?.();
    expect(purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });
});
