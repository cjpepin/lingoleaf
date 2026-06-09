import { useSettingsStore } from '@/state/useSettingsStore';
import { fetchUserSettings, upsertUserSettings } from '@/supabase/queries';

const mockHydrateReaderSettings = jest.fn();
const mockHydrateFlashcardSettings = jest.fn();
const mockHydrateAppLang = jest.fn();

jest.mock('@/supabase/queries', () => ({
  fetchUserSettings: jest.fn(),
  upsertUserSettings: jest.fn(),
}));

jest.mock('@/state/useReaderSettingsStore', () => ({
  useReaderSettingsStore: {
    getState: () => ({
      hydrateFromSettings: mockHydrateReaderSettings,
    }),
  },
}));

jest.mock('@/state/useFlashcardSettingsStore', () => ({
  useFlashcardSettingsStore: {
    getState: () => ({
      hydrateFromSettings: mockHydrateFlashcardSettings,
    }),
  },
}));

jest.mock('@/state/useAppLangStore', () => ({
  useAppLangStore: {
    getState: () => ({
      hydrateFromSettings: mockHydrateAppLang,
    }),
  },
}));

const mockedFetchUserSettings = fetchUserSettings as jest.MockedFunction<typeof fetchUserSettings>;
const mockedUpsertUserSettings = upsertUserSettings as jest.MockedFunction<typeof upsertUserSettings>;

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      targetLang: 'en',
      autoRemoveDownloadsAfterDays: 14,
      loading: false,
    });
    mockedFetchUserSettings.mockReset();
    mockedUpsertUserSettings.mockReset();
    mockHydrateReaderSettings.mockReset();
    mockHydrateFlashcardSettings.mockReset();
    mockHydrateAppLang.mockReset();
  });

  it('has a default targetLang', () => {
    const { targetLang } = useSettingsStore.getState();
    expect(typeof targetLang).toBe('string');
    expect(targetLang.length).toBeGreaterThan(0);
  });

  it('setTargetLang updates the language', () => {
    useSettingsStore.getState().setTargetLang('fr');
    expect(useSettingsStore.getState().targetLang).toBe('fr');
  });

  it('loadSettings hydrates local and dependent stores', async () => {
    mockedFetchUserSettings.mockResolvedValue({
      user_id: 'u1',
      target_lang: 'es',
      native_lang: 'en',
      known_langs: ['en'],
      goal_langs: ['es'],
      auto_remove_downloads_after_days: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const settings = await useSettingsStore.getState().loadSettings('u1');

    expect(settings?.target_lang).toBe('es');
    expect(useSettingsStore.getState().targetLang).toBe('es');
    expect(useSettingsStore.getState().autoRemoveDownloadsAfterDays).toBe(7);
    expect(mockHydrateReaderSettings).toHaveBeenCalledTimes(1);
    expect(mockHydrateFlashcardSettings).toHaveBeenCalledTimes(1);
    expect(mockHydrateAppLang).toHaveBeenCalledTimes(1);
  });

  it('saveSettings persists current target language', async () => {
    mockedUpsertUserSettings.mockResolvedValue({
      user_id: 'u1',
      target_lang: 'de',
      native_lang: 'en',
      known_langs: ['en'],
      goal_langs: ['de'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    useSettingsStore.getState().setTargetLang('de');

    await useSettingsStore.getState().saveSettings('u1');

    expect(mockedUpsertUserSettings).toHaveBeenCalledWith({
      user_id: 'u1',
      target_lang: 'de',
    });
  });
});
