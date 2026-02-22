import { useSettingsStore } from '@/state/useSettingsStore';

describe('useSettingsStore', () => {
  it('has a default targetLang', () => {
    const { targetLang } = useSettingsStore.getState();
    expect(typeof targetLang).toBe('string');
    expect(targetLang.length).toBeGreaterThan(0);
  });

  it('setTargetLang updates the language', () => {
    useSettingsStore.getState().setTargetLang('fr');
    expect(useSettingsStore.getState().targetLang).toBe('fr');
  });
});
