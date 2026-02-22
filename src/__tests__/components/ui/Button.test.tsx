import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Button label="Tap me" onPress={() => {}} />);
    expect(getByText('Tap me')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Tap" onPress={onPress} disabled />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders left icon when provided', () => {
    const { getByText } = render(
      <Button
        label="With Icon"
        onPress={() => {}}
        leftIcon={<Text>ICON</Text>}
      />
    );
    expect(getByText('ICON')).toBeTruthy();
    expect(getByText('With Icon')).toBeTruthy();
  });

  it('renders right icon when provided', () => {
    const { getByText } = render(
      <Button
        label="With Icon"
        onPress={() => {}}
        rightIcon={<Text>RIGHT</Text>}
      />
    );
    expect(getByText('RIGHT')).toBeTruthy();
  });

  it('renders all variants without crashing', () => {
    const variants = ['primary', 'surface', 'outline', 'danger'] as const;
    for (const variant of variants) {
      const { getByText } = render(
        <Button label={variant} onPress={() => {}} variant={variant} />
      );
      expect(getByText(variant)).toBeTruthy();
    }
  });

  it('renders both sizes without crashing', () => {
    const { getByText: get1 } = render(
      <Button label="Small" onPress={() => {}} size="sm" />
    );
    expect(get1('Small')).toBeTruthy();

    const { getByText: get2 } = render(
      <Button label="Medium" onPress={() => {}} size="md" />
    );
    expect(get2('Medium')).toBeTruthy();
  });
});
