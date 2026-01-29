/**
 * migrateUserData
 *
 * Client helper for migrating user-owned rows from a guest user id to a new user id
 * when OAuth sign-in creates a new auth.user id.
 */

import { supabase } from '@/supabase/client';
import { logger } from '@/utils/logger';

export async function migrateUserDataIfNeeded(fromUserId: string, toUserId: string): Promise<void> {
  if (!fromUserId || !toUserId) {
    logger.info('Skipping migration: missing user IDs', { fromUserId, toUserId });
    return;
  }
  
  if (fromUserId === toUserId) {
    logger.info('Skipping migration: same user ID');
    return;
  }

  try {
    logger.info('Starting user data migration', { fromUserId, toUserId });
    
    // Verify we have a valid session (should already be established by caller)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('Error getting session for migration', sessionError);
      return;
    }
    
    if (!sessionData?.session) {
      logger.error('No active session found during migration attempt');
      return;
    }
    
    if (sessionData.session.user.id !== toUserId) {
      logger.error('Session user ID mismatch', { 
        sessionUserId: sessionData.session.user.id, 
        expectedUserId: toUserId 
      });
      return;
    }
    
    logger.info('Session verified, invoking migration Edge Function');
    const response = await supabase.functions.invoke('migrate-user-data', {
      body: { from_user_id: fromUserId, to_user_id: toUserId },
    });
    
    if (response.error) {
      // Log detailed error information
      logger.error('Migration Edge Function error', { 
        error: response.error,
        errorMessage: response.error.message,
        errorContext: response.error.context,
        data: response.data,
        status: (response.error as any)?.status,
      });
      
      // Try to get more details from the error
      const errorDetails = JSON.stringify(response.error, null, 2);
      logger.error('Full error details:', errorDetails);
      
      throw response.error;
    }
    
    logger.info('Migration completed successfully', response.data);
  } catch (e) {
    logger.error('Failed to migrate user data', e);
    // Best-effort: do not block sign-in even if migration fails.
  }
}


