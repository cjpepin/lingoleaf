import { normalizeText, validateSelectionLength, MAX_SELECTION_LENGTH } from '@/utils/normalize';

describe('normalizeText', () => {
  it('lowercases and trims input', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('handles accented characters', () => {
    expect(normalizeText('Café')).toBe('café');
  });
});

describe('validateSelectionLength', () => {
  it('returns true for text within limit', () => {
    expect(validateSelectionLength('hello', MAX_SELECTION_LENGTH)).toBe(true);
  });

  it('returns false for text exceeding limit', () => {
    const longText = 'a'.repeat(MAX_SELECTION_LENGTH + 1);
    expect(validateSelectionLength(longText, MAX_SELECTION_LENGTH)).toBe(false);
  });

  it('returns true for text at exactly the limit', () => {
    const text = 'a'.repeat(MAX_SELECTION_LENGTH);
    expect(validateSelectionLength(text, MAX_SELECTION_LENGTH)).toBe(true);
  });
});
