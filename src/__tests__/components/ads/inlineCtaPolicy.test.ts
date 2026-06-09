import {
  INLINE_CTA_PROBABILITY,
  shouldShowInlineCta,
} from '@/components/ads/inlineCtaPolicy';

describe('inline CTA policy', () => {
  it('blocks CTA when premium user', () => {
    expect(shouldShowInlineCta({
      enabled: true,
      isPremium: true,
      hydrated: true,
      impressionCount: 100,
      sessionShownCount: 0,
      nextEligibleImpression: 0,
    }, 0)).toBe(false);
  });

  it('blocks CTA before store hydration', () => {
    expect(shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: false,
      impressionCount: 100,
      sessionShownCount: 0,
      nextEligibleImpression: 0,
    }, 0)).toBe(false);
  });

  it('blocks CTA below minimum real-ad impressions', () => {
    expect(shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: true,
      impressionCount: 3,
      sessionShownCount: 0,
      nextEligibleImpression: 0,
    }, 0)).toBe(false);
  });

  it('blocks CTA when session cap reached', () => {
    expect(shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: true,
      impressionCount: 100,
      sessionShownCount: 1,
      nextEligibleImpression: 0,
    }, 0)).toBe(false);
  });

  it('blocks CTA before cooldown threshold', () => {
    expect(shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: true,
      impressionCount: 20,
      sessionShownCount: 0,
      nextEligibleImpression: 40,
    }, 0)).toBe(false);
  });

  it('shows CTA only when random draw is below probability', () => {
    const allowed = shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: true,
      impressionCount: 100,
      sessionShownCount: 0,
      nextEligibleImpression: 0,
    }, INLINE_CTA_PROBABILITY - 0.001);

    const blocked = shouldShowInlineCta({
      enabled: true,
      isPremium: false,
      hydrated: true,
      impressionCount: 100,
      sessionShownCount: 0,
      nextEligibleImpression: 0,
    }, INLINE_CTA_PROBABILITY + 0.001);

    expect(allowed).toBe(true);
    expect(blocked).toBe(false);
  });
});
