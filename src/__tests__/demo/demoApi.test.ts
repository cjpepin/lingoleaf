jest.mock('@portfolio/demo-local', () => ({
  demoSessionId: () => 'test-demo-session',
}));

import {
  DemoEpubFetchError,
  fetchDemoEpubBuffer,
  isDemoEpubProxyUrl,
  isProbableEpubZip,
  resolveDemoEpubSrc,
} from '@/demo/demoApi';

describe('demoApi EPUB proxy', () => {
  const originalFetch = global.fetch;
  const originalDemoApiBase = process.env.EXPO_PUBLIC_DEMO_API_BASE;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
    process.env.EXPO_PUBLIC_DEMO_API_BASE = 'https://connorjpepin.com/api/demo';
    Object.defineProperty(global, 'window', {
      value: { location: { origin: 'https://connorjpepin.com' } },
      writable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_DEMO_API_BASE = originalDemoApiBase;
  });

  it('resolveDemoEpubSrc rewrites Gutenberg cache URLs to the portfolio proxy', () => {
    const resolved = resolveDemoEpubSrc(
      'https://www.gutenberg.org/cache/epub/2000/pg2000-images-3.epub',
      '2000',
    );
    expect(resolved).toContain('/api/demo/epub?gutenberg_id=2000');
    expect(isDemoEpubProxyUrl(resolved)).toBe(true);
  });

  it('isProbableEpubZip detects ZIP magic bytes', () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer;
    const html = new TextEncoder().encode('<html>').buffer;
    expect(isProbableEpubZip(zip)).toBe(true);
    expect(isProbableEpubZip(html)).toBe(false);
  });

  it('fetchDemoEpubBuffer rejects non-zip responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('<html>404</html>').buffer,
    }) as unknown as typeof fetch;

    await expect(fetchDemoEpubBuffer('https://example.com/api/demo/epub?gutenberg_id=1')).rejects.toBeInstanceOf(
      DemoEpubFetchError,
    );
  });

  it('fetchDemoEpubBuffer returns buffer for valid epub zip', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => zip,
    }) as unknown as typeof fetch;

    const result = await fetchDemoEpubBuffer('https://example.com/api/demo/epub?gutenberg_id=2000');
    expect(result).toBe(zip);
  });

  it('fetchDemoEpubBuffer surfaces HTTP errors from the proxy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown as typeof fetch;

    await expect(fetchDemoEpubBuffer('https://example.com/api/demo/epub?gutenberg_id=1')).rejects.toMatchObject({
      status: 404,
    });
  });
});
