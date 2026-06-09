/**
 * migrateUserData
 *
 * Migrates user-owned rows from a guest user id to a new user id when OAuth/password
 * sign-in creates a new auth.user id. Uses the access_token from the sign-in response
 * so credentials are guaranteed valid at call time.
 */

import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const PENDING_GUEST_MIGRATION_KEY = '@lingoleaf:pending_guest_migration_user_id';

export interface MigrationResult {
  ok: boolean;
  migrated: boolean;
  results?: Array<{ table: string; added: number; skipped: number }>;
  error?: string;
}

export async function getPendingGuestMigrationUserId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_GUEST_MIGRATION_KEY);
  const value = raw?.trim() ?? '';
  return value.length > 0 ? value : null;
}

export async function setPendingGuestMigrationUserId(userId: string): Promise<void> {
  const value = userId.trim();
  if (!value) return;
  await AsyncStorage.setItem(PENDING_GUEST_MIGRATION_KEY, value);
}

export async function clearPendingGuestMigrationUserId(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_GUEST_MIGRATION_KEY);
}

async function callMigrateFunction<T>(
  payload: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const url = `${supabaseUrl}/functions/v1/migrate-user-data`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { error: text };
    }
  }

  if (!response.ok) {
    const parsedError = (parsed?.error as string | undefined) ?? (parsed?.message as string | undefined);
    throw new Error(parsedError || `Migration failed: ${response.status}`);
  }
  return parsed as T;
}

export async function migrateUserDataIfNeeded(
  fromUserId: string,
  toUserId: string,
  accessToken: string
): Promise<MigrationResult> {
  if (!fromUserId || !toUserId) {
    logger.info('Skipping migration: missing user IDs', { fromUserId, toUserId });
    return { ok: true, migrated: false };
  }

  if (fromUserId === toUserId) {
    logger.info('Skipping migration: same user ID');
    return { ok: true, migrated: false };
  }

  if (!accessToken) {
    logger.error('Skipping migration: no access token provided');
    return { ok: false, migrated: false, error: 'Missing access token' };
  }

  try {
    logger.info('Starting user data migration', { fromUserId, toUserId });
    const data = await callMigrateFunction<MigrationResult>(
      {
        mode: 'migrate',
        from_user_id: fromUserId,
        to_user_id: toUserId,
        merge_strategy: 'strict',
        merge_target_list_id: null,
      },
      accessToken
    );
    logger.info('Migration completed successfully', data);
    return data;
  } catch (e) {
    logger.error('Failed to migrate user data', e);
    return { ok: false, migrated: false, error: (e as Error)?.message ?? 'Migration failed' };
  }
}
