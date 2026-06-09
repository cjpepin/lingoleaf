jest.mock('@/supabase/client', () => {
  const mockCreateSignedUrl = jest.fn();
  const mockFrom = jest.fn(() => ({
    createSignedUrl: mockCreateSignedUrl,
  }));
  return {
    supabase: {
      storage: {
        from: mockFrom,
      },
    },
    __mockFrom: mockFrom,
    __mockCreateSignedUrl: mockCreateSignedUrl,
  };
});

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system';
import {
  cleanupOrphanedCache,
  downloadBook,
  downloadExternalBook,
  getLocalBookPath,
  getSignedUrl,
  removeBookDownload,
  runAutoRemoveDownloads,
} from '@/supabase/storage';

const { __mockFrom, __mockCreateSignedUrl } = require('@/supabase/client') as {
  __mockFrom: jest.Mock;
  __mockCreateSignedUrl: jest.Mock;
};

describe('supabase/storage', () => {
  beforeEach(() => {
    __mockFrom.mockReset();
    __mockFrom.mockImplementation(() => ({ createSignedUrl: __mockCreateSignedUrl }));
    __mockCreateSignedUrl.mockReset();

    (FileSystem.getInfoAsync as jest.Mock).mockReset();
    (FileSystem.makeDirectoryAsync as jest.Mock).mockReset();
    (FileSystem.deleteAsync as jest.Mock).mockReset();
    (FileSystem.readDirectoryAsync as jest.Mock).mockReset();
    (FileSystem.downloadAsync as jest.Mock).mockReset();
  });

  it('getSignedUrl returns signed url', async () => {
    __mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example' }, error: null });

    const url = await getSignedUrl('books/a.epub');

    expect(url).toBe('https://signed.example');
    expect(__mockFrom).toHaveBeenCalledWith('general-library');
  });

  it('getSignedUrl throws when supabase returns error', async () => {
    __mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(getSignedUrl('books/a.epub')).rejects.toThrow('boom');
  });

  it('downloadBook returns cached local file when non-empty', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true, size: 42 });

    const localPath = await downloadBook('b1', 'books/b1.epub');

    expect(localPath).toBe('/mock/documents/books/b1.epub');
    expect((FileSystem.downloadAsync as jest.Mock)).not.toHaveBeenCalled();
  });

  it('downloadBook re-downloads when cache file is empty', async () => {
    __mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example' }, error: null });
    (FileSystem.getInfoAsync as jest.Mock)
      .mockResolvedValueOnce({ exists: true, size: 0 })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 120 });
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200, uri: '/mock/documents/books/b1.epub' });

    const localPath = await downloadBook('b1', 'books/b1.epub');

    expect(localPath).toBe('/mock/documents/books/b1.epub');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/books/b1.epub');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith('/mock/documents/books/', { intermediates: true });
  });

  it('downloadExternalBook throws on non-200 download status', async () => {
    (FileSystem.getInfoAsync as jest.Mock)
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true });
    (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 500, uri: '/mock/documents/books/b2.epub' });

    await expect(downloadExternalBook('b2', 'https://example.com/book.epub')).rejects.toThrow(
      'Failed to download external book (status: 500)'
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/books/b2.epub', { idempotent: true });
  });

  it('runAutoRemoveDownloads deletes stale epub files only', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-23T00:00:00.000Z'));
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['old.epub', 'recent.epub', 'note.txt']);

    await runAutoRemoveDownloads(14, [
      { book_id: 'recent', last_read_at: '2026-02-20T00:00:00.000Z' },
      { book_id: 'old', last_read_at: '2025-12-01T00:00:00.000Z' },
    ]);

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/books/old.epub', { idempotent: true });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('/mock/documents/books/recent.epub', { idempotent: true });
    jest.useRealTimers();
  });

  it('cleanupOrphanedCache removes files not present in valid ids', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['a.epub', 'b.epub']);

    await cleanupOrphanedCache(['a']);

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/books/b.epub', { idempotent: true });
  });

  it('getLocalBookPath and removeBookDownload use expected local path', async () => {
    expect(getLocalBookPath('abc')).toBe('/mock/documents/books/abc.epub');

    await removeBookDownload('abc');

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/documents/books/abc.epub', { idempotent: true });
  });
});
