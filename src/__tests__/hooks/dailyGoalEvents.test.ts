import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import {
  getCachedDailyGoalMinutes,
  hydrateCachedDailyGoalMinutes,
  setCachedDailyGoalMinutes,
} from '@/hooks/dailyGoalEvents';

describe('dailyGoalEvents', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists cached daily minutes to AsyncStorage', async () => {
    setCachedDailyGoalMinutes('reader-user', '2026-03-18', 12);

    await waitFor(async () => {
      await expect(AsyncStorage.getItem('ll_daily_goal_minutes:reader-user:2026-03-18')).resolves.toBe('12');
    });
  });

  it('hydrates persisted daily minutes back into the in-memory cache', async () => {
    await AsyncStorage.setItem('ll_daily_goal_minutes:hydrated-user:2026-03-18', '9');

    await expect(hydrateCachedDailyGoalMinutes('hydrated-user', '2026-03-18')).resolves.toBe(9);
    expect(getCachedDailyGoalMinutes('hydrated-user', '2026-03-18')).toBe(9);
  });
});
