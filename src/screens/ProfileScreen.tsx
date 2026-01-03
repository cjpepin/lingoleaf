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
import { fetchUserSettings, upsertUserSettings, checkIsAdmin } from '@/supabase/queries';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Common language options
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { targetLang, setTargetLang } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nativeLang, setNativeLang] = useState('en');
  const [knownLangs, setKnownLangs] = useState<string[]>(['en']);
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

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
      Alert.alert('Error', 'Failed to load profile settings');
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

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save profile');
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
      'Delete Account',
      'Are you sure? This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              
              // Guest-first: "sign out" returns to a guest session.
              await signOut();
              
              // Note: Actual deletion requires service role key
              // For now, just sign out. Implement server-side deletion via Edge Function
              Alert.alert(
                'Account Deletion',
                'Please contact support to complete account deletion.'
              );
            } catch (error) {
              logger.error('Failed to delete account:', error);
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Signed out', 'You have successfully signed out from your account.');
    } catch (error) {
      logger.error('Sign out failed:', error);
      Alert.alert('Error', 'Failed to sign out');
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
        <Text style={styles.title}>Profile</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionDescription}>Sign in to sync your progress across devices.</Text>
          <Button
            label="Sign in / Create account"
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
      <Text style={styles.title}>Profile</Text>
      
      <View style={styles.section}>
        <View style={styles.emailRow}>
          <Text style={styles.email}>{isGuest ? 'Guest' : user?.email}</Text>
          {isAdmin && (
            <View style={styles.adminChip}>
              <Text style={styles.adminChipText}>Admin</Text>
            </View>
          )}
        </View>
      </View>

      {/* Native Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Native Language</Text>
        <Text style={styles.sectionDescription}>Your first language</Text>
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
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Known Languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Known Languages</Text>
        <Text style={styles.sectionDescription}>Languages you can read</Text>
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
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Goal Languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Goal Languages</Text>
        <Text style={styles.sectionDescription}>Languages you want to learn</Text>
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
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Target Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Translation Target</Text>
        <Text style={styles.sectionDescription}>Language for translations while reading</Text>
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
                {lang.name}
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
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Settings */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
      </TouchableOpacity>
      </View>

      {/* Sign Out */}
      {isGuest ? (
        <Button 
          label="Sign in / Create account" 
          variant="primary" 
          style={styles.rectButton} 
          onPress={() => navigation.navigate('Auth')} 
          textStyle={styles.rectButtonText}
        />
      ) : (
        <Button label="Sign out" variant="surface" style={styles.rectButton} onPress={handleSignOut} />
      )}

      {/* Delete Account */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
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

