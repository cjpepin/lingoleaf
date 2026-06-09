import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders the message', () => {
    const { getByText } = render(<EmptyState message="No books found" />);
    expect(getByText('No books found')).toBeTruthy();
  });

  it('handles long messages', () => {
    const long = 'A'.repeat(200);
    const { getByText } = render(<EmptyState message={long} />);
    expect(getByText(long)).toBeTruthy();
  });
});
