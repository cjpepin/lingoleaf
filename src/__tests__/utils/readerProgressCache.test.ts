import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedLastCfi,
  setCachedLastCfi,
  setCachedLastPosition,
  setCachedTotalLocations,
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

    it('clears existing cached page fields when preservePosition is false', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 42,
        totalLocations: 100,
      });
      await setCachedLastCfi('user1', 'book1', 'epubcfi(/6/6!/2)', undefined, {
        preservePosition: false,
      });
      const result = await getCachedLastCfi('user1', 'book1');
      expect(result!.cfi).toBe('epubcfi(/6/6!/2)');
      expect(result!.locationIndex0).toBeUndefined();
      expect(result!.totalLocations).toBeUndefined();
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

  describe('setCachedTotalLocations', () => {
    it('updates total locations while preserving existing cfi and location index', async () => {
      await setCachedLastPosition('user1', 'book1', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 17,
      });

      await setCachedTotalLocations('user1', 'book1', 684);

      const result = await getCachedLastCfi('user1', 'book1');
      expect(result!.cfi).toBe('epubcfi(/6/4!/2)');
      expect(result!.locationIndex0).toBe(17);
      expect(result!.totalLocations).toBe(684);
    });

    it('stores totals separately per book key', async () => {
      await setCachedLastPosition('user1', 'book-a', {
        cfi: 'epubcfi(/6/4!/2)',
        locationIndex0: 5,
      });
      await setCachedLastPosition('user1', 'book-b', {
        cfi: 'epubcfi(/6/8!/2)',
        locationIndex0: 9,
      });

      await setCachedTotalLocations('user1', 'book-a', 320);
      await setCachedTotalLocations('user1', 'book-b', 910);

      const a = await getCachedLastCfi('user1', 'book-a');
      const b = await getCachedLastCfi('user1', 'book-b');
      expect(a!.totalLocations).toBe(320);
      expect(b!.totalLocations).toBe(910);
    });
  });
});
