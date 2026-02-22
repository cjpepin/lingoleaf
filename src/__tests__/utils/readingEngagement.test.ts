import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  incrementReadingSession,
  addReadMinutes,
  getReadingSessions,
  getReadMinutes,
} from '@/utils/readingEngagement';

describe('readingEngagement', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('incrementReadingSession', () => {
    it('starts at 1 for a new user', async () => {
      const result = await incrementReadingSession('user1');
      expect(result.sessions).toBe(1);
      expect(result.minutes).toBe(0);
    });

    it('increments on subsequent calls', async () => {
      await incrementReadingSession('user1');
      await incrementReadingSession('user1');
      const result = await incrementReadingSession('user1');
      expect(result.sessions).toBe(3);
    });

    it('tracks users independently', async () => {
      await incrementReadingSession('user1');
      await incrementReadingSession('user1');
      const r1 = await incrementReadingSession('user1');
      const r2 = await incrementReadingSession('user2');
      expect(r1.sessions).toBe(3);
      expect(r2.sessions).toBe(1);
    });
  });

  describe('addReadMinutes', () => {
    it('starts at 0 for a new user', async () => {
      const result = await addReadMinutes('user1', 5);
      expect(result.minutes).toBe(5);
    });

    it('accumulates minutes', async () => {
      await addReadMinutes('user1', 10);
      const result = await addReadMinutes('user1', 15);
      expect(result.minutes).toBe(25);
    });

    it('floors fractional minutes', async () => {
      const result = await addReadMinutes('user1', 3.7);
      expect(result.minutes).toBe(3);
    });

    it('ignores negative minutes', async () => {
      await addReadMinutes('user1', 10);
      const result = await addReadMinutes('user1', -5);
      expect(result.minutes).toBe(10);
    });

    it('includes current session count', async () => {
      await incrementReadingSession('user1');
      const result = await addReadMinutes('user1', 5);
      expect(result.sessions).toBe(1);
      expect(result.minutes).toBe(5);
    });
  });

  describe('getReadingSessions / getReadMinutes', () => {
    it('returns 0 for unknown user', async () => {
      expect(await getReadingSessions('unknown')).toBe(0);
      expect(await getReadMinutes('unknown')).toBe(0);
    });
  });
});
