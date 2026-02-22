import {
  useFlashcardSettingsStore,
  AGAIN_CARDS_MIN,
  AGAIN_CARDS_MAX,
  AGAIN_CARDS_DEFAULT,
  INTERVAL_HARD_MIN,
  INTERVAL_HARD_MAX,
  INTERVAL_HARD_DEFAULT,
  INTERVAL_GOOD_DEFAULT,
  INTERVAL_EASY_DEFAULT,
  MULTIPLIER_MIN,
  MULTIPLIER_MAX,
  MULTIPLIER_DEFAULT,
} from '@/state/useFlashcardSettingsStore';

describe('useFlashcardSettingsStore', () => {
  beforeEach(() => {
    useFlashcardSettingsStore.setState({
      againCards: AGAIN_CARDS_DEFAULT,
      intervalHardMin: INTERVAL_HARD_DEFAULT,
      intervalGoodMin: INTERVAL_GOOD_DEFAULT,
      intervalEasyMin: INTERVAL_EASY_DEFAULT,
      multiplier: MULTIPLIER_DEFAULT,
      preferredStudyMethod: 'spaced',
    });
  });

  it('has sensible defaults', () => {
    const state = useFlashcardSettingsStore.getState();
    expect(state.againCards).toBe(AGAIN_CARDS_DEFAULT);
    expect(state.multiplier).toBe(MULTIPLIER_DEFAULT);
    expect(state.preferredStudyMethod).toBe('spaced');
  });

  it('clamps againCards to valid range', () => {
    useFlashcardSettingsStore.getState().setAgainCards(0);
    expect(useFlashcardSettingsStore.getState().againCards).toBe(AGAIN_CARDS_MIN);
    useFlashcardSettingsStore.getState().setAgainCards(100);
    expect(useFlashcardSettingsStore.getState().againCards).toBe(AGAIN_CARDS_MAX);
  });

  it('clamps intervalHardMin to valid range', () => {
    useFlashcardSettingsStore.getState().setIntervalHardMin(1);
    expect(useFlashcardSettingsStore.getState().intervalHardMin).toBe(INTERVAL_HARD_MIN);
    useFlashcardSettingsStore.getState().setIntervalHardMin(9999);
    expect(useFlashcardSettingsStore.getState().intervalHardMin).toBe(INTERVAL_HARD_MAX);
  });

  it('clamps multiplier to valid range', () => {
    useFlashcardSettingsStore.getState().setMultiplier(0.5);
    expect(useFlashcardSettingsStore.getState().multiplier).toBe(MULTIPLIER_MIN);
    useFlashcardSettingsStore.getState().setMultiplier(10);
    expect(useFlashcardSettingsStore.getState().multiplier).toBe(MULTIPLIER_MAX);
  });

  it('setPreferredStudyMethod switches method', () => {
    useFlashcardSettingsStore.getState().setPreferredStudyMethod('free');
    expect(useFlashcardSettingsStore.getState().preferredStudyMethod).toBe('free');
  });

  it('getSettings returns current interval settings', () => {
    const settings = useFlashcardSettingsStore.getState().getSettings();
    expect(settings).toEqual({
      againCards: AGAIN_CARDS_DEFAULT,
      intervalHardMin: INTERVAL_HARD_DEFAULT,
      intervalGoodMin: INTERVAL_GOOD_DEFAULT,
      intervalEasyMin: INTERVAL_EASY_DEFAULT,
      multiplier: MULTIPLIER_DEFAULT,
    });
  });

  describe('hydrateFromSettings', () => {
    it('applies valid settings', () => {
      useFlashcardSettingsStore.getState().hydrateFromSettings({
        flashcard_again_cards: 3,
        flashcard_interval_hard_min: 30,
        flashcard_interval_multiplier: 2.5,
        flashcard_preferred_study_method: 'free',
      });
      const state = useFlashcardSettingsStore.getState();
      expect(state.againCards).toBe(3);
      expect(state.intervalHardMin).toBe(30);
      expect(state.multiplier).toBe(2.5);
      expect(state.preferredStudyMethod).toBe('free');
    });

    it('clamps out-of-range values', () => {
      useFlashcardSettingsStore.getState().hydrateFromSettings({
        flashcard_again_cards: 999,
        flashcard_interval_multiplier: 0.1,
      });
      const state = useFlashcardSettingsStore.getState();
      expect(state.againCards).toBe(AGAIN_CARDS_MAX);
      expect(state.multiplier).toBe(MULTIPLIER_MIN);
    });

    it('uses defaults for null settings', () => {
      useFlashcardSettingsStore.getState().hydrateFromSettings(null);
      expect(useFlashcardSettingsStore.getState().againCards).toBe(AGAIN_CARDS_DEFAULT);
    });

    it('defaults to spaced for unknown study method', () => {
      useFlashcardSettingsStore.getState().hydrateFromSettings({
        flashcard_preferred_study_method: 'unknown',
      });
      expect(useFlashcardSettingsStore.getState().preferredStudyMethod).toBe('spaced');
    });
  });
});
