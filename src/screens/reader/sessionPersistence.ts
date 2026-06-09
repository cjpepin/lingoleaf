/**
 * sessionPersistence
 *
 * Helpers for converting an active reader segment into a persistable payload.
 */

import { buildReadingSessionWindow } from '@/utils/readerSession';

export interface PersistableReadingSegment {
  startedAtIso: string;
  endedAtIso: string;
  minutes: number;
  durationMs: number;
}

interface BuildPersistableReadingSegmentParams {
  activeDurationMs: number;
  endedAtMs: number;
}

export function buildPersistableReadingSegment(
  params: BuildPersistableReadingSegmentParams
): PersistableReadingSegment | null {
  const sessionWindow = buildReadingSessionWindow(params.endedAtMs, params.activeDurationMs);
  if (sessionWindow.minutes <= 0) return null;

  return {
    startedAtIso: new Date(sessionWindow.startedAtMs).toISOString(),
    endedAtIso: new Date(sessionWindow.endedAtMs).toISOString(),
    minutes: sessionWindow.minutes,
    durationMs: sessionWindow.durationMs,
  };
}
