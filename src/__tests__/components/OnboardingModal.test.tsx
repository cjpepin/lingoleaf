import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OnboardingModal } from '@/components/OnboardingModal';
import { requestDailyGoalReminderPermission } from '@/notifications/dailyGoalReminder';

jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

jest.mock('@/notifications/dailyGoalReminder', () => ({
  requestDailyGoalReminderPermission: jest.fn(),
}));

const mockedRequestDailyGoalReminderPermission =
  requestDailyGoalReminderPermission as jest.MockedFunction<typeof requestDailyGoalReminderPermission>;

async function pressText(getByText: (text: string) => any, text: string): Promise<void> {
  await act(async () => {
    fireEvent.press(getByText(text));
  });
}

async function advanceToGoalStep(getByText: (text: string) => any): Promise<void> {
  await pressText(getByText, 'Next');
  await pressText(getByText, 'Next');
  await pressText(getByText, 'Spanish');
  await pressText(getByText, 'Next');
  await waitFor(() => expect(getByText('Choose your goal focus')).toBeTruthy());
}

async function advanceToFeatureRequestStep(getByText: (text: string) => any): Promise<void> {
  await advanceToGoalStep(getByText);
  await pressText(getByText, 'Next');
  await pressText(getByText, 'Next');
  await pressText(getByText, 'Next');
  await pressText(getByText, 'Next');
  await waitFor(() => expect(getByText('Help shape LingoLeaf')).toBeTruthy());
}

describe('OnboardingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequestDailyGoalReminderPermission.mockResolvedValue('granted');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows cap messaging when a goal reaches or exceeds its limit', async () => {
    const { getAllByDisplayValue, getByText } = render(
      <OnboardingModal visible onComplete={() => {}} onSkip={() => {}} />
    );

    await advanceToGoalStep(getByText);

    const readingGoalInput = getAllByDisplayValue('10')[0];
    fireEvent.changeText(readingGoalInput, '99');
    fireEvent(readingGoalInput, 'blur');

    expect(getByText('To reduce burnout, we have capped certain goal limits.')).toBeTruthy();
  });

  it('shows feature request follow-up copy and requests notification permission on the reminder step', async () => {
    const { getByText } = render(
      <OnboardingModal visible onComplete={() => {}} onSkip={() => {}} />
    );

    await advanceToFeatureRequestStep(getByText);

    expect(getByText('This will also be available later in your profile page.')).toBeTruthy();
    expect(mockedRequestDailyGoalReminderPermission).toHaveBeenCalledTimes(1);
  });
});
