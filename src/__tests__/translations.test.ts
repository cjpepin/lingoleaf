import { translations, t, type AppLang } from '@/i18n/translations';

const LANGS: AppLang[] = ['en', 'es', 'de', 'fr', 'ru'];

describe('translations', () => {
  it('has entries for all supported languages', () => {
    for (const lang of LANGS) {
      expect(translations[lang]).toBeDefined();
      expect(Object.keys(translations[lang]).length).toBeGreaterThan(0);
    }
  });

  it('all non-English langs have at least 100% of English keys', () => {
    const enKeys = Object.keys(translations.en);
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      const langKeys = new Set(Object.keys(translations[lang]));
      const missing = enKeys.filter((k) => !langKeys.has(k));
      const coverage = ((enKeys.length - missing.length) / enKeys.length) * 100;
      if (missing.length > 0) {
        console.warn(`[${lang}] missing ${missing.length} keys: ${missing.join(', ')}`);
      }
      expect(coverage).toBeGreaterThanOrEqual(100);
    }
  });

  it('t() returns the correct string for a key', () => {
    expect(t('en', 'app.title')).toBe('LingoLeaf');
  });

  it('t() interpolates params', () => {
    const result = t('en', 'reader.pagesLeft', { n: 5 });
    expect(result).toContain('5');
  });

  it('t() falls back to English for missing keys', () => {
    const result = t('es', 'nonexistent.key.that.does.not.exist');
    expect(result).toBe('nonexistent.key.that.does.not.exist');
  });
});
