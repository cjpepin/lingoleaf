/**
 * SettingsScreen
 * App settings including app language
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useAppLangStore } from '@/state/useAppLangStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { checkIsAdmin } from '@/supabase/queries';
import { Button } from '@/components/ui/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isGuest } = useAuthStore();
  const { appLang, persist } = useAppLangStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const t = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings(user.id);
      logger.info('Checking admin status for user:', user.id);
      checkIsAdmin(user.id).then((result) => setIsAdmin(result)).catch((error) => {
        logger.error('Failed to check admin status', error);
      });
    }
  }, [user, loadSettings]);

  const handleAdminPress = () => {
    navigation.navigate('Admin');
  };

  const handleSetLang = async (lang: 'en' | 'es') => {
    await persist(user?.id ?? null, lang);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appLanguage')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.appLanguageDescription')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langButton, appLang === 'en' && styles.langButtonSelected]}
            onPress={() => handleSetLang('en')}
          >
            <Text style={[styles.langButtonText, appLang === 'en' && styles.langButtonTextSelected]}>
              {t('settings.english')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langButton, appLang === 'es' && styles.langButtonSelected]}
            onPress={() => handleSetLang('es')}
          >
            <Text style={[styles.langButtonText, appLang === 'es' && styles.langButtonTextSelected]}>
              {t('settings.spanish')}
            </Text>
          </TouchableOpacity>
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

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.admin')}</Text>
          <Button label={t('settings.adminPanel')} variant="surface" onPress={handleAdminPress} />
        </View>
      )}
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  langButton: {
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
  rectButton: {
    borderRadius: 8,
  },
});
