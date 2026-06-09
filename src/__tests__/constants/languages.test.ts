import { LANGUAGES } from '@/constants/languages';

describe('LANGUAGES', () => {
  it('each entry has a code and name', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.code.length).toBeLessThanOrEqual(3);
    }
  });

  it('contains English', () => {
    expect(LANGUAGES.find((l) => l.code === 'en')).toBeDefined();
  });

  it('has unique codes', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has unique names', () => {
    const names = LANGUAGES.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
