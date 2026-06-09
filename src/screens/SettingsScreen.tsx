/**
 * SettingsScreen
 * App settings including app language
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useAppLangStore, APP_LANGS } from '@/state/useAppLangStore';
import type { AppLangCode } from '@/state/useAppLangStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { checkIsAdmin } from '@/supabase/queries';
import { Button } from '@/components/ui/Button';
import { isOptedOut, optIn, optOut } from '@/analytics/client';
import { usePremium } from '@/premium/PremiumProvider';
import { LEGAL_URLS } from '@/constants/legal';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import { usePremiumGate } from '@/premium/usePremiumGate';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isGuest } = useAuthStore();
  const { appLang, persist } = useAppLangStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const t = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [analyticsOptedOut, setAnalyticsOptedOut] = useState(false);
  const { isPremium, restore } = usePremium();
  const { openPaywallOrAuth } = usePremiumGate();
  const { goalMinutes, setGoalMinutes } = useDailyGoal();

  useEffect(() => {
    if (user) {
      loadSettings(user.id);
      logger.info('Checking admin status for user:', user.id);
      checkIsAdmin(user.id).then((result) => setIsAdmin(result)).catch((error) => {
        logger.error('Failed to check admin status', error);
      });
    }
    setAnalyticsOptedOut(isOptedOut());
  }, [user, loadSettings]);

  const handleAdminPress = () => {
    navigation.navigate('Admin');
  };

  const handleSetLang = async (lang: AppLangCode) => {
    await persist(user?.id ?? null, lang);
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch((err) => {
      logger.error('Failed to open URL', err);
    });
  };

  const handleManageSubscription = () => {
    handleOpenUrl(LEGAL_URLS.iosManageSubscriptions);
  };

  const handleRequestRefund = () => {
    handleOpenUrl(LEGAL_URLS.iosRefunds);
  };

  const handleToggleAnalytics = async () => {
    if (analyticsOptedOut) {
      await optIn();
      setAnalyticsOptedOut(false);
      return;
    }
    await optOut();
    setAnalyticsOptedOut(true);
  };

  const handleRestorePress = async () => {
    const outcome = await restore('settings');
    if (outcome === 'success') {
      Alert.alert(t('paywall.alert.restoredTitle'), t('paywall.alert.restoredBody'));
      return;
    }
    if (outcome === 'error') {
      Alert.alert(t('paywall.alert.unavailableTitle'), t('paywall.alert.unavailableBody'));
      return;
    }
    Alert.alert(t('paywall.alert.nothingToRestoreTitle'), t('paywall.alert.nothingToRestoreBody'));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appLanguage')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.appLanguageDescription')}</Text>
        <View style={styles.langRow}>
          {APP_LANGS.map((code) => (
            <TouchableOpacity
              key={code}
              style={[styles.langButton, appLang === code && styles.langButtonSelected]}
              onPress={() => handleSetLang(code)}
            >
              <Text style={[styles.langButtonText, appLang === code && styles.langButtonTextSelected]}>
                {t('language.' + code)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        {isGuest ? (
          <>
            <Text style={styles.sectionDescription}>{t('settings.guestDescription')}</Text>
            <Button label={t('settings.signInCreate')} variant="primary" style={styles.rectButton} onPress={() => navigation.navigate('Auth')} />
          </>
        ) : (
          <Text style={styles.sectionDescription}>{t('settings.signedIn')}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.dailyReadingGoalTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.dailyReadingGoalDescription')}</Text>
        <View style={styles.goalRow}>
          {[5, 10, 15].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.goalOption, goalMinutes === m && styles.goalOptionSelected]}
              onPress={() => void setGoalMinutes(m, 'settings')}
            >
              <Text style={[styles.goalOptionText, goalMinutes === m && styles.goalOptionTextSelected]}>
                {m}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inlineGap} />
        <Button label={t('settings.viewProgress')} variant="surface" onPress={() => navigation.navigate('MyProgressScreen')} />
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.admin')}</Text>
          <Button label={t('settings.adminPanel')} variant="surface" onPress={handleAdminPress} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.analyticsTitle')}</Text>
        <Text style={styles.sectionDescription}>
          {analyticsOptedOut ? t('settings.analyticsStatusDisabled') : t('settings.analyticsStatusEnabled')}
        </Text>
        <Button
          label={analyticsOptedOut ? t('settings.enableAnalytics') : t('settings.disableAnalytics')}
          variant="surface"
          onPress={() => void handleToggleAnalytics()}
        />
      </View>

      {__DEV__ ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.developer')}</Text>
          <Button label={t('settings.analyticsDebug')} variant="surface" onPress={() => navigation.navigate('AnalyticsDebug')} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.premiumTitle')}</Text>
        <Text style={styles.sectionDescription}>
          {isPremium ? t('profile.premiumStatusActive') : t('profile.premiumStatusInactive')}
        </Text>
        <Button
          label={t('profile.upgradeToPremium')}
          variant="primary"
          onPress={() => openPaywallOrAuth('settings', 'settings_upgrade_button')}
        />
        <View style={styles.inlineGap} />
        <Button
          label={t('profile.restorePurchases')}
          variant="surface"
          onPress={() => void handleRestorePress()}
        />
        <View style={styles.inlineGap} />
        <Button
          label={t('paywall.cancelSubscription')}
          variant="surface"
          onPress={handleManageSubscription}
        />
        <View style={styles.inlineGap} />
        <Button
          label={t('paywall.requestRefundApple')}
          variant="surface"
          onPress={handleRequestRefund}
        />
        <View style={styles.inlineGap} />
        <Button
          label={t('profile.removeAds')}
          variant="outline"
          onPress={() => {
            if (isPremium) return;
            openPaywallOrAuth('remove_ads', 'settings_remove_ads_row');
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.legalDescription')}</Text>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => handleOpenUrl(LEGAL_URLS.privacy)}
        >
          <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => handleOpenUrl(LEGAL_URLS.terms)}
        >
          <Text style={styles.linkText}>{t('settings.termsConditions')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  langButton: {
    minWidth: '30%',
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  langButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  langButtonText: {
    ...typography.body,
    color: colors.text,
  },
  langButtonTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  goalOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  goalOptionText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  goalOptionTextSelected: {
    color: colors.primary,
  },
  rectButton: {
    borderRadius: 8,
  },
  linkRow: {
    paddingVertical: spacing.sm,
  },
  inlineGap: {
    height: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
  },
});
