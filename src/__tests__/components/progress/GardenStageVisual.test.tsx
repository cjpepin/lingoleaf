import React from 'react';
import { render } from '@testing-library/react-native';
import { GardenStageVisual } from '@/components/progress/GardenStageVisual';

describe('GardenStageVisual', () => {
  it('renders seed stage without trunk/canopy', () => {
    const { getByTestId, queryByTestId, queryAllByTestId } = render(
      <GardenStageVisual stage="seed" freshness="fresh" />
    );

    expect(getByTestId('garden-visual-seed')).toBeTruthy();
    expect(getByTestId('garden-seed')).toBeTruthy();
    expect(queryByTestId('garden-trunk')).toBeNull();
    expect(queryAllByTestId('garden-canopy-leaf')).toHaveLength(0);
  });

  it('renders mature tree with full canopy and fruit accent', () => {
    const { getByTestId, queryAllByTestId } = render(
      <GardenStageVisual stage="mature_tree" freshness="fresh" />
    );

    expect(getByTestId('garden-visual-mature_tree')).toBeTruthy();
    expect(getByTestId('garden-trunk')).toBeTruthy();
    expect(getByTestId('garden-fruit')).toBeTruthy();
    expect(queryAllByTestId('garden-canopy-leaf').length).toBeGreaterThanOrEqual(14);
  });

  it('renders expanded high-tier stage visuals', () => {
    const { getByTestId, queryAllByTestId } = render(
      <GardenStageVisual stage="ancient_tree" freshness="fresh" />
    );

    expect(getByTestId('garden-visual-ancient_tree')).toBeTruthy();
    expect(getByTestId('garden-trunk')).toBeTruthy();
    expect(getByTestId('garden-fruit')).toBeTruthy();
    expect(queryAllByTestId('garden-canopy-leaf').length).toBeGreaterThanOrEqual(18);
  });
});
