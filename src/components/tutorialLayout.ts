/**
 * Viewport helpers for in-app tutorial walkthroughs.
 * Scales fixed layout from iPhone 16 Pro baseline (393×852) for portfolio embed (320×640).
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { isEmbedMode } from '@/demo/config';

export const TUTORIAL_BASE_WIDTH = 393;
export const TUTORIAL_BASE_HEIGHT = 852;

const TOOLTIP_HEIGHT_ESTIMATE = 150;
const TOOLTIP_HEIGHT_ESTIMATE_COMPACT = 120;

export function useTutorialViewport() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const scale = Math.min(width / TUTORIAL_BASE_WIDTH, height / TUTORIAL_BASE_HEIGHT, 1);
    const embed = isEmbedMode();
    const compact = embed || height < 720;
    const s = (px: number) => Math.round(px * scale);

    return { width, height, scale, compact, embed, s };
  }, [width, height]);
}

/** Bottom offset for the tutorial tooltip so it clears step-specific UI. */
export function tutorialTooltipBottom(
  step: number,
  height: number,
  s: (px: number) => number,
  compact: boolean,
): number {
  const minBottom = s(24);
  const navPanelHeight = height * (compact ? 0.48 : 0.55);
  const sheetHeight = s(compact ? 210 : 300);
  const tooltipHeight = compact ? TOOLTIP_HEIGHT_ESTIMATE_COMPACT : TOOLTIP_HEIGHT_ESTIMATE;
  const maxBottom = Math.max(minBottom, height - tooltipHeight - s(compact ? 72 : 96));

  const stepBottom: Record<number, number> = {
    3: sheetHeight + s(8),
    5: navPanelHeight + s(8),
  };

  const raw = stepBottom[step] ?? minBottom;
  return Math.min(Math.max(raw, minBottom), maxBottom);
}
