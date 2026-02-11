/**
 * ProfileScreen
 * User profile with language preferences and account management
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useAppLangStore, APP_LANGS } from '@/state/useAppLangStore';
import type { AppLangCode } from '@/state/useAppLangStore';
import { useTranslation } from '@/i18n/useTranslation';
import { fetchUserSettings, upsertUserSettings, checkIsAdmin } from '@/supabase/queries';
import { supabase } from '@/supabase/client';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/Button';
import { Snackbar } from '@/components/Snackbar';
import { ReaderTutorialModal } from '@/components/ReaderTutorialModal';
import { StudyTutorialModal } from '@/components/StudyTutorialModal';
import { AdBanner } from '@/components/ads/AdBanner';
import { LANGUAGES } from '@/constants/languages';
import type { KnownLangLevel, GoalLangLevel } from '@/supabase/types';

const KNOWN_LEVELS: KnownLangLevel[] = ['native', 'fluent', 'advanced', 'intermediate', 'beginner'];
const GOAL_LEVELS: GoalLangLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
  const { appLang, persist } = useAppLangStore();
  const t = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nativeLang, setNativeLang] = useState('en');
  const [knownLangs, setKnownLangs] = useState<string[]>(['en']);
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [knownLangLevels, setKnownLangLevels] = useState<Record<string, KnownLangLevel>>({ en: 'native' });
  const [goalLangLevels, setGoalLangLevels] = useState<Record<string, GoalLangLevel>>({});
  const [autoRemoveDownloadsAfterDays, setAutoRemoveDownloadsAfterDays] = useState(14);
  const [isAdmin, setIsAdmin] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const [showReaderTutorial, setShowReaderTutorial] = useState(false);
  const [showStudyTutorial, setShowStudyTutorial] = useState(false);
  type PickerKind = 'knownLang' | 'knownLevel' | 'goalLang' | 'goalLevel' | 'targetLang' | 'appLang' | 'autoRemove';
  const [pickerOpen, setPickerOpen] = useState<{ kind: PickerKind; code?: string; index?: number } | null>(null);
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCallbackRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [user]);

  useEffect(() => {
    if (!loading) initialLoadDone.current = true;
  }, [loading]);

  const profileEffectFirstRun = useRef(true);
  // Auto-save profile changes after a short debounce (skip during initial load, first run, and for guests)
  useEffect(() => {
    if (!user || isGuest || !initialLoadDone.current || loading) return;
    if (profileEffectFirstRun.current) {
      profileEffectFirstRun.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveCallbackRef.current();
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [targetLang, nativeLang, knownLangs, goalLangs, knownLangLevels, goalLangLevels, user, isGuest, loading]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [settings, adminStatus] = await Promise.all([
        fetchUserSettings(user.id),
        checkIsAdmin(user.id),
      ]);
      
      if (settings) {
        const known = settings.known_langs?.length ? settings.known_langs : ['en'];
        setNativeLang(settings.native_lang ?? 'en');
        setKnownLangs(known);
        setGoalLangs(settings.goal_langs ?? []);
        const rawKnownLevels = settings.known_lang_levels ?? {};
        const knownLevels: Record<string, KnownLangLevel> = { ...rawKnownLevels };
        const native = settings.native_lang ?? 'en';
        if (!knownLevels[native]) knownLevels[native] = 'native';
        known.forEach((code) => { if (!knownLevels[code]) knownLevels[code] = 'fluent'; });
        setKnownLangLevels(knownLevels);
        setGoalLangLevels(settings.goal_lang_levels ?? {});
        setAutoRemoveDownloadsAfterDays(settings.auto_remove_downloads_after_days ?? 14);
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
        known_lang_levels: knownLangLevels,
        goal_lang_levels: goalLangLevels,
      });

      setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      Alert.alert(t('common.error'), t('profile.saveProfileFailed'));
    } finally {
      setSaving(false);
    }
  };
  saveCallbackRef.current = handleSave;

  const setKnownLevel = (code: string, level: KnownLangLevel) => {
    setKnownLangLevels((prev) => ({ ...prev, [code]: level }));
    if (level === 'native') setNativeLang(code);
  };

  const setGoalLevel = (code: string, level: GoalLangLevel) => {
    setGoalLangLevels((prev) => ({ ...prev, [code]: level }));
  };

  const addKnownLang = (code: string) => {
    if (knownLangs.includes(code)) return;
    setKnownLangs([...knownLangs, code]);
    setKnownLangLevels((prev) => ({ ...prev, [code]: 'fluent' }));
  };

  const removeKnownLang = (code: string) => {
    setKnownLangs(knownLangs.filter((l) => l !== code));
    setKnownLangLevels((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (nativeLang === code) setNativeLang(knownLangs.find((l) => l !== code) ?? 'en');
  };

  const addGoalLang = (code: string) => {
    if (goalLangs.includes(code)) return;
    setGoalLangs([...goalLangs, code]);
    setGoalLangLevels((prev) => ({ ...prev, [code]: 'A1' }));
  };

  const removeGoalLang = (code: string) => {
    setGoalLangs(goalLangs.filter((l) => l !== code));
    setGoalLangLevels((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const replaceKnownLang = (index: number, newCode: string) => {
    const prev = knownLangs[index];
    if (prev === newCode) return;
    const level = knownLangLevels[prev] ?? (prev === nativeLang ? 'native' : 'fluent');
    setKnownLangs(knownLangs.map((c, i) => (i === index ? newCode : c)));
    setKnownLangLevels((prevLevels) => {
      const next = { ...prevLevels };
      delete next[prev];
      next[newCode] = knownLangs.includes(newCode) ? (prevLevels[newCode] ?? level) : level;
      return next;
    });
    if (nativeLang === prev) setNativeLang(newCode);
  };

  const replaceGoalLang = (index: number, newCode: string) => {
    const prev = goalLangs[index];
    if (prev === newCode) return;
    const level = goalLangLevels[prev] ?? 'A1';
    setGoalLangs(goalLangs.map((c, i) => (i === index ? newCode : c)));
    setGoalLangLevels((prevLevels) => {
      const next = { ...prevLevels };
      delete next[prev];
      next[newCode] = goalLangs.includes(newCode) ? (prevLevels[newCode] ?? level) : level;
      return next;
    });
  };

  const AUTO_REMOVE_OPTIONS = [
    { value: '7', label: t('settings.autoRemove1Week') },
    { value: '14', label: t('settings.autoRemove2Weeks') },
    { value: '0', label: t('settings.autoRemoveNever') },
  ];

  const pickerOptions: { value: string; label: string }[] =
    pickerOpen?.kind === 'autoRemove'
      ? AUTO_REMOVE_OPTIONS
      : pickerOpen?.kind === 'knownLevel' || pickerOpen?.kind === 'goalLevel'
        ? (pickerOpen.kind === 'knownLevel'
            ? KNOWN_LEVELS.map((l) => ({ value: l, label: t('profile.knownLevel.' + l) }))
            : GOAL_LEVELS.map((l) => ({ value: l, label: t('profile.goalLevel.' + l) })))
        : pickerOpen?.kind === 'appLang'
          ? APP_LANGS.map((code) => ({ value: code, label: t('language.' + code) }))
          : LANGUAGES.map((l) => ({ value: l.code, label: t('language.' + l.code) }));

  const handlePickerSelect = async (value: string) => {
    if (!pickerOpen) return;
    const { kind, code, index } = pickerOpen;
    if (kind === 'knownLang' && typeof index === 'number') replaceKnownLang(index, value);
    else if (kind === 'knownLevel' && code) setKnownLevel(code, value as KnownLangLevel);
    else if (kind === 'goalLang' && typeof index === 'number') replaceGoalLang(index, value);
    else if (kind === 'goalLevel' && code) setGoalLevel(code, value as GoalLangLevel);
    else if (kind === 'targetLang') setTargetLang(value, user?.id);
    else if (kind === 'appLang') handleSetAppLang(value as AppLangCode);
    else if (kind === 'autoRemove' && user) {
      const days = parseInt(value, 10);
      setAutoRemoveDownloadsAfterDays(days);
      useSettingsStore.setState({ autoRemoveDownloadsAfterDays: days });
      try {
        await upsertUserSettings({ user_id: user.id, auto_remove_downloads_after_days: days });
        setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
      } catch (e) {
        logger.error('Failed to save auto-remove setting', e);
      }
    }
    setPickerOpen(null);
  };

  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const deleteAccountMatch = deleteAccountConfirm.trim() === 'DELETE';

  const handleDeleteAccountPress = () => setDeleteAccountModalVisible(true);

  const handleConfirmDeleteAccount = async () => {
    if (!deleteAccountMatch || !user) return;
    try {
      const { error } = await supabase.rpc('soft_delete_user_account');
      if (error) throw error;
      setDeleteAccountModalVisible(false);
      setDeleteAccountConfirm('');
      await signOut();
      Alert.alert(
        t('profile.accountDeleted'),
        t('profile.accountDeletedMessage')
      );
    } catch (error) {
      logger.error('Failed to delete account:', error);
      Alert.alert(t('common.error'), t('profile.deleteAccountFailed'));
    }
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

  const handleSetAppLang = (lang: AppLangCode) => {
    persist(user?.id ?? null, lang);
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch((err) => logger.error('Failed to open URL', err));
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
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <Text style={styles.email}>{t('profile.guest')}</Text>
          <Text style={styles.sectionDescription}>{t('profile.signInPrompt')}</Text>
          <Button
            label={t('profile.signInCreateAccount')}
            variant="primary"
            style={styles.rectButton}
            onPress={() => navigation.navigate('Auth')}
            textStyle={styles.rectButtonText}
          />
        </View>
        <View style={styles.spacer} />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {/* Account — top: user info or guest + CTA */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        {isGuest ? (
          <>
            <Text style={styles.email}>{t('profile.guest')}</Text>
            <Text style={styles.sectionDescription}>{t('settings.guestDescription')}</Text>
            <Button
              label={t('settings.signInCreate')}
              variant="primary"
              style={styles.rectButton}
              onPress={() => navigation.navigate('Auth')}
              textStyle={styles.rectButtonText}
            />
          </>
        ) : (
          <View style={styles.emailRow}>
            <Text style={styles.email}>
              {getUserDisplayName(user) === 'APPLE_USER_PLACEHOLDER' ? t('profile.appleUser') : getUserDisplayName(user)}
            </Text>
            {isAdmin && (
              <View style={styles.adminChip}>
                <Text style={styles.adminChipText}>{t('profile.admin')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.profileAd}>
        <AdBanner />
      </View>

      {/* Languages */}
      <View style={styles.sectionCard}>
      {/* Languages you know */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.knownLangs')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.knownLangsDesc')}</Text>
        {knownLangs.length === 0 ? (
          <Pressable style={styles.dropdownRow} onPress={() => addKnownLang('en')}>
            <Text style={styles.addLangLink}>{t('profile.addLanguage')}</Text>
          </Pressable>
        ) : (
          <>
            {knownLangs.map((code, index) => (
              <View key={`${code}-${index}`} style={styles.profileRow}>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setPickerOpen({ kind: 'knownLang', index })}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{t('language.' + code)}</Text>
                  <Feather name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setPickerOpen({ kind: 'knownLevel', code })}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {t('profile.knownLevel.' + (knownLangLevels[code] ?? (code === nativeLang ? 'native' : 'fluent')))}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
                <TouchableOpacity onPress={() => removeKnownLang(code)} style={styles.rowRemove} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            {LANGUAGES.some((l) => !knownLangs.includes(l.code)) && (
              <Pressable style={styles.addRow} onPress={() => addKnownLang(LANGUAGES.find((l) => !knownLangs.includes(l.code))!.code)}>
                <Text style={styles.addLangLink}>+ {t('profile.addLanguage')}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Languages you're learning */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.goalLangs')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.goalLangsDesc')}</Text>
        {goalLangs.length === 0 ? (
          <Pressable style={styles.dropdownRow} onPress={() => addGoalLang(LANGUAGES[0].code)}>
            <Text style={styles.addLangLink}>{t('profile.addLanguage')}</Text>
          </Pressable>
        ) : (
          <>
            {goalLangs.map((code, index) => (
              <View key={`${code}-${index}`} style={styles.profileRow}>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setPickerOpen({ kind: 'goalLang', index })}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{t('language.' + code)}</Text>
                  <Feather name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setPickerOpen({ kind: 'goalLevel', code })}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {t('profile.goalLevel.' + (goalLangLevels[code] ?? 'A1'))}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
                <TouchableOpacity onPress={() => removeGoalLang(code)} style={styles.rowRemove} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            {LANGUAGES.some((l) => !goalLangs.includes(l.code)) && (
              <Pressable style={styles.addRow} onPress={() => addGoalLang(LANGUAGES.find((l) => !goalLangs.includes(l.code))!.code)}>
                <Text style={styles.addLangLink}>+ {t('profile.addLanguage')}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Current target language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.targetLangTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.targetLangDesc')}</Text>
        <View style={styles.profileRow}>
          <Pressable
            style={[styles.dropdown, styles.dropdownFull]}
            onPress={() => setPickerOpen({ kind: 'targetLang' })}
          >
            <Text style={styles.dropdownText} numberOfLines={1}>{t('language.' + targetLang)}</Text>
            <Feather name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      </View>

      {/* App language */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('settings.appLanguage')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.appLanguageDescription')}</Text>
        <View style={styles.profileRow}>
          <Pressable
            style={[styles.dropdown, styles.dropdownFull]}
            onPress={() => setPickerOpen({ kind: 'appLang' })}
          >
            <Text style={styles.dropdownText} numberOfLines={1}>{t('language.' + appLang)}</Text>
            <Feather name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Auto-remove downloads */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('settings.autoRemoveDownloads')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.autoRemoveDownloadsDesc')}</Text>
        <View style={styles.profileRow}>
          <Pressable
            style={[styles.dropdown, styles.dropdownFull]}
            onPress={() => setPickerOpen({ kind: 'autoRemove' })}
          >
            <Text style={styles.dropdownText} numberOfLines={1}>
              {AUTO_REMOVE_OPTIONS.find((o) => o.value === String(autoRemoveDownloadsAfterDays))?.label ?? t('settings.autoRemove2Weeks')}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {isAdmin && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.admin')}</Text>
          <Button
            label={t('settings.adminPanel')}
            variant="surface"
            style={styles.adminPanelButton}
            onPress={() => navigation.navigate('Admin')}
          />
        </View>
      )}

      <View style={styles.profileAd}>
        <AdBanner />
      </View>

      {/* Replay tutorials — show in place */}
      <TouchableOpacity style={styles.replayTutorialRow} onPress={() => setShowReaderTutorial(true)}>
        <Feather name="book" size={20} color={colors.primary} />
        <Text style={styles.replayTutorialText}>{t('settings.replayReaderTutorial')}</Text>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.replayTutorialRow} onPress={() => setShowStudyTutorial(true)}>
        <Feather name="layers" size={20} color={colors.primary} />
        <Text style={styles.replayTutorialText}>{t('settings.replayStudyTutorial')}</Text>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.profileAd}>
        <AdBanner />
      </View>

      {/* Legal */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.legalDescription')}</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenUrl('https://lingoleaf.app/privacy-policy')}>
          <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenUrl('https://lingoleaf.app/terms-and-conditions')}>
          <Text style={styles.linkText}>{t('settings.termsConditions')}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom: log out + delete (signed-in users only) */}
      {!isGuest && (
        <>
          <Button
            label={t('profile.signOut')}
            variant="primary"
            style={styles.bottomActionButton}
            onPress={handleSignOut}
            textStyle={styles.rectButtonText}
          />
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccountPress}>
            <Text style={styles.deleteButtonText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Picker modal */}
      <Modal visible={pickerOpen !== null} transparent animationType="fade">
        <View style={styles.pickerBackdrop}>
          <Pressable style={styles.pickerBackdropTouchable} onPress={() => setPickerOpen(null)} />
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>
              {pickerOpen?.kind === 'knownLevel' || pickerOpen?.kind === 'goalLevel'
                ? t('profile.selectLevel')
                : pickerOpen?.kind === 'appLang'
                  ? t('settings.appLanguage')
                  : pickerOpen?.kind === 'autoRemove'
                    ? t('settings.autoRemoveDownloads')
                    : t('profile.selectLanguage')}
            </Text>
            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerOption}
                  onPress={() => handlePickerSelect(item.value)}
                >
                  <Text style={styles.pickerOptionText}>{item.label}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.pickerCancel} onPress={() => setPickerOpen(null)}>
              <Text style={styles.pickerCancelText}>{t('study.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteAccountModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteAccountModalVisible(false)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteCardTitle}>{t('profile.deleteAccount')}</Text>
            <Text style={styles.deleteCardBody}>{t('profile.deleteAccountTypeConfirm')}</Text>
            <View style={styles.deleteInputRow}>
              <TextInput
                style={[styles.deleteInput, deleteAccountMatch && styles.deleteInputMatch]}
                value={deleteAccountConfirm}
                onChangeText={setDeleteAccountConfirm}
                placeholder="DELETE"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {deleteAccountMatch ? <Feather name="check-circle" size={22} color={colors.success} style={styles.deleteInputCheck} /> : null}
            </View>
            <View style={styles.deleteCardActions}>
              <TouchableOpacity style={styles.deleteCardButton} onPress={() => { setDeleteAccountModalVisible(false); setDeleteAccountConfirm(''); }}>
                <Text style={styles.deleteCardButtonText}>{t('study.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteCardButton, styles.deleteCardButtonDanger, !deleteAccountMatch && styles.deleteCardButtonDisabled]}
                onPress={handleConfirmDeleteAccount}
                disabled={!deleteAccountMatch}
              >
                <Text style={[styles.deleteCardButtonText, styles.deleteCardButtonDangerText]}>{t('study.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.spacer} />
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
      />
      </ScrollView>
      <ReaderTutorialModal
        visible={showReaderTutorial}
        onComplete={() => setShowReaderTutorial(false)}
        onSkip={() => setShowReaderTutorial(false)}
      />
      <StudyTutorialModal
        visible={showStudyTutorial}
        onComplete={() => setShowStudyTutorial(false)}
        onSkip={() => setShowStudyTutorial(false)}
      />
    </>
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
    marginBottom: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minWidth: 0,
  },
  dropdownFull: {
    flex: 1,
  },
  dropdownText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  dropdownRow: {
    marginBottom: spacing.sm,
  },
  rowRemove: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  addLangLink: {
    ...typography.body,
    color: colors.primary,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerBackdropTouchable: {
    flex: 1,
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.text,
  },
  pickerCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  pickerCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  profileAd: {
    marginBottom: spacing.lg,
  },
  replayTutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replayTutorialText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  linkRow: {
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
  },
  adminPanelButton: {
    marginTop: spacing.xs,
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
  bottomActionButton: {
    ...typography.button,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: '600',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  deleteCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  deleteCardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  deleteCardBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  deleteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  deleteInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteInputMatch: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  deleteInputCheck: {
    marginLeft: spacing.xs,
  },
  deleteCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  deleteCardButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteCardButtonText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  deleteCardButtonDanger: {
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  deleteCardButtonDangerText: {
    color: colors.error,
    fontWeight: '600',
  },
  deleteCardButtonDisabled: {
    opacity: 0.5,
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

