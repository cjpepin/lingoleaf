import { APPLE_USER_PLACEHOLDER, getUserDisplayName } from '@/screens/profile/getUserDisplayName';

describe('getUserDisplayName', () => {
  it('returns empty string for missing user', () => {
    expect(getUserDisplayName(null)).toBe('');
    expect(getUserDisplayName(undefined)).toBe('');
  });

  it('prefers full name', () => {
    expect(getUserDisplayName({
      email: 'test@example.com',
      user_metadata: { full_name: 'Taylor Swift' },
    })).toBe('Taylor Swift');
  });

  it('uses first and last name when full name is missing', () => {
    expect(getUserDisplayName({
      email: 'test@example.com',
      user_metadata: { first_name: 'Taylor', last_name: 'Swift' },
    })).toBe('Taylor Swift');
  });

  it('uses first name when last name is missing', () => {
    expect(getUserDisplayName({
      email: 'test@example.com',
      user_metadata: { first_name: 'Taylor' },
    })).toBe('Taylor');
  });

  it('returns apple placeholder for apple users without names', () => {
    expect(getUserDisplayName({
      email: 'relay@privaterelay.appleid.com',
      app_metadata: { providers: ['apple'] },
      user_metadata: {},
    })).toBe(APPLE_USER_PLACEHOLDER);
  });

  it('falls back to email for non-apple users without names', () => {
    expect(getUserDisplayName({
      email: 'normal@example.com',
      app_metadata: { providers: ['email'] },
      user_metadata: {},
    })).toBe('normal@example.com');
  });
});
