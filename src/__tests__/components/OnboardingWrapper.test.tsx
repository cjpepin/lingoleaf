import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingWrapper } from '@/components/OnboardingWrapper';
import { upsertUserSettings } from '@/supabase/queries';
import { syncDailyGoalReminder } from '@/notifications/dailyGoalReminder';

const mockUseAuthStore = jest.fn();
const mockSetTargetLang = jest.fn();
let onboardingProps: any = null;

jest.mock('@/state/useAuthStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/state/useSettingsStore', () => ({
  useSettingsStore: (selector: (state: { setTargetLang: (lang: string) => void }) => unknown) =>
    selector({ setTargetLang: mockSetTargetLang }),
}));

jest.mock('@/supabase/queries', () => ({
  upsertUserSettings: jest.fn(),
}));

jest.mock('@/notifications/dailyGoalReminder', () => ({
  syncDailyGoalReminder: jest.fn(),
}));

jest.mock('@/components/OnboardingModal', () => ({
  OnboardingModal: (props: any) => {
    onboardingProps = props;
    return null;
  },
}));

const mockedUpsertUserSettings = upsertUserSettings as jest.MockedFunction<typeof upsertUserSettings>;
const mockedSyncDailyGoalReminder = syncDailyGoalReminder as jest.MockedFunction<typeof syncDailyGoalReminder>;

describe('OnboardingWrapper', () => {
  beforeEach(async () => {
    onboardingProps = null;
    mockUseAuthStore.mockReset();
    mockSetTargetLang.mockReset();
    mockedUpsertUserSettings.mockReset();
    mockedSyncDailyGoalReminder.mockReset();
    mockedSyncDailyGoalReminder.mockResolvedValue('scheduled');
    await AsyncStorage.clear();
  });

  it('shows onboarding when not completed', async () => {
    mockUseAuthStore.mockReturnValue({ user: null });

    render(
      <OnboardingWrapper>
        <Text>App</Text>
      </OnboardingWrapper>
    );

    await waitFor(() => {
      expect(onboardingProps?.visible).toBe(true);
    });
  });

  it('saves native language as target language on completion for signed-in users', async () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'u1' } });
    mockedUpsertUserSettings.mockResolvedValue({} as any);

    render(
      <OnboardingWrapper>
        <Text>App</Text>
      </OnboardingWrapper>
    );

    await waitFor(() => expect(onboardingProps?.visible).toBe(true));

    await act(async () => {
      await onboardingProps.onComplete({
        nativeLang: 'es',
        goalLangs: ['fr', 'de'],
        dailyGoalMinutes: 15,
        dailyWordsSavedGoal: 20,
        dailyWordsLearnedGoal: 7,
      });
    });

    expect(mockedUpsertUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        native_lang: 'es',
        daily_reading_goal_minutes: 15,
        daily_goal_reminder_enabled: true,
        daily_words_saved_goal: 20,
        daily_words_learned_goal: 7,
        target_lang: 'es',
      })
    );
    expect(mockedSyncDailyGoalReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        hour: 20,
        minute: 0,
        requestPermissionIfNeeded: false,
      })
    );
    expect(mockSetTargetLang).toHaveBeenCalledWith('es');
  });

  it('skip does not mark onboarding complete', async () => {
    mockUseAuthStore.mockReturnValue({ user: null });

    render(
      <OnboardingWrapper>
        <Text>App</Text>
      </OnboardingWrapper>
    );

    await waitFor(() => expect(onboardingProps?.visible).toBe(true));

    await act(async () => {
      await onboardingProps.onSkip();
    });

    const completed = await AsyncStorage.getItem('@lingoleaf:onboarding_completed');
    expect(completed).toBeNull();
    expect(onboardingProps?.visible).toBe(true);
  });

  it('normalizes sub-goals by removing duplicates and excluding primary goal', async () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'u1' } });
    mockedUpsertUserSettings.mockResolvedValue({} as any);

    render(
      <OnboardingWrapper>
        <Text>App</Text>
      </OnboardingWrapper>
    );

    await waitFor(() => expect(onboardingProps?.visible).toBe(true));

    await act(async () => {
      await onboardingProps.onComplete({
        nativeLang: 'en',
        goalLangs: ['es'],
        primaryGoal: 'words_saved',
        goalPriority: ['reading_minutes', 'words_saved', 'reading_minutes'],
        dailyGoalReminderEnabled: false,
      });
    });

    expect(mockedUpsertUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_goal: 'words_saved',
        goal_priority: ['reading_minutes'],
      })
    );
    expect(mockedSyncDailyGoalReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        title: 'LingoLeaf',
        requestPermissionIfNeeded: false,
      })
    );
    const reminderPayload = mockedSyncDailyGoalReminder.mock.calls[0]?.[0];
    expect(reminderPayload?.bodyOptions).toHaveLength(5);
  });

  it('still marks onboarding complete when reminder sync fails', async () => {
    mockUseAuthStore.mockReturnValue({ user: { id: 'u1' } });
    mockedUpsertUserSettings.mockResolvedValue({} as any);
    mockedSyncDailyGoalReminder.mockRejectedValue(new Error('notification failure'));

    render(
      <OnboardingWrapper>
        <Text>App</Text>
      </OnboardingWrapper>
    );

    await waitFor(() => expect(onboardingProps?.visible).toBe(true));

    await act(async () => {
      await onboardingProps.onComplete({
        nativeLang: 'es',
        goalLangs: ['fr'],
      });
    });

    await waitFor(() => {
      expect(onboardingProps?.visible).toBe(false);
    });
    expect(await AsyncStorage.getItem('@lingoleaf:onboarding_completed')).toBe('true');
    expect(await AsyncStorage.getItem('@lingoleaf:terms_accepted_at')).toBeTruthy();
  });
});
