import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { WebDemoDeviceFrame } from '@/demo/WebDemoDeviceFrame';

jest.mock('@/demo/config', () => ({
  isEmbedMode: jest.fn(() => false),
  isWebDemo: jest.fn(() => false),
}));

describe('WebDemoDeviceFrame', () => {
  it('passes through children outside web demo mode', () => {
    const { getByText } = render(
      <WebDemoDeviceFrame>
        <Text>Inside app</Text>
      </WebDemoDeviceFrame>
    );

    expect(getByText('Inside app')).toBeTruthy();
  });
});
