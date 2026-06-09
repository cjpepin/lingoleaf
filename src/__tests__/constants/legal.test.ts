import { LEGAL_URLS } from '@/constants/legal';

describe('LEGAL_URLS', () => {
  it('contains expected legal and subscription links', () => {
    expect(LEGAL_URLS).toEqual({
      privacy: 'https://lingoleaf.app/privacy-policy',
      terms: 'https://lingoleaf.app/terms-and-conditions',
      features: 'https://lingoleaf.app/features',
      iosManageSubscriptions: 'https://apps.apple.com/account/subscriptions',
      iosRefunds: 'https://reportaproblem.apple.com/',
    });
  });

  it('uses https for all links', () => {
    const values = Object.values(LEGAL_URLS);
    values.forEach((url) => {
      expect(url.startsWith('https://')).toBe(true);
    });
  });
});
