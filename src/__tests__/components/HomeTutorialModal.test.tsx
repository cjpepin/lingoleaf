import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HomeTutorialModal } from '@/components/HomeTutorialModal';

jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

describe('HomeTutorialModal', () => {
  it('shows step copy and advances to next step', () => {
    const { getByText, getAllByText } = render(
      <HomeTutorialModal visible onComplete={() => {}} onSkip={() => {}} />
    );

    expect(getByText('Home overview')).toBeTruthy();
    fireEvent.press(getByText('Next'));
    expect(getAllByText('Jump back in').length).toBeGreaterThan(0);
  });
});
