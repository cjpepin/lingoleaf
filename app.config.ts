import type { ExpoConfig, ConfigContext } from 'expo/config';

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosAppId = env('EXPO_PUBLIC_ADMOB_IOS_APP_ID', 'ca-app-pub-3940256099942544~1458002511');
  const androidAppId = env('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID', 'ca-app-pub-3940256099942544~3347511713');

  return {
    ...config,
    // Ensure required ExpoConfig fields are always present for type-safety.
    name: config.name ?? 'LinguaLeaf',
    slug: config.slug ?? 'lingualeaf',
    version: config.version ?? '1.0.0',
    scheme: config.scheme ?? 'lingualeaf',
    ios: {
      ...(config.ios ?? {}),
      infoPlist: {
        ...((config.ios as any)?.infoPlist ?? {}),
        // Belt-and-suspenders: AdMob iOS SDK requires this to be set or it will crash.
        GADApplicationIdentifier: iosAppId,
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      'expo-apple-authentication',
      [
        'react-native-google-mobile-ads',
        {
          // Expo config plugin expects camelCase keys.
          iosAppId,
          androidAppId,
        },
      ],
    ],
  };
};


