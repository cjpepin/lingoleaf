import { shouldShowBlockingLibraryLoader } from '@/screens/library/loading';

describe('shouldShowBlockingLibraryLoader', () => {
  it('returns true for initial blocking load', () => {
    expect(shouldShowBlockingLibraryLoader(true, 0, false)).toBe(true);
  });

  it('returns false when books are already present', () => {
    expect(shouldShowBlockingLibraryLoader(true, 5, false)).toBe(false);
  });

  it('returns false during pull-to-refresh', () => {
    expect(shouldShowBlockingLibraryLoader(true, 0, true)).toBe(false);
  });
});
