import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedLastCfi,
  setCachedLastCfi,
  setCachedLastPosition,
} from '@/utils/readerProgressCache';

describe('readerProgressCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('getCachedLastCfi', () => {
    it('returns null when nothing is cached', async () => {
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).toBeNull();
    });

    it('returns cached data after setCachedLastCfi', async () => {
      await setCachedLastCfi('user1', 'book1', 'epubcfi(/6/4!/2)');
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).not.toBeNull();
      expect(result!.cfi).toBe('epubcfi(/6/4!/2)');
      expect(result!.updatedAt).toBeGreaterThan(0);
    });

    it('returns null for invalid cached data', async () => {
      const key = 'll_reader_last_cfi:user1:book1';
      await AsyncStorage.setItem(key, JSON.stringify({ cfi: 42 }));
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).toBeNull();
    });

    it('uses "device" prefix for null userId', async () => {
      await setCachedLastCfi(null, 'book1', 'epubcfi(/6/4!/2)');
      const result = await getCachedLastCfi(null, 'book1');
      expect(result).not.toBeNull();
      expect(result!.cfi).toBe('epubcfi(/6/4!/2)');
    });
  });

  describe('setCachedLastCfi', () => {
    it('does nothing for empty cfi', async () => {
      await setCachedLastCfi('user1', 'book1', '');
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).toBeNull();
    });

    it('preserves existing locationIndex0 when only updating cfi', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 42,
        totalLocations: 100,
      });
      await setCachedLastCfi('user1', 'book1', 'epubcfi(/6/6!/2)');
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result!.cfi).toBe('epubcfi(/6/6!/2)');
      expect(result!.locationIndex0).toBe(42);
      expect(result!.totalLocations).toBe(100);
    });
  });

  describe('setCachedLastPosition', () => {
    it('stores cfi with location index and total', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 10,
        totalLocations: 200,
      });
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result!.locationIndex0).toBe(10);
      expect(result!.totalLocations).toBe(200);
    });

    it('rejects negative locationIndex0', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: -1,
      });
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).toBeNull();
    });

    it('rejects empty cfi', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: '',
        locationIndex0: 10,
      });
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result).toBeNull();
    });

    it('floors fractional locationIndex0', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 10.7,
        totalLocations: 200.3,
      });
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result!.locationIndex0).toBe(10);
      expect(result!.totalLocations).toBe(200);
    });
  });
});
