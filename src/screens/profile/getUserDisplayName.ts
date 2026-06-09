/**
 * Resolves user display name for profile header.
 */

export const APPLE_USER_PLACEHOLDER = 'APPLE_USER_PLACEHOLDER';

interface ProfileUserLike {
  email?: string | null;
  app_metadata?: {
    providers?: string[] | null;
  } | null;
  user_metadata?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export function getUserDisplayName(user: ProfileUserLike | null | undefined): string {
  if (!user) return '';

  const email = user.email ?? '';
  const isApplePrivateRelay = email.includes('@privaterelay.appleid.com');
  const providers = user.app_metadata?.providers ?? [];
  const isAppleUser = providers.includes('apple') || isApplePrivateRelay;

  const fullName = user.user_metadata?.full_name;
  const firstName = user.user_metadata?.first_name;
  const lastName = user.user_metadata?.last_name;

  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (isAppleUser) return APPLE_USER_PLACEHOLDER;

  return email;
}
