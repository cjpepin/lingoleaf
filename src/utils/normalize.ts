/**
 * Text normalization utilities
 * Used for cache keys and term matching
 */

export function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function validateSelectionLength(text: string, maxLength: number = 40): boolean {
  return text.trim().length <= maxLength;
}

export const MAX_SELECTION_LENGTH = 100;

