import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Snackbar } from '@/components/Snackbar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

describe('Snackbar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { toJSON } = render(
      <Snackbar visible={false} message="Test" />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the message when visible', () => {
    const { getByText } = render(
      <Snackbar visible={true} message="Saved successfully!" type="success" />
    );
    act(() => { jest.advanceTimersByTime(100); });
    expect(getByText('Saved successfully!')).toBeTruthy();
  });

  it('renders with error type', () => {
    const { getByText } = render(
      <Snackbar visible={true} message="Something failed" type="error" />
    );
    act(() => { jest.advanceTimersByTime(100); });
    expect(getByText('Something failed')).toBeTruthy();
  });

  it('renders in passThrough mode', () => {
    const { getByText } = render(
      <Snackbar visible={true} message="Pass through" passThrough={true} />
    );
    act(() => { jest.advanceTimersByTime(100); });
    expect(getByText('Pass through')).toBeTruthy();
  });

  it('calls onDismiss after duration elapses', () => {
    const onDismiss = jest.fn();
    render(
      <Snackbar visible={true} message="Auto dismiss" duration={2000} onDismiss={onDismiss} />
    );
    act(() => { jest.advanceTimersByTime(1999); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(10); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
