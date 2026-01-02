/**
 * Supabase Storage utilities
 * Handles EPUB downloads and signed URLs
 */

import { supabase } from './client';
import * as FileSystem from 'expo-file-system';
import { logger } from '@/utils/logger';

const GENERAL_LIBRARY_BUCKET = 'general-library';

export async function getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
  logger.debug('Getting signed URL', { bucket: GENERAL_LIBRARY_BUCKET, storagePath });
  
  const { data, error } = await supabase.storage
    .from(GENERAL_LIBRARY_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    logger.error('Failed to get signed URL', { error, storagePath });
    throw error;
  }
  
  if (!data?.signedUrl) {
    logger.error('No signed URL returned', { data });
    throw new Error('Failed to get signed URL');
  }
  
  logger.debug('Signed URL obtained', { url: data.signedUrl });
  return data.signedUrl;
}

export async function downloadBook(bookId: string, storagePath: string): Promise<string> {
  logger.info('Downloading book', { bookId, storagePath });
  
  const localPath = `${FileSystem.cacheDirectory}books/${bookId}.epub`;
  logger.debug('Local path', { localPath });
  
  // Check if already cached and valid
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (fileInfo.exists) {
    // Check if file is not empty (valid EPUB should be > 0 bytes)
    const fileSize = 'size' in fileInfo ? fileInfo.size : 0;
    if (fileSize > 0) {
      logger.info('Book already cached', { localPath, size: fileSize });
      return localPath;
    } else {
      logger.warn('Cached file is empty, re-downloading', { localPath });
      await FileSystem.deleteAsync(localPath);
    }
  }
  
  // Ensure directory exists
  const dirPath = `${FileSystem.cacheDirectory}books/`;
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    logger.debug('Creating books directory', { dirPath });
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
  
  // Get signed URL and download
  const signedUrl = await getSignedUrl(storagePath);
  logger.info('Starting download', { signedUrl, localPath });
  
  const downloadResult = await FileSystem.downloadAsync(signedUrl, localPath);
  logger.debug('Download result', { status: downloadResult.status, uri: downloadResult.uri });
  
  if (downloadResult.status !== 200) {
    logger.error('Download failed', { status: downloadResult.status, downloadResult });
    // Clean up empty file if download failed
    try {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (e) {
      logger.warn('Failed to clean up empty file', e);
    }
    throw new Error(`Failed to download book (status: ${downloadResult.status})`);
  }
  
  // Verify downloaded file is not empty
  const verifyInfo = await FileSystem.getInfoAsync(localPath);
  const downloadedSize = 'size' in verifyInfo ? verifyInfo.size : 0;
  
  if (downloadedSize === 0) {
    logger.error('Downloaded file is empty!', { localPath, verifyInfo });
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    throw new Error('Downloaded file is empty - possible storage permissions issue');
  }
  
  logger.info('Book downloaded successfully', { localPath, size: downloadedSize });
  return localPath;
}

export async function downloadExternalBook(bookId: string, epubUrl: string): Promise<string> {
  logger.info('Downloading external book', { bookId });

  const localPath = `${FileSystem.cacheDirectory}books/${bookId}.epub`;

  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (fileInfo.exists) {
    const fileSize = 'size' in fileInfo ? fileInfo.size : 0;
    if (fileSize > 0) {
      logger.info('External book already cached', { localPath, size: fileSize });
      return localPath;
    }
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }

  const dirPath = `${FileSystem.cacheDirectory}books/`;
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }

  const downloadResult = await FileSystem.downloadAsync(epubUrl, localPath);
  if (downloadResult.status !== 200) {
    try {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch {
      // ignore
    }
    throw new Error(`Failed to download external book (status: ${downloadResult.status})`);
  }

  const verifyInfo = await FileSystem.getInfoAsync(localPath);
  const downloadedSize = 'size' in verifyInfo ? verifyInfo.size : 0;
  if (downloadedSize === 0) {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    throw new Error('Downloaded external file is empty');
  }

  return localPath;
}

/**
 * Clean up cached books that no longer exist in the database
 * @param validBookIds Array of book IDs that exist in the database
 */
export async function cleanupOrphanedCache(validBookIds: string[]): Promise<void> {
  try {
    const dirPath = `${FileSystem.cacheDirectory}books/`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    
    if (!dirInfo.exists) {
      return; // No cache directory, nothing to clean
    }

    const files = await FileSystem.readDirectoryAsync(dirPath);
    logger.info('Checking cached files for cleanup', { totalFiles: files.length });

    let deletedCount = 0;
    for (const file of files) {
      // Extract book ID from filename (format: {bookId}.epub)
      const bookId = file.replace('.epub', '');
      
      if (!validBookIds.includes(bookId)) {
        const filePath = `${dirPath}${file}`;
        logger.info('Deleting orphaned cache file', { file, bookId });
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info('Cache cleanup complete', { deletedCount });
    }
  } catch (error) {
    logger.error('Failed to cleanup cache', error);
    // Don't throw - cache cleanup is non-critical
  }
}

