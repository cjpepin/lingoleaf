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

  it('contains recently-added i18n keys across all locales', () => {
    const requiredKeys = [
      'auth.migrationFailedTitle',
      'auth.migrationFailedBody',
      'paywall.signInRequiredTitle',
      'paywall.signInRequiredPurchaseBody',
      'paywall.signInRequiredRestoreBody',
      'study.exportCompleteTitle',
      'study.exportCompleteBody',
      'study.exportFailed',
      'study.loadFailed',
      'study.loadWordsFailed',
      'study.moveFailed',
      'bookDetails.subjectsPrefix',
      'bookDetails.loadFailed',
      'bookDetails.openFailed',
      'bookDetails.saveForLaterFailed',
      'bookDetails.notFound',
      'reader.bookLoadFailed',
      'history.signInPrompt',
      'nav.myBooks',
      'history.myBooks',
      'history.tabHistory',
      'history.tabSaved',
      'history.browseLibrary',
      'history.noSavedBooks',
      'auth.forgotPassword',
      'auth.enterEmailForReset',
      'auth.resetSent',
      'auth.resetFailed',
      'auth.sendingReset',
      'profile.changePassword',
      'profile.changePasswordDescription',
      'profile.newPassword',
      'profile.confirmNewPassword',
      'profile.updatePassword',
      'profile.updatingPassword',
      'profile.passwordUpdated',
      'profile.passwordUpdateFailed',
      'profile.sendResetEmail',
      'profile.sendingReset',
      'profile.passwordResetSent',
      'profile.passwordResetFailed',
      'profile.passwordResetMissingEmail',
    ];

    for (const lang of LANGS) {
      for (const key of requiredKeys) {
        expect(translations[lang][key]).toBeDefined();
      }
    }
  });
});
