/**
 * migrateUserData
 *
 * Migrates user-owned rows from a guest user id to a new user id when OAuth/password
 * sign-in creates a new auth.user id. Uses the access_token from the sign-in response
 * so credentials are guaranteed valid at call time.
 */

import { logger } from '@/utils/logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export async function migrateUserDataIfNeeded(
  fromUserId: string,
  toUserId: string,
  accessToken: string
): Promise<void> {
  if (!fromUserId || !toUserId) {
    logger.info('Skipping migration: missing user IDs', { fromUserId, toUserId });
    return;
  }

  if (fromUserId === toUserId) {
    logger.info('Skipping migration: same user ID');
    return;
  }

  if (!accessToken) {
    logger.error('Skipping migration: no access token provided');
    return;
  }

  try {
    logger.info('Starting user data migration', { fromUserId, toUserId });

    const url = `${supabaseUrl}/functions/v1/migrate-user-data`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        from_user_id: fromUserId,
        to_user_id: toUserId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error('Migration Edge Function error', {
        status: response.status,
        statusText: response.statusText,
        body,
        hint: response.status === 401
          ? 'Gateway 401 — function likely needs redeployment with --no-verify-jwt'
          : undefined,
      });
      let errMsg = `Migration failed: ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        if (parsed.error) errMsg = parsed.error;
        else if (parsed.message) errMsg = parsed.message;
        else if (parsed.msg) errMsg = parsed.msg;
      } catch { /* raw text */ }
      throw new Error(errMsg);
    }

    const data = await response.json();
    logger.info('Migration completed successfully', data);
  } catch (e) {
    logger.error('Failed to migrate user data', e);
    // Best-effort: do not block sign-in even if migration fails.
  }
}


