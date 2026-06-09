import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/analytics/client';
import { fetchGardenSnapshot, type GardenSnapshot } from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';

interface UseGardenStateOptions {
  placement?: string;
}

interface UseGardenStateResult {
  snapshot: GardenSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TRACK_DEDUP_MS = 5_000;

export function useGardenState(options?: UseGardenStateOptions): UseGardenStateResult {
  const user = useAuthStore((s) => s.user);
  const [snapshot, setSnapshot] = useState<GardenSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastTrackTs = useRef(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await fetchGardenSnapshot(user.id);
      setSnapshot(next);
      const now = Date.now();
      if (options?.placement && now - lastTrackTs.current > TRACK_DEDUP_MS) {
        lastTrackTs.current = now;
        track('garden_viewed', {
          placement: options.placement,
          stage: next.state.stage,
          streak_days: next.state.streak_days,
        });
      }
    } catch (e: any) {
      setError(String(e?.message ?? 'failed_to_load_garden_state'));
    } finally {
      setLoading(false);
    }
  }, [options?.placement, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
}
