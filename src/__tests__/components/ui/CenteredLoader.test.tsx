import React from 'react';
import { render } from '@testing-library/react-native';
import { CenteredLoader } from '@/components/ui/CenteredLoader';

describe('CenteredLoader', () => {
  it('renders without a message', () => {
    const { toJSON } = render(<CenteredLoader />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with a message', () => {
    const { getByText } = render(<CenteredLoader message="Loading books..." />);
    expect(getByText('Loading books...')).toBeTruthy();
  });

  it('does not show message text when no message prop', () => {
    const { queryByText } = render(<CenteredLoader />);
    expect(queryByText(/loading/i)).toBeNull();
  });
});
