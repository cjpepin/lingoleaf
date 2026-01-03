/**
 * migrateUserData
 *
 * Client helper for migrating user-owned rows from a guest user id to a new user id
 * when OAuth sign-in creates a new auth.user id.
 */

import { supabase } from '@/supabase/client';
import { logger } from '@/utils/logger';

export async function migrateUserDataIfNeeded(fromUserId: string, toUserId: string): Promise<void> {
  if (!fromUserId || !toUserId) return;
  if (fromUserId === toUserId) return;

  try {
    logger.info('Migrating user data', { fromUserId, toUserId });
    const { error } = await supabase.functions.invoke('migrate-user-data', {
      body: { from_user_id: fromUserId, to_user_id: toUserId },
    });
    if (error) throw error;
  } catch (e) {
    logger.error('Failed to migrate user data', e);
    // Best-effort: do not block sign-in.
  }
}


