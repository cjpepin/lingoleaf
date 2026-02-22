import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppLangStore } from '@/state/useAppLangStore';

jest.mock('@/supabase/queries', () => ({
  upsertUserSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('useAppLangStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAppLangStore.setState({ appLang: 'en' });
  });

  it('defaults to English', () => {
    expect(useAppLangStore.getState().appLang).toBe('en');
  });

  it('setAppLang updates the language', () => {
    useAppLangStore.getState().setAppLang('fr');
    expect(useAppLangStore.getState().appLang).toBe('fr');
  });

  describe('hydrateFromSettings', () => {
    it('sets language from user settings', () => {
      useAppLangStore.getState().hydrateFromSettings({ app_lang: 'de' });
      expect(useAppLangStore.getState().appLang).toBe('de');
    });

    it('falls back to English for invalid language', () => {
      useAppLangStore.getState().hydrateFromSettings({ app_lang: 'xx' });
      expect(useAppLangStore.getState().appLang).toBe('en');
    });

    it('falls back to English for null settings', () => {
      useAppLangStore.getState().hydrateFromSettings(null);
      expect(useAppLangStore.getState().appLang).toBe('en');
    });
  });

  describe('hydrateFromStorage', () => {
    it('loads from AsyncStorage', async () => {
      await AsyncStorage.setItem('@lingoleaf:app_lang', 'ru');
      await useAppLangStore.getState().hydrateFromStorage();
      expect(useAppLangStore.getState().appLang).toBe('ru');
    });

    it('ignores invalid values in storage', async () => {
      await AsyncStorage.setItem('@lingoleaf:app_lang', 'invalid');
      await useAppLangStore.getState().hydrateFromStorage();
      expect(useAppLangStore.getState().appLang).toBe('en');
    });
  });

  describe('persist', () => {
    it('updates store and saves to AsyncStorage', async () => {
      await useAppLangStore.getState().persist(null, 'es');
      expect(useAppLangStore.getState().appLang).toBe('es');
      const stored = await AsyncStorage.getItem('@lingoleaf:app_lang');
      expect(stored).toBe('es');
    });

    it('calls upsertUserSettings when userId is provided', async () => {
      const { upsertUserSettings } = require('@/supabase/queries');
      await useAppLangStore.getState().persist('user123', 'fr');
      expect(upsertUserSettings).toHaveBeenCalledWith({
        user_id: 'user123',
        app_lang: 'fr',
      });
    });
  });
});
