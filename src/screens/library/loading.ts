export function shouldShowBlockingLibraryLoader(
  loading: boolean,
  bookCount: number,
  refreshing: boolean
): boolean {
  return loading && bookCount === 0 && !refreshing;
}
