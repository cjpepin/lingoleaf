/**
 * Jest test setup
 * Global mocks for React Native modules not available in test environment.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: 'BannerAd',
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { BANNER: 'ca-app-pub-test' },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0-test',
      ios: { buildNumber: '1' },
      android: { versionCode: 1 },
    },
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  })),
}));

jest.mock('@epubjs-react-native/core', () => ({
  Reader: 'Reader',
  useReader: jest.fn(() => ({
    goToLocation: jest.fn(),
    currentLocation: null,
    totalLocations: 0,
    toc: [],
    addAnnotation: jest.fn(),
    removeAnnotationByCfi: jest.fn(),
    injectJavascript: jest.fn(),
    goNext: jest.fn(),
    goPrevious: jest.fn(),
    atStart: false,
    atEnd: false,
    changeFontSize: jest.fn(),
    changeFontFamily: jest.fn(),
  })),
}));

jest.mock('@epubjs-react-native/expo-file-system', () => ({
  useFileSystem: jest.fn(),
}));
