import {
  isDemoMode,
  isEmbedMode,
  isShowcaseMode,
  isWebDemo,
  isWebPlatform,
  normalizeWebBasePath,
  readDemoViewModeFromSearch,
  SHOWCASE_BOOK_ID,
  WEB_BASE_PATH,
} from '@/demo/config';

describe('demo config', () => {
  const originalDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE;
  const originalBasePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH;

  afterEach(() => {
    process.env.EXPO_PUBLIC_DEMO_MODE = originalDemoMode;
    process.env.EXPO_PUBLIC_WEB_BASE_PATH = originalBasePath;
    jest.resetModules();
  });

  it('reads the configured web base path', () => {
    process.env.EXPO_PUBLIC_WEB_BASE_PATH = '/lingoleaf/demo';
    jest.resetModules();
    const config = require('@/demo/config') as typeof import('@/demo/config');
    expect(config.WEB_BASE_PATH).toBe('/lingoleaf/demo');
  });

  it('normalizes trailing slashes from base paths', () => {
    expect(normalizeWebBasePath('lingoleaf/demo/')).toBe('/lingoleaf/demo');
    expect(normalizeWebBasePath('/lingoleaf/demo')).toBe('/lingoleaf/demo');
  });

  it('treats demo mode as enabled when EXPO_PUBLIC_DEMO_MODE=true', () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
    jest.resetModules();
    const config = require('@/demo/config') as typeof import('@/demo/config');
    expect(config.isDemoMode()).toBe(true);
  });

  it('exports stable helpers', () => {
    expect(typeof isWebPlatform()).toBe('boolean');
    expect(typeof isWebDemo()).toBe('boolean');
    expect(typeof isEmbedMode()).toBe('boolean');
    expect(typeof isDemoMode()).toBe('boolean');
    expect(typeof isShowcaseMode()).toBe('boolean');
    expect(WEB_BASE_PATH.length).toBeGreaterThan(0);
  });

  it('reads showcase mode from query string', () => {
    expect(readDemoViewModeFromSearch('?mode=showcase')).toBe('showcase');
    expect(readDemoViewModeFromSearch('mode=showcase')).toBe('showcase');
    expect(readDemoViewModeFromSearch('?mode=explore')).toBe('explore');
    expect(readDemoViewModeFromSearch('')).toBe('explore');
  });

  it('exposes showcase book id constant', () => {
    expect(SHOWCASE_BOOK_ID).toBe('11111111-1111-4111-8111-111111111101');
  });
});
