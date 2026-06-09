import { bannerUnitId } from '@/ads/adIds';

describe('bannerUnitId', () => {
  it('returns a string', () => {
    const id = bannerUnitId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('falls back to test ID when env vars are not set', () => {
    const id = bannerUnitId();
    // TestIds.BANNER from the mock is 'ca-app-pub-test'
    expect(id).toBe('ca-app-pub-test');
  });
});
