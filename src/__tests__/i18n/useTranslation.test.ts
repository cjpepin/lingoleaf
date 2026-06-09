import { renderHook } from '@testing-library/react-native';
import { useTranslation } from '@/i18n/useTranslation';
import { useAppLangStore } from '@/state/useAppLangStore';

describe('useTranslation', () => {
  beforeEach(() => {
    useAppLangStore.setState({ appLang: 'en' });
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useTranslation());
    expect(typeof result.current).toBe('function');
  });

  it('translates a key for the current language', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current('app.title')).toBe('LingoLeaf');
  });

  it('uses the current app language', () => {
    useAppLangStore.setState({ appLang: 'es' });
    const { result } = renderHook(() => useTranslation());
    expect(result.current('app.title')).toBe('LingoLeaf');
  });

  it('supports parameter interpolation', () => {
    const { result } = renderHook(() => useTranslation());
    const text = result.current('reader.pagesLeft', { n: 3 });
    expect(text).toContain('3');
  });
});
