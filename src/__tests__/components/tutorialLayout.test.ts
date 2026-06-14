import { tutorialTooltipBottom } from '@/components/tutorialLayout';

describe('tutorialTooltipBottom', () => {
  const s = (px: number) => px;

  it('keeps tooltip inside a short embed viewport on navigation step', () => {
    const height = 640;
    const bottom = tutorialTooltipBottom(5, height, s, true);
    const tooltipTop = height - bottom - 120;

    expect(bottom).toBeLessThanOrEqual(height - 120 - 72);
    expect(tooltipTop).toBeGreaterThanOrEqual(0);
  });

  it('clears the translate sheet on step 3', () => {
    const height = 640;
    const bottom = tutorialTooltipBottom(3, height, s, true);

    expect(bottom).toBeGreaterThan(210);
  });

  it('uses a small default inset on intro steps', () => {
    expect(tutorialTooltipBottom(0, 852, s, false)).toBe(24);
  });
});
