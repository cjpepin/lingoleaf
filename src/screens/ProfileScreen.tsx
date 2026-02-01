/**
 * ProfileScreen
 * User profile with language preferences and account management
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useTranslation } from '@/i18n/useTranslation';
import { fetchUserSettings, upsertUserSettings, checkIsAdmin } from '@/supabase/queries';
import { supabase } from '@/supabase/client';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/Button';
import { Snackbar } from '@/components/Snackbar';
import { LANGUAGES } from '@/constants/languages';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Helper to get display name for Apple/Google users
function getUserDisplayName(user: any): string {
  if (!user) return '';
  
  // Check if this is an Apple sign-in (privaterelay email or user_metadata has apple provider)
  const email = user.email || '';
  const isApplePrivateRelay = email.includes('@privaterelay.appleid.com');
  const providers = user.app_metadata?.providers || [];
  const isAppleUser = providers.includes('apple') || isApplePrivateRelay;
  
  // Try to get full name from user_metadata (Apple provides this on first sign-in)
  const fullName = user.user_metadata?.full_name;
  const firstName = user.user_metadata?.first_name;
  const lastName = user.user_metadata?.last_name;
  
  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  
  // For Apple users without a name, show "Apple User" (caller passes translated string)
  if (isAppleUser) return 'APPLE_USER_PLACEHOLDER';
  
  // For Google or other providers, show email
  return email;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { targetLang, setTargetLang } = useSettingsStore();
  const t = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nativeLang, setNativeLang] = useState('en');
  const [knownLangs, setKnownLangs] = useState<string[]>(['en']);
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [settings, adminStatus] = await Promise.all([
        fetchUserSettings(user.id),
        checkIsAdmin(user.id),
      ]);
      
      if (settings) {
        setNativeLang(settings.native_lang);
        setKnownLangs(settings.known_langs);
        setGoalLangs(settings.goal_langs);
      }
      
      setIsAdmin(adminStatus);
    } catch (error) {
      logger.error('Failed to load settings:', error);
      Alert.alert(t('common.error'), t('profile.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      await upsertUserSettings({
        user_id: user.id,
        target_lang: targetLang,
        native_lang: nativeLang,
        known_langs: knownLangs,
        goal_langs: goalLangs,
      });

      setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      Alert.alert(t('common.error'), t('profile.saveProfileFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleKnownLang = (code: string) => {
    if (knownLangs.includes(code)) {
      setKnownLangs(knownLangs.filter(l => l !== code));
    } else {
      setKnownLangs([...knownLangs, code]);
    }
  };

  const toggleGoalLang = (code: string) => {
    if (goalLangs.includes(code)) {
      setGoalLangs(goalLangs.filter(l => l !== code));
    } else {
      setGoalLangs([...goalLangs, code]);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountConfirm'),
      [
        { text: t('study.cancel'), style: 'cancel' },
        {
          text: t('study.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              
              // Call soft-delete function
              const { error } = await supabase.rpc('soft_delete_user_account');
              if (error) throw error;
              
              // Sign out (returns to guest session)
              await signOut();
              
              Alert.alert(
                'Account Deleted',
                'Your account has been deleted. All your data will be removed within 30 days. You can continue using the app as a guest.'
              );
            } catch (error) {
              logger.error('Failed to delete account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSnackbar({ visible: true, message: t('profile.signedOutSuccess'), type: 'success' });
    } catch (error) {
      logger.error('Sign out failed:', error);
      setSnackbar({ visible: true, message: t('profile.signOutFailed'), type: 'error' });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <Text style={styles.sectionDescription}>{t('profile.signInPrompt')}</Text>
          <Button
            label={t('profile.signInCreateAccount')}
            variant="primary"
            style={styles.rectButton}
            onPress={() => navigation.navigate('Auth')}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('profile.title')}</Text>
      
      <View style={styles.section}>
        <View style={styles.emailRow}>
          <Text style={styles.email}>
            {isGuest ? t('profile.guest') : (getUserDisplayName(user) === 'APPLE_USER_PLACEHOLDER' ? t('profile.appleUser') : getUserDisplayName(user))}
          </Text>
          {isAdmin && (
            <View style={styles.adminChip}>
              <Text style={styles.adminChipText}>{t('profile.admin')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Native Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.nativeLang')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.nativeLangDesc')}</Text>
        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                nativeLang === lang.code && styles.languageButtonSelected,
              ]}
              onPress={() => setNativeLang(lang.code)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  nativeLang === lang.code && styles.languageButtonTextSelected,
                ]}
              >
                {t('language.' + lang.code)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Known Languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.knownLangs')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.knownLangsDesc')}</Text>
        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                knownLangs.includes(lang.code) && styles.languageButtonSelected,
              ]}
              onPress={() => toggleKnownLang(lang.code)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  knownLangs.includes(lang.code) && styles.languageButtonTextSelected,
                ]}
              >
                {t('language.' + lang.code)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Goal Languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.goalLangs')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.goalLangsDesc')}</Text>
        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                goalLangs.includes(lang.code) && styles.languageButtonSelected,
              ]}
              onPress={() => toggleGoalLang(lang.code)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  goalLangs.includes(lang.code) && styles.languageButtonTextSelected,
                ]}
              >
                {t('language.' + lang.code)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Target Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.targetLangTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.targetLangDesc')}</Text>
        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                targetLang === lang.code && styles.languageButtonSelected,
              ]}
              onPress={() => setTargetLang(lang.code)}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  targetLang === lang.code && styles.languageButtonTextSelected,
                ]}
              >
                {t('language.' + lang.code)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>{t('profile.saveChanges')}</Text>
        )}
      </TouchableOpacity>

      {/* Settings */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsButtonText}>{t('nav.settings')}</Text>
      </TouchableOpacity>
      </View>

      {/* Sign Out */}
      {isGuest ? (
        <Button 
          label={t('profile.signInCreateAccount')} 
          variant="primary" 
          style={styles.rectButton} 
          onPress={() => navigation.navigate('Auth')} 
          textStyle={styles.rectButtonText}
        />
      ) : (
        <Button 
          label={t('profile.signOut')} 
          variant="primary" 
          style={styles.rectButton} 
          onPress={handleSignOut} 
          textStyle={styles.rectButtonText}
        />
      )}

      {/* Delete Account */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>{t('profile.deleteAccount')}</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
  },
  adminChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
  },
  adminChipText: {
    ...typography.small,
    color: colors.background,
    fontWeight: '600',
    fontSize: 12,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  languageButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languageButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageButtonText: {
    ...typography.body,
    color: colors.text,
  },
  languageButtonTextSelected: {
    color: colors.background,
    fontWeight: '600',
  },
  saveButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.background,
  },
  settingsButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsButtonText: {
    ...typography.button,
    color: colors.text,
    fontSize: 16,
  },
  signOutButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutButtonText: {
    ...typography.button,
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.error,
  },
  spacer: {
    height: spacing.xl,
  },
  rectButton: {
    ...typography.button,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: '600',
  },
  rectButtonText: {
    ...typography.button,
    color: colors.surface,
    fontWeight: '600',
  },
});

