import {
  resolveLocationIndex0,
  resolveLocationsReadyPage,
  resolveReadyPage,
  shouldFinishPageLoading,
  shouldDeferReaderMountForRemote,
} from '@/screens/reader/pageNumber';

describe('reader page number resolution', () => {
  it('does not force page 1 on ready while resume is pending', () => {
    expect(
      resolveReadyPage({
        locationIndex: null,
        hasInitialLocation: true,
        resumeConfirmed: false,
        fallbackCurrentPage: 0,
      })
    ).toBe(0);
  });

  it('keeps cached page while resume is pending', () => {
    expect(
      resolveReadyPage({
        locationIndex: null,
        hasInitialLocation: true,
        resumeConfirmed: false,
        fallbackCurrentPage: 82,
      })
    ).toBe(82);
  });

  it('uses location index when available on ready', () => {
    expect(
      resolveReadyPage({
        locationIndex: 14,
        hasInitialLocation: false,
        resumeConfirmed: true,
        fallbackCurrentPage: 0,
      })
    ).toBe(15);
  });

  it('supports string location indexes from reader payloads', () => {
    expect(
      resolveReadyPage({
        locationIndex: '27',
        hasInitialLocation: false,
        resumeConfirmed: true,
        fallbackCurrentPage: 0,
      })
    ).toBe(28);
  });

  it('avoids progress=0 fallback when progress fallback is disabled', () => {
    expect(
      resolveLocationIndex0({
        locationIndex: null,
        progress: 0,
        totalLocations: 400,
        allowProgressFallback: false,
      })
    ).toBeNull();
  });

  it('uses expected cached index when provided as fallback', () => {
    expect(
      resolveLocationIndex0({
        locationIndex: null,
        progress: 0,
        totalLocations: 400,
        allowProgressFallback: false,
        fallbackIndex0: 212,
      })
    ).toBe(212);
  });

  it('does not force page 1 in onLocationsReady while resume is pending', () => {
    expect(
      resolveLocationsReadyPage({
        storePage: 0,
        locationIndex: null,
        hasInitialLocation: true,
      })
    ).toBe(0);
  });

  it('keeps store page in onLocationsReady when already known', () => {
    expect(
      resolveLocationsReadyPage({
        storePage: 82,
        locationIndex: null,
        hasInitialLocation: true,
      })
    ).toBe(82);
  });

  it('uses location index in onLocationsReady when available', () => {
    expect(
      resolveLocationsReadyPage({
        storePage: 0,
        locationIndex: 13,
        hasInitialLocation: false,
      })
    ).toBe(14);
  });

  it('does not default to page 1 in onReady when page is still unknown', () => {
    expect(
      resolveReadyPage({
        locationIndex: null,
        hasInitialLocation: false,
        resumeConfirmed: true,
        fallbackCurrentPage: 0,
      })
    ).toBe(0);
  });

  it('keeps page unknown in onLocationsReady until a real location is reported', () => {
    expect(
      resolveLocationsReadyPage({
        storePage: 0,
        locationIndex: null,
        hasInitialLocation: false,
      })
    ).toBe(0);
  });

  it('defers reader mount when remote resume may still override initial page', () => {
    expect(
      shouldDeferReaderMountForRemote({
        hasLocalCfi: false,
        hasUser: true,
        readingProgressEnabled: true,
      })
    ).toBe(true);
  });

  it('does not defer reader mount when local cache already exists or remote fetch is unavailable', () => {
    expect(
      shouldDeferReaderMountForRemote({
        hasLocalCfi: true,
        hasUser: true,
        readingProgressEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldDeferReaderMountForRemote({
        hasLocalCfi: false,
        hasUser: false,
        readingProgressEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldDeferReaderMountForRemote({
        hasLocalCfi: false,
        hasUser: true,
        readingProgressEnabled: false,
      })
    ).toBe(false);
  });

  it('finishes page loading once current and total pages are both known', () => {
    expect(
      shouldFinishPageLoading({
        hasResolvedCurrentPage: true,
        totalPages: 320,
        pageLoading: true,
      })
    ).toBe(true);
  });

  it('keeps page loading active until the current page is confirmed and total pages are known', () => {
    expect(
      shouldFinishPageLoading({
        hasResolvedCurrentPage: true,
        totalPages: 0,
        pageLoading: true,
      })
    ).toBe(false);
    expect(
      shouldFinishPageLoading({
        hasResolvedCurrentPage: false,
        totalPages: 320,
        pageLoading: true,
      })
    ).toBe(false);
    expect(
      shouldFinishPageLoading({
        hasResolvedCurrentPage: true,
        totalPages: 320,
        pageLoading: false,
      })
    ).toBe(false);
  });
});
