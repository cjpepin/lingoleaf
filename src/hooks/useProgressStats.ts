import { useCallback, useEffect, useMemo, useState } from 'react';
import { track } from '@/analytics/client';
import {
  fetchProgressStats,
  fetchProgressTimeline,
  fetchProgressTrendSnapshot,
  type ProgressRange,
  type ProgressStats,
  type ProgressTimeline,
} from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';
import { usePremium } from '@/premium/PremiumProvider';
import { computeMetricTrend, type MetricTrend } from '@/screens/progress/trend';

interface ProgressTrends {
  windowDays: number;
  minutesRead: MetricTrend;
  wordsSaved: MetricTrend;
  wordsReviewed: MetricTrend;
}

interface ProgressState extends ProgressStats {
  loading: boolean;
  error: string | null;
  trends: ProgressTrends | null;
  timeline: ProgressTimeline | null;
  refresh: () => Promise<void>;
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  } catch {
    return 'America/Chicago';
  }
}

export function useProgressStats(range: ProgressRange): ProgressState {
  const user = useAuthStore((s) => s.user);
  const { isPremium } = usePremium();
  const [stats, setStats] = useState<ProgressStats>({
    minutesRead: 0,
    streakDays: 0,
    wordsSaved: 0,
    wordsReviewed: 0,
    wordsLearned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<ProgressTrends | null>(null);
  const [timeline, setTimeline] = useState<ProgressTimeline | null>(null);

  const timeZone = useMemo(() => getDeviceTimezone(), []);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setStats({ minutesRead: 0, streakDays: 0, wordsSaved: 0, wordsReviewed: 0, wordsLearned: 0 });
      setTrends(null);
      setTimeline(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [next, trendSnapshot, timelineSnapshot] = await Promise.all([
        fetchProgressStats(user.id, range, timeZone),
        fetchProgressTrendSnapshot(user.id, range).catch(() => null),
        fetchProgressTimeline(user.id, range, timeZone).catch(() => null),
      ]);
      setStats(next);
      if (trendSnapshot) {
        setTrends({
          windowDays: trendSnapshot.windowDays,
          minutesRead: computeMetricTrend(
            next.minutesRead,
            trendSnapshot.previous.minutesRead
          ),
          wordsSaved: computeMetricTrend(
            next.wordsSaved,
            trendSnapshot.previous.wordsSaved
          ),
          wordsReviewed: computeMetricTrend(
            next.wordsReviewed,
            trendSnapshot.previous.wordsReviewed
          ),
        });
      } else {
        setTrends(null);
      }
      setTimeline(timelineSnapshot);
      track('progress_viewed', {
        range,
        is_premium: isPremium,
      });
    } catch (e: any) {
      setError(String(e?.message ?? 'failed_to_load_progress'));
    } finally {
      setLoading(false);
    }
  }, [isPremium, range, timeZone, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...stats,
    loading,
    error,
    trends,
    timeline,
    refresh,
  };
}
