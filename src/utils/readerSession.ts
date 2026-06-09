/**
 * readerSession
 *
 * Helpers for converting foreground-active time into bounded reading sessions.
 */

const MS_PER_MINUTE = 60 * 1000;
export const MAX_READING_SESSION_MINUTES = 180;

function clampActiveMs(rawActiveMs: number, maxMinutes: number): number {
  const safeActiveMs = Number.isFinite(rawActiveMs) ? Math.max(0, Math.floor(rawActiveMs)) : 0;
  const maxActiveMs = Math.max(1, Math.floor(maxMinutes)) * MS_PER_MINUTE;
  return Math.min(safeActiveMs, maxActiveMs);
}

export interface ReadingSessionWindow {
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  minutes: number;
}

export function buildReadingSessionWindow(
  endedAtMs: number,
  activeMs: number,
  maxMinutes: number = MAX_READING_SESSION_MINUTES
): ReadingSessionWindow {
  const safeEndedAtMs = Number.isFinite(endedAtMs) ? Math.floor(endedAtMs) : Date.now();
  const durationMs = clampActiveMs(activeMs, maxMinutes);
  return {
    startedAtMs: Math.max(0, safeEndedAtMs - durationMs),
    endedAtMs: safeEndedAtMs,
    durationMs,
    minutes: Math.floor(durationMs / MS_PER_MINUTE),
  };
}
