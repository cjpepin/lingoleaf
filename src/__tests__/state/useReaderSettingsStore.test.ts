import {
  useReaderSettingsStore,
  FONT_SIZES_PX,
  FONT_SIZE_DEFAULT,
  FONT_FAMILIES,
  HIGHLIGHT_COLORS,
} from '@/state/useReaderSettingsStore';

describe('useReaderSettingsStore', () => {
  beforeEach(() => {
    useReaderSettingsStore.setState({
      highlightOnTranslate: true,
      fontSize: `${FONT_SIZE_DEFAULT}px`,
      fontFamily: 'inherit',
      highlightColor: 'mint',
    });
  });

  it('has sensible defaults', () => {
    const state = useReaderSettingsStore.getState();
    expect(state.highlightOnTranslate).toBe(true);
    expect(state.fontSize).toBe('16px');
    expect(state.fontFamily).toBe('inherit');
    expect(state.highlightColor).toBe('mint');
  });

  it('setFontSize updates font size', () => {
    useReaderSettingsStore.getState().setFontSize('20px');
    expect(useReaderSettingsStore.getState().fontSize).toBe('20px');
  });

  it('setFontFamily updates font family', () => {
    useReaderSettingsStore.getState().setFontFamily('Georgia');
    expect(useReaderSettingsStore.getState().fontFamily).toBe('Georgia');
  });

  it('setHighlightColor updates color', () => {
    useReaderSettingsStore.getState().setHighlightColor('yellow');
    expect(useReaderSettingsStore.getState().highlightColor).toBe('yellow');
  });

  it('setHighlightOnTranslate toggles the flag', () => {
    useReaderSettingsStore.getState().setHighlightOnTranslate(false);
    expect(useReaderSettingsStore.getState().highlightOnTranslate).toBe(false);
  });

  describe('hydrateFromSettings', () => {
    it('applies valid settings', () => {
      useReaderSettingsStore.getState().hydrateFromSettings({
        reader_highlight_on_translate: false,
        reader_font_size: '22px',
        reader_font_family: 'Georgia',
        reader_highlight_color: 'pink',
      });
      const state = useReaderSettingsStore.getState();
      expect(state.highlightOnTranslate).toBe(false);
      expect(state.fontSize).toBe('22px');
      expect(state.fontFamily).toBe('Georgia');
      expect(state.highlightColor).toBe('pink');
    });

    it('falls back to defaults for invalid font size', () => {
      useReaderSettingsStore.getState().hydrateFromSettings({
        reader_font_size: '99px',
      });
      expect(useReaderSettingsStore.getState().fontSize).toBe('16px');
    });

    it('converts legacy percent format to px', () => {
      useReaderSettingsStore.getState().hydrateFromSettings({
        reader_font_size: '100%',
      });
      const fs = useReaderSettingsStore.getState().fontSize;
      expect(FONT_SIZES_PX).toContain(fs);
    });

    it('falls back to defaults for null settings', () => {
      useReaderSettingsStore.getState().hydrateFromSettings(null);
      const state = useReaderSettingsStore.getState();
      expect(state.fontSize).toBe('16px');
      expect(state.fontFamily).toBe('inherit');
      expect(state.highlightColor).toBe('mint');
    });

    it('rejects unknown font family', () => {
      useReaderSettingsStore.getState().hydrateFromSettings({
        reader_font_family: 'Comic Sans',
      });
      expect(useReaderSettingsStore.getState().fontFamily).toBe('inherit');
    });

    it('rejects unknown highlight color', () => {
      useReaderSettingsStore.getState().hydrateFromSettings({
        reader_highlight_color: 'neon',
      });
      expect(useReaderSettingsStore.getState().highlightColor).toBe('mint');
    });
  });

  it('exports expected constants', () => {
    expect(FONT_SIZES_PX.length).toBeGreaterThan(0);
    expect(FONT_FAMILIES.length).toBeGreaterThan(0);
    expect(HIGHLIGHT_COLORS.length).toBeGreaterThan(0);
  });
});
