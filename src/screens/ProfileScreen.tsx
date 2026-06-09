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
import { HomeTutorialModal } from '@/components/HomeTutorialModal';
import { AdBanner } from '@/components/ads/AdBanner';
import { LANGUAGES } from '@/constants/languages';
import type { KnownLangLevel, GoalLangLevel } from '@/supabase/types';
import { usePremium } from '@/premium/PremiumProvider';
import { LEGAL_URLS } from '@/constants/legal';
import { APPLE_USER_PLACEHOLDER, getUserDisplayName } from '@/screens/profile/getUserDisplayName';
import { validatePassword } from '@/utils/passwordValidation';
import { usePremiumGate } from '@/premium/usePremiumGate';
import { syncDailyGoalReminder } from '@/notifications/dailyGoalReminder';
import { defaultSubGoals, getActiveGoals, type GoalKey, normalizePrimaryGoal, normalizeSubGoals } from '@/utils/goalHierarchy';

const KNOWN_LEVELS: KnownLangLevel[] = ['native', 'fluent', 'advanced', 'intermediate', 'beginner'];
const GOAL_LEVELS: GoalLangLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const READING_GOAL_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);
const SAVED_GOAL_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 5);
const LEARNED_GOAL_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 1);
const REMINDER_TIME_OPTIONS = [
  { hour: 8, minute: 0, key: '08:00' },
  { hour: 12, minute: 0, key: '12:00' },
  { hour: 18, minute: 0, key: '18:00' },
  { hour: 20, minute: 0, key: '20:00' },
  { hour: 21, minute: 0, key: '21:00' },
] as const;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { targetLang, setTargetLang } = useSettingsStore();
  const { appLang, persist } = useAppLangStore();
  const t = useTranslation();
  const { isPremium, restore } = usePremium();
  const { openPaywallOrAuth } = usePremiumGate();
  const dailyReminderBodies = [
    t('notifications.dailyGoalBody'),
    t('notifications.dailyGoalBodyAlt1'),
    t('notifications.dailyGoalBodyAlt2'),
    t('notifications.dailyGoalBodyAlt3'),
    t('notifications.dailyGoalBodyAlt4'),
  ];

  const [loading, setLoading] = useState(true);
  const [nativeLang, setNativeLang] = useState('en');
  const [knownLangs, setKnownLangs] = useState<string[]>(['en']);
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [knownLangLevels, setKnownLangLevels] = useState<Record<string, KnownLangLevel>>({ en: 'native' });
  const [goalLangLevels, setGoalLangLevels] = useState<Record<string, GoalLangLevel>>({});
  const [autoRemoveDownloadsAfterDays, setAutoRemoveDownloadsAfterDays] = useState(14);
  const [dailyReadingGoalMinutes, setDailyReadingGoalMinutes] = useState(10);
  const [dailyWordsSavedGoal, setDailyWordsSavedGoal] = useState(10);
  const [dailyWordsLearnedGoal, setDailyWordsLearnedGoal] = useState(5);
  const [primaryGoal, setPrimaryGoal] = useState<GoalKey>('reading_minutes');
  const [goalPriority, setGoalPriority] = useState<GoalKey[]>(defaultSubGoals('reading_minutes'));
  const [dailyGoalReminderEnabled, setDailyGoalReminderEnabled] = useState(false);
  const [dailyGoalReminderHour, setDailyGoalReminderHour] = useState(20);
  const [dailyGoalReminderMinute, setDailyGoalReminderMinute] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const [showReaderTutorial, setShowReaderTutorial] = useState(false);
  const [showHomeTutorial, setShowHomeTutorial] = useState(false);
  type PickerKind =
    | 'knownLang'
    | 'knownLevel'
    | 'goalLang'
    | 'goalLevel'
    | 'targetLang'
    | 'appLang'
    | 'autoRemove'
    | 'dailyReadingGoal'
    | 'dailySavedGoal'
    | 'dailyLearnedGoal'
    | 'primaryGoal'
    | 'dailyReminderTime';
  const [pickerOpen, setPickerOpen] = useState<{ kind: PickerKind; code?: string; index?: number } | null>(null);
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCallbackRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const activeGoals = getActiveGoals(primaryGoal, goalPriority);

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
  }, [
    targetLang,
    nativeLang,
    knownLangs,
    goalLangs,
    knownLangLevels,
    goalLangLevels,
    primaryGoal,
    goalPriority,
    dailyGoalReminderEnabled,
    dailyGoalReminderHour,
    dailyGoalReminderMinute,
    user,
    isGuest,
    loading,
  ]);

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
        const readingGoal = settings.daily_reading_goal_minutes;
        setDailyReadingGoalMinutes(
          typeof readingGoal === 'number' && readingGoal >= 5 && readingGoal <= 60 && readingGoal % 5 === 0
            ? readingGoal
            : 10
        );
        const savedGoal = settings.daily_words_saved_goal;
        setDailyWordsSavedGoal(
          typeof savedGoal === 'number' && savedGoal >= 5 && savedGoal <= 50 && savedGoal % 5 === 0
            ? savedGoal
            : 10
        );
        const learnedGoal = settings.daily_words_learned_goal;
        setDailyWordsLearnedGoal(
          typeof learnedGoal === 'number' && learnedGoal >= 1 && learnedGoal <= 15
            ? learnedGoal
            : 5
        );
        const normalizedPrimary: GoalKey = normalizePrimaryGoal(settings.primary_goal);
        setPrimaryGoal(normalizedPrimary);
        const priority = Array.isArray(settings.goal_priority)
          ? normalizeSubGoals(settings.goal_priority, normalizedPrimary)
          : defaultSubGoals(normalizedPrimary);
        setGoalPriority(priority);
        setDailyGoalReminderEnabled(settings.daily_goal_reminder_enabled === true);
        setDailyGoalReminderHour(
          typeof settings.daily_goal_reminder_hour === 'number' ? Math.max(0, Math.min(23, settings.daily_goal_reminder_hour)) : 20
        );
        setDailyGoalReminderMinute(
          typeof settings.daily_goal_reminder_minute === 'number' ? Math.max(0, Math.min(59, settings.daily_goal_reminder_minute)) : 0
        );
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
      await upsertUserSettings({
        user_id: user.id,
        target_lang: targetLang,
        native_lang: nativeLang,
        known_langs: knownLangs,
        goal_langs: goalLangs,
        known_lang_levels: knownLangLevels,
        goal_lang_levels: goalLangLevels,
        daily_reading_goal_minutes: dailyReadingGoalMinutes,
        daily_words_saved_goal: dailyWordsSavedGoal,
        daily_words_learned_goal: dailyWordsLearnedGoal,
        primary_goal: primaryGoal,
        goal_priority: goalPriority,
        daily_goal_reminder_enabled: dailyGoalReminderEnabled,
        daily_goal_reminder_hour: dailyGoalReminderHour,
        daily_goal_reminder_minute: dailyGoalReminderMinute,
      });

      setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      Alert.alert(t('common.error'), t('profile.saveProfileFailed'));
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

  const formatReminderTime = (hour: number, minute: number) => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    try {
      return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    } catch {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  };

  const toggleGoalPriority = (goal: GoalKey) => {
    if (goal === primaryGoal) return;
    setGoalPriority((prev) => {
      if (prev.includes(goal)) {
        return prev.filter((g) => g !== goal);
      }
      return [...prev, goal];
    });
  };

  const updatePrimaryGoal = (goal: GoalKey) => {
    setPrimaryGoal(goal);
    setGoalPriority((prev) => normalizeSubGoals(prev, goal));
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
      : pickerOpen?.kind === 'dailyReadingGoal'
        ? READING_GOAL_OPTIONS.map((minutes) => ({ value: String(minutes), label: `${minutes} ${t('profile.minutes')}` }))
        : pickerOpen?.kind === 'dailySavedGoal'
          ? SAVED_GOAL_OPTIONS.map((count) => ({ value: String(count), label: String(count) }))
          : pickerOpen?.kind === 'dailyLearnedGoal'
            ? LEARNED_GOAL_OPTIONS.map((count) => ({ value: String(count), label: String(count) }))
            : pickerOpen?.kind === 'primaryGoal'
              ? ([
                  { value: 'reading_minutes', label: t('goal.reading_minutes') },
                  { value: 'words_saved', label: t('goal.words_saved') },
                  { value: 'words_learned', label: t('goal.words_learned') },
                ])
              : pickerOpen?.kind === 'dailyReminderTime'
                ? REMINDER_TIME_OPTIONS.map((opt) => ({
                    value: opt.key,
                    label: formatReminderTime(opt.hour, opt.minute),
                  }))
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
    else if (kind === 'primaryGoal' && user) {
      const goal: GoalKey = normalizePrimaryGoal(value);
      const nextPriority: GoalKey[] = normalizeSubGoals(goalPriority, goal);
      updatePrimaryGoal(goal);
      try {
        await upsertUserSettings({ user_id: user.id, primary_goal: goal, goal_priority: nextPriority });
        setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
      } catch (e) {
        logger.error('Failed to save primary goal', e);
      }
    } else if (kind === 'dailyReminderTime' && user) {
      const selected = REMINDER_TIME_OPTIONS.find((opt) => opt.key === value);
      if (selected) {
        setDailyGoalReminderHour(selected.hour);
        setDailyGoalReminderMinute(selected.minute);
        try {
          await upsertUserSettings({
            user_id: user.id,
            daily_goal_reminder_hour: selected.hour,
            daily_goal_reminder_minute: selected.minute,
          });
          if (dailyGoalReminderEnabled) {
            await syncDailyGoalReminder({
              enabled: true,
              hour: selected.hour,
              minute: selected.minute,
              title: t('app.title'),
              body: t('notifications.dailyGoalBody'),
              bodyOptions: dailyReminderBodies,
            });
          }
          setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
        } catch (e) {
          logger.error('Failed to save reminder time', e);
        }
      }
    }
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
    } else if (kind === 'dailyReadingGoal' && user) {
      const parsed = Number(value);
      const minutes = Number.isFinite(parsed)
        ? Math.max(5, Math.min(60, Math.round(parsed / 5) * 5))
        : dailyReadingGoalMinutes;
      setDailyReadingGoalMinutes(minutes);
      try {
        await upsertUserSettings({ user_id: user.id, daily_reading_goal_minutes: minutes });
        setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
      } catch (e) {
        logger.error('Failed to save daily reading goal', e);
      }
    } else if (kind === 'dailySavedGoal' && user) {
      const parsed = Number(value);
      const goal = Number.isFinite(parsed)
        ? Math.max(5, Math.min(50, Math.round(parsed / 5) * 5))
        : dailyWordsSavedGoal;
      setDailyWordsSavedGoal(goal);
      try {
        await upsertUserSettings({ user_id: user.id, daily_words_saved_goal: goal });
        setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
      } catch (e) {
        logger.error('Failed to save daily saved goal', e);
      }
    } else if (kind === 'dailyLearnedGoal' && user) {
      const parsed = Number(value);
      const goal = Number.isFinite(parsed)
        ? Math.max(1, Math.min(15, Math.round(parsed)))
        : dailyWordsLearnedGoal;
      setDailyWordsLearnedGoal(goal);
      try {
        await upsertUserSettings({ user_id: user.id, daily_words_learned_goal: goal });
        setSnackbar({ visible: true, message: t('profile.profileUpdated'), type: 'success' });
      } catch (e) {
        logger.error('Failed to save daily learned goal', e);
      }
    }
    setPickerOpen(null);
  };

  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const deleteAccountKeyword = t('profile.deleteAccountConfirmToken');
  const deleteAccountMatch = deleteAccountConfirm.trim() === deleteAccountKeyword;
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

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

  const handleManageSubscription = () => {
    handleOpenUrl(LEGAL_URLS.iosManageSubscriptions);
  };

  const handleRequestRefund = () => {
    handleOpenUrl(LEGAL_URLS.iosRefunds);
  };

  const handleUpgradePress = () => {
    openPaywallOrAuth('settings', 'profile_upgrade_button');
  };

  const handleRestorePress = async () => {
    const outcome = await restore('profile');
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

  const handleOpenProgress = () => {
    navigation.navigate('MyProgressScreen');
  };

  const handleToggleDailyReminder = async () => {
    if (!user) return;
    const nextEnabled = !dailyGoalReminderEnabled;
    setDailyGoalReminderEnabled(nextEnabled);
    try {
      await upsertUserSettings({
        user_id: user.id,
        daily_goal_reminder_enabled: nextEnabled,
      });

      const outcome = await syncDailyGoalReminder({
        enabled: nextEnabled,
        hour: dailyGoalReminderHour,
        minute: dailyGoalReminderMinute,
        title: t('app.title'),
        body: t('notifications.dailyGoalBody'),
        bodyOptions: dailyReminderBodies,
      });

      if (outcome === 'denied') {
        setDailyGoalReminderEnabled(false);
        await upsertUserSettings({
          user_id: user.id,
          daily_goal_reminder_enabled: false,
        });
        Alert.alert(t('notifications.permissionTitle'), t('notifications.permissionBody'));
        return;
      }

      if (outcome === 'unavailable') {
        setDailyGoalReminderEnabled(false);
        await upsertUserSettings({
          user_id: user.id,
          daily_goal_reminder_enabled: false,
        });
        Alert.alert(t('notifications.unavailableTitle'), t('notifications.unavailableBody'));
        return;
      }

      setSnackbar({
        visible: true,
        message: nextEnabled ? t('notifications.enabled') : t('notifications.disabled'),
        type: 'success',
      });
    } catch (error) {
      logger.error('Failed toggling daily reminder', error);
      setDailyGoalReminderEnabled(!nextEnabled);
    }
  };

  const handleClosePasswordModal = () => {
    setPasswordModalVisible(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
  };

  const handleUpdatePassword = async () => {
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setSnackbar({
        visible: true,
        message: t('auth.passwordRequirementsPrefix') + validation.errors.join(', '),
        type: 'error',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSnackbar({ visible: true, message: t('auth.passwordMismatch'), type: 'error' });
      return;
    }
    try {
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      handleClosePasswordModal();
      setSnackbar({ visible: true, message: t('profile.passwordUpdated'), type: 'success' });
    } catch (error) {
      logger.error('Failed to update password', error);
      setSnackbar({ visible: true, message: t('profile.passwordUpdateFailed'), type: 'error' });
    } finally {
      setUpdatingPassword(false);
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
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('profile.premiumTitle')}</Text>
          <Text style={styles.sectionDescription}>{t('profile.premiumStatusInactive')}</Text>
          <Button
            label={t('profile.upgradeToPremium')}
            variant="primary"
            style={styles.rectButton}
            onPress={() => navigation.navigate('Auth', { mode: 'signin' })}
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
              {getUserDisplayName(user) === APPLE_USER_PLACEHOLDER ? t('profile.appleUser') : getUserDisplayName(user)}
            </Text>
            {isAdmin && (
              <View style={styles.adminChip}>
                <Text style={styles.adminChipText}>{t('profile.admin')}</Text>
              </View>
            )}
          </View>
        )}
        <Button
          label={t('settings.viewProgress')}
          variant="surface"
          style={styles.inlineActionButton}
          onPress={handleOpenProgress}
        />
        {!isGuest ? (
          <View style={styles.accountSecurityActions}>
            <Button
              label={t('profile.changePassword')}
              variant="outline"
              style={styles.inlineActionButton}
              onPress={() => setPasswordModalVisible(true)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('profile.premiumTitle')}</Text>
        <Text style={styles.sectionDescription}>
          {isPremium ? t('profile.premiumStatusActive') : t('profile.premiumStatusInactive')}
        </Text>
        {!isPremium ? <Button
            label={t('profile.upgradeToPremium')}
            variant="primary"
            style={styles.rectButton}
            onPress={handleUpgradePress}
            textStyle={styles.rectButtonText}
          /> : null}
        
        {!isGuest ? (
          <>
            <View style={styles.premiumActionsRow}>
              <Button
                label={t('profile.restorePurchases')}
                variant="surface"
                onPress={() => void handleRestorePress()}
                style={styles.premiumSecondaryButton}
              />
              {!isPremium ? (
                <Button
                  label={t('profile.removeAds')}
                  variant="outline"
                  onPress={() => openPaywallOrAuth('remove_ads', 'profile_remove_ads_button')}
                  style={styles.premiumSecondaryButton}
                />
              ) : null}
            </View>
            <View style={styles.premiumFooter}>
              <Text style={styles.premiumLegalText}>
                {t('profile.premiumLegal')}
              </Text>
              <TouchableOpacity style={styles.premiumFooterLinkRow} onPress={handleManageSubscription}>
                <Text style={styles.premiumFooterLink}>{t('profile.openAppleSubscriptions')}</Text>
                <Feather name="external-link" size={14} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.premiumFooterLinkRow} onPress={handleRequestRefund}>
                <Text style={styles.premiumFooterLink}>{t('profile.requestRefund')}</Text>
                <Feather name="external-link" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('profile.goalsTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('profile.goalsDescription')}</Text>
        <View style={styles.profileRow}>
          <Text style={styles.dropdownLabel}>{t('profile.primaryGoal')}</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setPickerOpen({ kind: 'primaryGoal' })}
          >
            <Text style={styles.dropdownText} numberOfLines={1}>
              {t(`goal.${primaryGoal}`)}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.goalHierarchyLabel}>{t('profile.subGoals')}</Text>
        <View style={styles.goalPillRow}>
          {([
            'reading_minutes',
            'words_saved',
            'words_learned',
          ] as GoalKey[]).filter((goal) => goal !== primaryGoal).map((goal) => {
            const selected = goalPriority.includes(goal);
            return (
              <Pressable
                key={`goal-priority-${goal}`}
                style={[
                  styles.goalPill,
                  selected && styles.goalPillSelected,
                ]}
                onPress={() => {
                  toggleGoalPriority(goal);
                  if (user) {
                    const nextPriority: GoalKey[] = goalPriority.includes(goal)
                      ? goalPriority.filter((g) => g !== goal)
                      : [...goalPriority, goal];
                    void upsertUserSettings({
                      user_id: user.id,
                      goal_priority: normalizeSubGoals(nextPriority, primaryGoal),
                    });
                  }
                }}
              >
                <Feather
                  name={selected ? 'check-square' : 'square'}
                  size={14}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.goalPillText, selected && styles.goalPillTextSelected]}>
                  {t(`goal.${goal}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {activeGoals.includes('reading_minutes') ? (
          <View style={styles.profileRow}>
            <Text style={styles.dropdownLabel}>{t('profile.dailyReadingGoal')}</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setPickerOpen({ kind: 'dailyReadingGoal' })}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {dailyReadingGoalMinutes} {t('profile.minutes')}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        {activeGoals.includes('words_saved') ? (
          <View style={styles.profileRow}>
            <Text style={styles.dropdownLabel}>{t('profile.dailySavedGoal')}</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setPickerOpen({ kind: 'dailySavedGoal' })}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>{dailyWordsSavedGoal}</Text>
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        {activeGoals.includes('words_learned') ? (
          <View style={styles.profileRow}>
            <Text style={styles.dropdownLabel}>{t('profile.dailyLearnedGoal')}</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setPickerOpen({ kind: 'dailyLearnedGoal' })}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>{dailyWordsLearnedGoal}</Text>
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.profileRow}>
          <Text style={styles.dropdownLabel}>{t('profile.dailyReminder')}</Text>
          <Button
            label={dailyGoalReminderEnabled ? t('notifications.disable') : t('notifications.enable')}
            variant="surface"
            size="sm"
            onPress={() => void handleToggleDailyReminder()}
            style={styles.goalReminderButton}
          />
        </View>
        {dailyGoalReminderEnabled ? (
          <View style={styles.profileRow}>
            <Text style={styles.dropdownLabel}>{t('profile.dailyReminderTime')}</Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setPickerOpen({ kind: 'dailyReminderTime' })}
            >
              <Text style={styles.dropdownText} numberOfLines={1}>
                {formatReminderTime(dailyGoalReminderHour, dailyGoalReminderMinute)}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.profileAd}>
        <AdBanner placement="profile_top" />
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
      <View style={[styles.section, styles.sectionLast]}>
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
        <AdBanner placement="profile_mid" />
      </View>

      {/* Replay tutorials — show in place */}
      <TouchableOpacity style={styles.replayTutorialRow} onPress={() => setShowHomeTutorial(true)}>
        <Feather name="home" size={20} color={colors.primary} />
        <Text style={styles.replayTutorialText}>{t('settings.replayHomeTutorial')}</Text>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.replayTutorialRow} onPress={() => setShowReaderTutorial(true)}>
        <Feather name="book" size={20} color={colors.primary} />
        <Text style={styles.replayTutorialText}>{t('settings.replayReaderTutorial')}</Text>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.profileAd}>
        <AdBanner placement="profile_bottom" />
      </View>

      {/* Feature requests */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('profile.featureRequestsTitle')}</Text>
        <Text style={styles.sectionDescription}>
          {t('profile.featureRequestsDesc')}
        </Text>
        <Button
          label={t('profile.submitFeatureRequest')}
          variant="surface"
          onPress={() => handleOpenUrl(LEGAL_URLS.features)}
        />
      </View>

      {/* Legal */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.legalDescription')}</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenUrl(LEGAL_URLS.privacy)}>
          <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenUrl(LEGAL_URLS.terms)}>
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
                  : pickerOpen?.kind === 'primaryGoal'
                    ? t('profile.primaryGoal')
                    : pickerOpen?.kind === 'dailyReminderTime'
                      ? t('profile.dailyReminderTime')
                  : pickerOpen?.kind === 'dailyReadingGoal'
                    ? t('profile.dailyReadingGoal')
                    : pickerOpen?.kind === 'dailySavedGoal'
                      ? t('profile.dailySavedGoal')
                      : pickerOpen?.kind === 'dailyLearnedGoal'
                        ? t('profile.dailyLearnedGoal')
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
            <View style={styles.deleteWarningBox}>
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text style={styles.deleteWarningText}>{t('profile.deleteAccountSubscriptionWarning')}</Text>
            </View>
            <View style={styles.deleteSubscriptionActions}>
              <TouchableOpacity style={styles.deleteLinkButton} onPress={handleManageSubscription}>
                <Text style={styles.deleteLinkButtonText}>{t('profile.deleteAccountManageSubscription')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.deleteCardBody}>{t('profile.deleteAccountTypeConfirm')}</Text>
            <View style={styles.deleteInputRow}>
              <TextInput
                style={[styles.deleteInput, deleteAccountMatch && styles.deleteInputMatch]}
                value={deleteAccountConfirm}
                onChangeText={setDeleteAccountConfirm}
                placeholder={deleteAccountKeyword}
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
      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={handleClosePasswordModal}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteCardTitle}>{t('profile.changePassword')}</Text>
            <Text style={styles.deleteCardBody}>{t('profile.changePasswordDescription')}</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.deleteInput, styles.passwordInput]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('profile.newPassword')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.passwordInputToggle}
                onPress={() => setShowNewPassword((v) => !v)}
                disabled={updatingPassword}
              >
                <Feather name={showNewPassword ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.deleteInput, styles.passwordInput]}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder={t('profile.confirmNewPassword')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showConfirmNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.passwordInputToggle}
                onPress={() => setShowConfirmNewPassword((v) => !v)}
                disabled={updatingPassword}
              >
                <Feather name={showConfirmNewPassword ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.deleteCardActions}>
              <TouchableOpacity style={styles.deleteCardButton} onPress={handleClosePasswordModal} disabled={updatingPassword}>
                <Text style={styles.deleteCardButtonText}>{t('study.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteCardButton, styles.primaryActionButton, updatingPassword && styles.deleteCardButtonDisabled]}
                onPress={() => void handleUpdatePassword()}
                disabled={updatingPassword}
              >
                <Text style={[styles.deleteCardButtonText, styles.primaryActionButtonText]}>
                  {updatingPassword ? t('profile.updatingPassword') : t('profile.updatePassword')}
                </Text>
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
      <HomeTutorialModal
        visible={showHomeTutorial}
        onComplete={() => setShowHomeTutorial(false)}
        onSkip={() => setShowHomeTutorial(false)}
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
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLast: {
    marginBottom: 0,
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
  dropdownLabel: {
    ...typography.small,
    color: colors.textSecondary,
    minWidth: 120,
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
  goalHierarchyLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  goalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  goalPillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  goalPillLocked: {
    opacity: 0.85,
  },
  goalPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  goalPillTextSelected: {
    color: colors.primary,
  },
  goalReminderButton: {
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
    marginBottom: spacing.md,
  },
  premiumActionsRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  premiumSecondaryButton: {
    width: '100%',
  },
  premiumLegalText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  premiumFooter: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  premiumFooterLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  premiumFooterLink: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
    flexShrink: 1,
  },
  replayTutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
  inlineActionButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
  accountSecurityActions: {
    marginTop: spacing.xs,
    gap: spacing.xs,
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
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  deleteWarningText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  deleteSubscriptionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  deleteLinkButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  deleteLinkButtonText: {
    ...typography.small,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
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
  primaryActionButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  primaryActionButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
  deleteCardButtonDisabled: {
    opacity: 0.5,
  },
  passwordInputWrap: {
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  passwordInput: {
    flex: 0,
    width: '100%',
    paddingRight: spacing.xxl + spacing.sm,
  },
  passwordInputToggle: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
