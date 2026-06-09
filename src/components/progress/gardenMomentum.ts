import type { GardenSnapshot } from '@/supabase/queries';

export type GardenMomentumTone = 'success' | 'neutral' | 'warning' | 'danger';

export interface GardenMomentum {
  tone: GardenMomentumTone;
  inlineKey: string;
}

export function resolveGardenMomentum(snapshot: GardenSnapshot): GardenMomentum {
  if (snapshot.state.freshness === 'dead') {
    return {
      tone: 'danger',
      inlineKey: 'garden.status.deadInline',
    };
  }

  const goalMinutes = Math.max(1, Math.floor(snapshot.goalMinutes));
  const minutesToday = Math.max(0, Math.floor(snapshot.daily.reading_minutes));

  if (snapshot.daily.goal_completed || minutesToday >= goalMinutes) {
    return {
      tone: 'success',
      inlineKey: 'garden.status.congratsInline',
    };
  }

  if (minutesToday > 0) {
    return {
      tone: 'neutral',
      inlineKey: 'garden.status.keepGoingInline',
    };
  }

  return {
    tone: 'warning',
    inlineKey: 'garden.status.encourageInline',
  };
}
