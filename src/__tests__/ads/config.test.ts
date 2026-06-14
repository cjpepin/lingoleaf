import { areAdsEnabled } from '@/ads/config';

describe('ads config', () => {
  const original = process.env.EXPO_PUBLIC_ADS_DISABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_ADS_DISABLED;
    } else {
      process.env.EXPO_PUBLIC_ADS_DISABLED = original;
    }
  });

  it('enables ads by default', () => {
    delete process.env.EXPO_PUBLIC_ADS_DISABLED;
    expect(areAdsEnabled()).toBe(true);
  });

  it('disables ads when EXPO_PUBLIC_ADS_DISABLED=true', () => {
    process.env.EXPO_PUBLIC_ADS_DISABLED = 'true';
    expect(areAdsEnabled()).toBe(false);
  });
});
