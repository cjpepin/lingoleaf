import { parseTrustedAuthCallback, redactAuthTokens } from '@/utils/authDeepLink';

describe('parseTrustedAuthCallback', () => {
  it('accepts the custom-scheme auth callback used by the hosted redirect page', () => {
    expect(
      parseTrustedAuthCallback('lingoleaf://auth#access_token=abc&refresh_token=def')
    ).toEqual({
      accessToken: 'abc',
      refreshToken: 'def',
    });
  });

  it('accepts the trusted universal-link auth callback', () => {
    expect(
      parseTrustedAuthCallback('https://lingoleafapp.com/auth?access_token=abc&refresh_token=def')
    ).toEqual({
      accessToken: 'abc',
      refreshToken: 'def',
    });
  });

  it('rejects untrusted auth-looking URLs', () => {
    expect(
      parseTrustedAuthCallback('https://evil.example/auth#access_token=abc&refresh_token=def')
    ).toBeNull();
    expect(
      parseTrustedAuthCallback('lingoleaf://profile#access_token=abc&refresh_token=def')
    ).toBeNull();
  });
});

describe('redactAuthTokens', () => {
  it('redacts access and refresh tokens in logs', () => {
    expect(
      redactAuthTokens('lingoleaf://auth#access_token=abc&refresh_token=def&type=signup')
    ).toBe('lingoleaf://auth#access_token=REDACTED&refresh_token=REDACTED&type=signup');
  });
});
