import { Alert } from 'react-native';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function promptAuthForPremium(
  openAuth: () => void,
  t: Translate
): void {
  Alert.alert(
    t('paywall.signInRequiredTitle'),
    `${t('paywall.signInRequiredPurchaseBody')}\n\n${t('settings.signInCreate')}`,
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signInCreate'),
        onPress: openAuth,
      },
    ]
  );
}
