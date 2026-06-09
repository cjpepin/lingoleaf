import {
  isRevenueCatWebhookAuthorized,
  mapRevenueCatSubscriberToPremiumStatus,
  parseRevenueCatWebhookAppUserIds,
  type RevenueCatEntitlementConfig,
} from '../../../supabase/functions/_shared/revenuecatEntitlement';

const config: RevenueCatEntitlementConfig = {
  monthlySku: 'lingoleaf_premium_monthly',
  yearlySku: 'lingoleaf_premium_yearly',
  lifetimeSku: 'lingoleaf_premium_lifetime',
};

describe('revenuecatEntitlement', () => {
  it('maps active yearly subscriptions to premium yearly', () => {
    const result = mapRevenueCatSubscriberToPremiumStatus({
      subscriber: {
        entitlements: {
          pro: {
            product_identifier: 'lingoleaf_premium_yearly',
            expires_date: '2099-01-01T00:00:00Z',
          },
        },
        subscriptions: {
          lingoleaf_premium_yearly: {
            expires_date: '2099-01-01T00:00:00Z',
          },
        },
        non_subscriptions: {},
      },
    }, config);

    expect(result).toEqual({
      is_premium: true,
      premium_plan: 'yearly',
    });
  });

  it('maps non-subscription lifetime purchases to premium lifetime', () => {
    const result = mapRevenueCatSubscriberToPremiumStatus({
      subscriber: {
        entitlements: {},
        subscriptions: {},
        non_subscriptions: {
          lingoleaf_premium_lifetime: [{ id: 'txn-1' }],
        },
      },
    }, config);

    expect(result).toEqual({
      is_premium: true,
      premium_plan: 'lifetime',
    });
  });

  it('maps expired subscriptions to free', () => {
    const result = mapRevenueCatSubscriberToPremiumStatus({
      subscriber: {
        entitlements: {
          pro: {
            product_identifier: 'lingoleaf_premium_monthly',
            expires_date: '2020-01-01T00:00:00Z',
          },
        },
        subscriptions: {
          lingoleaf_premium_monthly: {
            expires_date: '2020-01-01T00:00:00Z',
          },
        },
        non_subscriptions: {},
      },
    }, config, new Date('2026-04-23T00:00:00Z'));

    expect(result).toEqual({
      is_premium: false,
      premium_plan: null,
    });
  });

  it('accepts only the configured webhook authorization header', () => {
    expect(isRevenueCatWebhookAuthorized('Bearer secret-1', 'Bearer secret-1')).toBe(true);
    expect(isRevenueCatWebhookAuthorized('Bearer secret-2', 'Bearer secret-1')).toBe(false);
    expect(isRevenueCatWebhookAuthorized(null, 'Bearer secret-1')).toBe(false);
  });

  it('extracts app user ids from transfer and direct webhook payloads', () => {
    expect(parseRevenueCatWebhookAppUserIds({
      event: {
        app_user_id: 'user-1',
      },
    })).toEqual(['user-1']);

    expect(parseRevenueCatWebhookAppUserIds({
      event: {
        transferred_from: ['user-1'],
        transferred_to: ['user-2'],
      },
    }).sort()).toEqual(['user-1', 'user-2']);
  });

  it('rejects malformed webhook payloads that do not include a user id', () => {
    expect(() => parseRevenueCatWebhookAppUserIds({ event: {} })).toThrow(
      'RevenueCat event missing app_user_id'
    );
    expect(() => parseRevenueCatWebhookAppUserIds({})).toThrow(
      'Missing RevenueCat event payload'
    );
  });
});
