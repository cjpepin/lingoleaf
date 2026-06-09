import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { track } from '@/analytics/client';
import { fetchTodayReadingMinutes, fetchUserSettings, upsertUserSettings } from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';
import {
  getCachedDailyGoalMinutes,
  getDateKey,
  hydrateCachedDailyGoalMinutes,
  setCachedDailyGoalMinutes,
  subscribeDailyGoalReadingEvent,
} from '@/hooks/dailyGoalEvents';

interface DailyGoalState {
  goalMinutes: number;
  minutesToday: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setGoalMinutes: (minutes: number, source?: 'onboarding' | 'settings') => Promise<void>;
}

export function normalizeDailyReadingGoalMinutes(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 10;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(5, Math.min(60, rounded));
}

export function resolveDailyReadingMinutes(cachedMinutes: number | null, remoteMinutes: number): number {
  const safeRemote = Math.max(0, Math.floor(remoteMinutes));
  if (cachedMinutes == null) return safeRemote;
  return Math.max(Math.max(0, Math.floor(cachedMinutes)), safeRemote);
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export function useDailyGoal(): DailyGoalState {
  const user = useAuthStore((s) => s.user);
  const [goalMinutes, setGoalMinutesState] = useState<number>(10);
  const [minutesToday, setMinutesToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const timeZone = useMemo(() => getDeviceTimezone(), []);
  const [todayKey, setTodayKey] = useState(() => getDateKey(new Date().toISOString(), timeZone));
  const resolveTodayKey = useCallback(() => getDateKey(new Date().toISOString(), timeZone), [timeZone]);

  useEffect(() => {
    const syncDayKey = () => {
      const nextKey = resolveTodayKey();
      setTodayKey((prev) => (prev === nextKey ? prev : nextKey));
    };
    const intervalId = setInterval(syncDayKey, 60 * 1000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncDayKey();
    });
    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [resolveTodayKey]);

  useEffect(() => {
    if (!user?.id) {
      setMinutesToday(0);
      return;
    }

    const cached = getCachedDailyGoalMinutes(user.id, todayKey);
    setMinutesToday(cached ?? 0);

    let cancelled = false;
    void hydrateCachedDailyGoalMinutes(user.id, todayKey).then((hydrated) => {
      if (!cancelled && hydrated != null) {
        setMinutesToday(hydrated);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [todayKey, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setGoalMinutesState(10);
      setMinutesToday(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const cachedBeforeFetch = getCachedDailyGoalMinutes(user.id, todayKey);
      if (cachedBeforeFetch != null) {
        setMinutesToday(cachedBeforeFetch);
      }

      const [settings, todayMinutes] = await Promise.all([
        fetchUserSettings(user.id),
        fetchTodayReadingMinutes(user.id, timeZone),
      ]);

      const normalizedGoal = normalizeDailyReadingGoalMinutes(settings?.daily_reading_goal_minutes);
      const resolvedMinutes = resolveDailyReadingMinutes(cachedBeforeFetch, todayMinutes);
      setCachedDailyGoalMinutes(user.id, todayKey, resolvedMinutes);
      setGoalMinutesState(normalizedGoal);
      setMinutesToday(resolvedMinutes);

      track('goal_progress_viewed', {
        minutes_goal: normalizedGoal,
        minutes_done_today: resolvedMinutes,
      });
    } finally {
      setLoading(false);
    }
  }, [timeZone, todayKey, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeDailyGoalReadingEvent((event) => {
      if (event.userId !== user.id) return;
      if (getDateKey(event.occurredAtIso, timeZone) !== todayKey) return;
      setMinutesToday((prev) => {
        const next = Math.max(0, prev + Math.max(0, Math.floor(event.minutes)));
        setCachedDailyGoalMinutes(user.id, todayKey, next);
        return next;
      });
    });
  }, [timeZone, todayKey, user?.id]);

  const setGoalMinutes = useCallback(async (minutes: number, source: 'onboarding' | 'settings' = 'settings') => {
    const normalizedMinutes = normalizeDailyReadingGoalMinutes(minutes);
    if (!user?.id) {
      setGoalMinutesState(normalizedMinutes);
      return;
    }

    await upsertUserSettings({
      user_id: user.id,
      daily_reading_goal_minutes: normalizedMinutes,
    });

    setGoalMinutesState(normalizedMinutes);
    track('goal_set', {
      minutes: normalizedMinutes,
      source,
    });
  }, [user?.id]);

  return {
    goalMinutes,
    minutesToday,
    loading,
    refresh,
    setGoalMinutes,
  };
}
