interface ResolveReadyPageParams {
  locationIndex: unknown;
  hasInitialLocation: boolean;
  resumeConfirmed: boolean;
  fallbackCurrentPage: number;
}

interface ResolveLocationIndexParams {
  locationIndex: unknown;
  progress: unknown;
  totalLocations: unknown;
  allowProgressFallback: boolean;
  fallbackIndex0?: number | null;
}

interface ResolveLocationsReadyPageParams {
  storePage: number;
  locationIndex: unknown;
  hasInitialLocation: boolean;
}

interface ShouldDeferReaderMountForRemoteParams {
  hasLocalCfi: boolean;
  hasUser: boolean;
  readingProgressEnabled: boolean;
}

interface ShouldFinishPageLoadingParams {
  hasResolvedCurrentPage: boolean;
  totalPages: unknown;
  pageLoading: boolean;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNonNegativeInt(value: unknown): number | null {
  const n = toFiniteNumber(value);
  if (n == null || n < 0) return null;
  return Math.floor(n);
}

function toPositiveInt(value: unknown): number | null {
  const n = toFiniteNumber(value);
  if (n == null || n <= 0) return null;
  return Math.floor(n);
}

export function resolveReadyPage(params: ResolveReadyPageParams): number {
  const fallbackCurrentPage =
    typeof params.fallbackCurrentPage === 'number' &&
    Number.isFinite(params.fallbackCurrentPage) &&
    params.fallbackCurrentPage > 1
      ? Math.floor(params.fallbackCurrentPage)
      : 0;

  // While resume is pending, preserve a known cached page instead of flashing 0/1.
  if (params.hasInitialLocation && !params.resumeConfirmed) {
    return fallbackCurrentPage > 0 ? fallbackCurrentPage : 0;
  }

  const idx0 = toNonNegativeInt(params.locationIndex);
  if (idx0 != null) return idx0 + 1;

  if (params.fallbackCurrentPage > 0) return Math.floor(params.fallbackCurrentPage);

  // Unknown page should stay in loading state until a reliable location arrives.
  return 0;
}

export function resolveLocationIndex0(params: ResolveLocationIndexParams): number | null {
  const idx0 = toNonNegativeInt(params.locationIndex);
  if (idx0 != null) return idx0;

  if (typeof params.fallbackIndex0 === 'number' && Number.isFinite(params.fallbackIndex0) && params.fallbackIndex0 >= 0) {
    return Math.floor(params.fallbackIndex0);
  }

  if (!params.allowProgressFallback) return null;

  const progress = toFiniteNumber(params.progress);
  const total = toPositiveInt(params.totalLocations);
  if (progress == null || total == null) return null;
  if (progress <= 0) return null;

  return Math.min(total - 1, Math.floor((progress / 100) * total));
}

export function resolveLocationsReadyPage(params: ResolveLocationsReadyPageParams): number {
  const storePage = toPositiveInt(params.storePage) ?? 0;
  if (storePage > 0) return storePage;

  const idx0 = toNonNegativeInt(params.locationIndex);
  if (idx0 != null) return idx0 + 1;

  // Keep loading until the reader reports a real current location.
  return 0;
}

export function shouldDeferReaderMountForRemote(
  params: ShouldDeferReaderMountForRemoteParams
): boolean {
  return !params.hasLocalCfi && params.hasUser && params.readingProgressEnabled;
}

export function shouldFinishPageLoading(
  params: ShouldFinishPageLoadingParams
): boolean {
  if (!params.pageLoading) return false;
  return params.hasResolvedCurrentPage && toPositiveInt(params.totalPages) != null;
}
