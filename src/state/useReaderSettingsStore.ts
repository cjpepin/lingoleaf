/**
 * Reader settings (font, highlight, etc.)
 * Persisted in user_settings, loaded with useSettingsStore
 */

import { create } from 'zustand';

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 28;
export const FONT_SIZE_STEP = 2;
export const FONT_SIZE_DEFAULT = 16;

/** Valid font sizes in px, e.g. "14px" */
export const FONT_SIZES_PX = Array.from(
  { length: (28 - 10) / 2 + 1 },
  (_, i) => `${10 + i * 2}px`
) as readonly string[];
export const FONT_FAMILIES = ['inherit', 'Georgia', 'Palatino', 'Times New Roman', 'serif', 'sans-serif'] as const;
export const HIGHLIGHT_COLORS = [
  { value: 'mint', label: 'Mint', hex: '#6DD4A0' },
  { value: 'yellow', label: 'Yellow', hex: '#FFD54F' },
  { value: 'pink', label: 'Pink', hex: '#F48FB1' },
] as const;

export type FontSize = (typeof FONT_SIZES_PX)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]['value'];

interface ReaderSettingsStore {
  highlightOnTranslate: boolean;
  fontSize: FontSize;
  fontFamily: FontFamily;
  highlightColor: HighlightColor;
  setHighlightOnTranslate: (v: boolean) => void;
  setFontSize: (v: FontSize) => void;
  setFontFamily: (v: FontFamily) => void;
  setHighlightColor: (v: HighlightColor) => void;
  hydrateFromSettings: (s: {
    reader_highlight_on_translate?: boolean;
    reader_font_size?: string;
    reader_font_family?: string;
    reader_highlight_color?: string;
  } | null) => void;
}

const defaultFontSize: FontSize = `${FONT_SIZE_DEFAULT}px`;
const defaultFontFamily: FontFamily = 'inherit';
const defaultHighlightColor: HighlightColor = 'mint';

export const useReaderSettingsStore = create<ReaderSettingsStore>((set) => ({
  highlightOnTranslate: true,
  fontSize: defaultFontSize,
  fontFamily: defaultFontFamily,
  highlightColor: defaultHighlightColor,
  setHighlightOnTranslate: (v) => set({ highlightOnTranslate: v }),
  setFontSize: (v) => set({ fontSize: v }),
  setFontFamily: (v) => set({ fontFamily: v }),
  setHighlightColor: (v) => set({ highlightColor: v }),
  hydrateFromSettings: (s) => {
    let fs = s?.reader_font_size;
    if (fs && FONT_SIZES_PX.includes(fs as FontSize)) {
      // already px format
    } else if (fs && typeof fs === 'string' && /^\d+%$/.test(fs)) {
      // legacy percent -> px: 90%≈12px, 100%≈16px, 130%≈22px, snap to step
      const pct = parseInt(fs, 10) || 100;
      const px = Math.round(12 + (pct - 90) * 0.25);
      const snapped = Math.round((px - FONT_SIZE_MIN) / FONT_SIZE_STEP) * FONT_SIZE_STEP + FONT_SIZE_MIN;
      fs = `${Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, snapped))}px`;
      if (!FONT_SIZES_PX.includes(fs as FontSize)) fs = defaultFontSize;
    } else {
      fs = defaultFontSize;
    }
    return set({
      highlightOnTranslate: s?.reader_highlight_on_translate ?? true,
      fontSize: fs as FontSize,
      fontFamily: (FONT_FAMILIES.includes(s?.reader_font_family as FontFamily) ? s?.reader_font_family : defaultFontFamily) as FontFamily,
      highlightColor: (HIGHLIGHT_COLORS.some((c) => c.value === s?.reader_highlight_color) ? s?.reader_highlight_color : defaultHighlightColor) as HighlightColor,
    });
  },
}));
