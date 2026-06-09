/**
 * OnboardingModal
 * Guided step-by-step user journey for first-time users
 * Steps 1-4: Language + goals setup, Steps 5-8: Feature tour, Step 9: Terms
 */

import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Linking,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { LANGUAGES } from '@/constants/languages';
import { useTranslation } from '@/i18n/useTranslation';
import { LEGAL_URLS } from '@/constants/legal';
import { defaultSubGoals, getActiveGoals, type GoalKey, normalizeSubGoals } from '@/utils/goalHierarchy';
import { requestDailyGoalReminderPermission } from '@/notifications/dailyGoalReminder';

const TOTAL_STEPS = 9;
const READING_MIN = 5;
const READING_MAX = 60;
const READING_STEP = 5;
const SAVED_MIN = 5;
const SAVED_MAX = 50;
const SAVED_STEP = 5;
const LEARNED_MIN = 1;
const LEARNED_MAX = 15;

interface Props {
  visible: boolean;
  onComplete: (data: {
    nativeLang: string;
    goalLangs: string[];
    dailyGoalMinutes: number;
    dailyWordsSavedGoal: number;
    dailyWordsLearnedGoal: number;
    dailyGoalReminderEnabled: boolean;
    primaryGoal: GoalKey;
    goalPriority: GoalKey[];
  }) => void;
  onSkip: () => void;
}

const GOAL_OPTIONS: ReadonlyArray<{ key: GoalKey; icon: 'book-open' | 'bookmark' | 'check-circle' }> = [
  { key: 'reading_minutes', icon: 'book-open' },
  { key: 'words_saved', icon: 'bookmark' },
  { key: 'words_learned', icon: 'check-circle' },
];

function DotIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i + 1 === current && styles.dotActive]}
        />
      ))}
    </View>
  );
}

export function OnboardingModal({ visible, onComplete }: Props) {
  const t = useTranslation();
  const [step, setStep] = useState(1);
  const [nativeLang, setNativeLang] = useState('en');
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(10);
  const [dailyWordsSavedGoal, setDailyWordsSavedGoal] = useState<number>(10);
  const [dailyWordsLearnedGoal, setDailyWordsLearnedGoal] = useState<number>(5);
  const [dailyGoalReminderEnabled, setDailyGoalReminderEnabled] = useState(true);
  const [dailyGoalMinutesInput, setDailyGoalMinutesInput] = useState('10');
  const [dailyWordsSavedGoalInput, setDailyWordsSavedGoalInput] = useState('10');
  const [dailyWordsLearnedGoalInput, setDailyWordsLearnedGoalInput] = useState('5');
  const [primaryGoal, setPrimaryGoal] = useState<GoalKey>('reading_minutes');
  const [goalPriority, setGoalPriority] = useState<GoalKey[]>(defaultSubGoals('reading_minutes'));
  const [goalCapsReached, setGoalCapsReached] = useState({
    minutes: false,
    saved: false,
    learned: false,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const normalizeStep = (value: number, min: number, max: number, step: number) => {
    const clamped = clamp(value, min, max);
    return Math.round(clamped / step) * step;
  };

  const finalizeReadingGoal = (): number => {
    const parsed = Number(dailyGoalMinutesInput);
    const normalized = normalizeStep(Number.isFinite(parsed) ? parsed : dailyGoalMinutes, READING_MIN, READING_MAX, READING_STEP);
    setGoalCapsReached((prev) => ({
      ...prev,
      minutes: Number.isFinite(parsed) && parsed >= READING_MAX,
    }));
    setDailyGoalMinutes(normalized);
    setDailyGoalMinutesInput(String(normalized));
    return normalized;
  };

  const finalizeSavedGoal = (): number => {
    const parsed = Number(dailyWordsSavedGoalInput);
    const normalized = normalizeStep(Number.isFinite(parsed) ? parsed : dailyWordsSavedGoal, SAVED_MIN, SAVED_MAX, SAVED_STEP);
    setGoalCapsReached((prev) => ({
      ...prev,
      saved: Number.isFinite(parsed) && parsed >= SAVED_MAX,
    }));
    setDailyWordsSavedGoal(normalized);
    setDailyWordsSavedGoalInput(String(normalized));
    return normalized;
  };

  const finalizeLearnedGoal = (): number => {
    const parsed = Number(dailyWordsLearnedGoalInput);
    const normalized = clamp(Math.round(Number.isFinite(parsed) ? parsed : dailyWordsLearnedGoal), LEARNED_MIN, LEARNED_MAX);
    setGoalCapsReached((prev) => ({
      ...prev,
      learned: Number.isFinite(parsed) && parsed >= LEARNED_MAX,
    }));
    setDailyWordsLearnedGoal(normalized);
    setDailyWordsLearnedGoalInput(String(normalized));
    return normalized;
  };

  const finalizeGoalInputs = () => {
    const minutes = finalizeReadingGoal();
    const saved = finalizeSavedGoal();
    const learned = finalizeLearnedGoal();
    return { minutes, saved, learned };
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      if (step === 4) {
        if (dailyGoalReminderEnabled) {
          const permission = await requestDailyGoalReminderPermission();
          if (permission === 'denied') {
            setDailyGoalReminderEnabled(false);
            Alert.alert(t('notifications.permissionTitle'), t('notifications.permissionBody'));
          } else if (permission === 'unavailable') {
            setDailyGoalReminderEnabled(false);
            Alert.alert(t('notifications.unavailableTitle'), t('notifications.unavailableBody'));
          }
        }
        finalizeGoalInputs();
      }
      setStep(step + 1);
    } else {
      const finalizedGoals = finalizeGoalInputs();
      onComplete({
        nativeLang,
        goalLangs,
        dailyGoalMinutes: finalizedGoals.minutes,
        dailyWordsSavedGoal: finalizedGoals.saved,
        dailyWordsLearnedGoal: finalizedGoals.learned,
        dailyGoalReminderEnabled,
        primaryGoal,
        goalPriority,
      });
    }
  };

  const toggleGoalLang = (code: string) => {
    if (goalLangs.includes(code)) {
      setGoalLangs(goalLangs.filter((l) => l !== code));
    } else {
      setGoalLangs([...goalLangs, code]);
    }
  };

  const canProceed = () => {
    if (step === 2) return nativeLang.length > 0;
    if (step === 3) return goalLangs.length > 0;
    if (step === TOTAL_STEPS) return termsAccepted;
    return true;
  };

  const toggleGoalPriority = (goal: GoalKey) => {
    if (goal === primaryGoal) return;
    if (goalPriority.includes(goal)) {
      setGoalPriority(goalPriority.filter((g) => g !== goal));
      return;
    }
    setGoalPriority([...goalPriority, goal]);
  };

  const setPrimaryWithPriority = (goal: GoalKey) => {
    setPrimaryGoal(goal);
    setGoalPriority((prev) => normalizeSubGoals(prev, goal));
  };

  const getButtonLabel = () => {
    if (step === TOTAL_STEPS) return t('onboarding.getStarted');
    return t('tutorial.next');
  };

  const activeGoals = getActiveGoals(primaryGoal, goalPriority);
  const showGoalCapNotice =
    activeGoals.some((goal) =>
      goal === 'reading_minutes'
        ? goalCapsReached.minutes
        : goal === 'words_saved'
          ? goalCapsReached.saved
          : goalCapsReached.learned
    );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <DotIndicator current={step} total={TOTAL_STEPS} />
          <View style={styles.skipPlaceholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Step 1: Welcome */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="book-open" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.welcomeTitle')}</Text>
              <Text style={styles.description}>
                {t('onboarding.welcomeDesc')}
              </Text>
            </View>
          )}

          {/* Step 2: Native language */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="globe" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.nativeLanguageTitle')}</Text>
              <Text style={styles.description}>
                {t('onboarding.nativeLanguageDesc')}
              </Text>
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
          )}

          {/* Step 3: Goal languages */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="book" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.goalLanguagesTitle')}</Text>
              <Text style={styles.description}>
                {t('onboarding.goalLanguagesDesc')}
              </Text>
              <View style={styles.languageGrid}>
                {LANGUAGES.filter((l) => l.code !== nativeLang).map((lang) => (
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
          )}

          {/* Step 4: Daily reading goal */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="target" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.goalFocusTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.goalFocusDescription')}</Text>

              <Text style={styles.sectionLabel}>{t('onboarding.primaryGoal')}</Text>
              <View style={styles.goalTypeRow}>
                {GOAL_OPTIONS.map((item) => {
                  const selected = primaryGoal === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.goalTypeOption, selected && styles.goalTypeOptionSelected]}
                      onPress={() => setPrimaryWithPriority(item.key)}
                    >
                      <Feather name={item.icon} size={14} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.goalTypeText, selected && styles.goalTypeTextSelected]}>
                        {t(`goal.${item.key}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>{t('onboarding.subGoals')}</Text>
              <View style={styles.goalTypeRow}>
                {GOAL_OPTIONS.filter((item) => item.key !== primaryGoal).map((item) => {
                  const selected = goalPriority.includes(item.key);
                  return (
                    <TouchableOpacity
                      key={`sub-${item.key}`}
                      style={[styles.goalTypeOption, selected && styles.goalTypeOptionSelected]}
                      onPress={() => toggleGoalPriority(item.key)}
                    >
                      <Feather
                        name={selected ? 'check-square' : 'square'}
                        size={14}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.goalTypeText, selected && styles.goalTypeTextSelected]}>
                        {t(`goal.${item.key}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>{t('profile.goalsTitle')}</Text>
              <View style={styles.goalInputCard}>
                {activeGoals.includes('reading_minutes') ? (
                  <View style={styles.goalInputRow}>
                    <Text style={styles.goalInputLabel}>{t('settings.dailyReadingGoalTitle')}</Text>
                    <View style={styles.goalInputControl}>
                      <TextInput
                        style={styles.goalInput}
                        keyboardType="number-pad"
                        value={dailyGoalMinutesInput}
                        onChangeText={(text) => {
                          const next = text.replace(/[^0-9]/g, '');
                          setDailyGoalMinutesInput(next);
                          const parsed = next.length > 0 ? Number(next) : NaN;
                          setGoalCapsReached((prev) => ({
                            ...prev,
                            minutes: Number.isFinite(parsed) && parsed >= READING_MAX,
                          }));
                        }}
                        onBlur={finalizeReadingGoal}
                        maxLength={2}
                      />
                      <Text style={styles.goalInputSuffix}>{t('profile.minutes')}</Text>
                    </View>
                  </View>
                ) : null}
                {activeGoals.includes('words_saved') ? (
                  <View style={styles.goalInputRow}>
                    <Text style={styles.goalInputLabel}>{t('profile.dailySavedGoal')}</Text>
                    <View style={styles.goalInputControl}>
                      <TextInput
                        style={styles.goalInput}
                        keyboardType="number-pad"
                        value={dailyWordsSavedGoalInput}
                        onChangeText={(text) => {
                          const next = text.replace(/[^0-9]/g, '');
                          setDailyWordsSavedGoalInput(next);
                          const parsed = next.length > 0 ? Number(next) : NaN;
                          setGoalCapsReached((prev) => ({
                            ...prev,
                            saved: Number.isFinite(parsed) && parsed >= SAVED_MAX,
                          }));
                        }}
                        onBlur={finalizeSavedGoal}
                        maxLength={2}
                      />
                    </View>
                  </View>
                ) : null}
                {activeGoals.includes('words_learned') ? (
                  <View style={styles.goalInputRow}>
                    <Text style={styles.goalInputLabel}>{t('profile.dailyLearnedGoal')}</Text>
                    <View style={styles.goalInputControl}>
                      <TextInput
                        style={styles.goalInput}
                        keyboardType="number-pad"
                        value={dailyWordsLearnedGoalInput}
                        onChangeText={(text) => {
                          const next = text.replace(/[^0-9]/g, '');
                          setDailyWordsLearnedGoalInput(next);
                          const parsed = next.length > 0 ? Number(next) : NaN;
                          setGoalCapsReached((prev) => ({
                            ...prev,
                            learned: Number.isFinite(parsed) && parsed >= LEARNED_MAX,
                          }));
                        }}
                        onBlur={finalizeLearnedGoal}
                        maxLength={2}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
              {showGoalCapNotice ? (
                <Text style={styles.goalCapNotice}>{t('onboarding.goalCapNotice')}</Text>
              ) : null}
              <Text style={styles.sectionLabel}>{t('profile.dailyReminder')}</Text>
              <View style={styles.reminderCard}>
                <Text style={styles.reminderPrompt}>{t('onboarding.remindersPrompt')}</Text>
                <View style={styles.reminderToggleRow}>
                  <TouchableOpacity
                    style={[styles.reminderToggleButton, dailyGoalReminderEnabled && styles.reminderToggleButtonActive]}
                    onPress={() => setDailyGoalReminderEnabled(true)}
                  >
                    <Text style={[styles.reminderToggleText, dailyGoalReminderEnabled && styles.reminderToggleTextActive]}>
                      {t('notifications.enable')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reminderToggleButton, !dailyGoalReminderEnabled && styles.reminderToggleButtonActive]}
                    onPress={() => setDailyGoalReminderEnabled(false)}
                  >
                    <Text style={[styles.reminderToggleText, !dailyGoalReminderEnabled && styles.reminderToggleTextActive]}>
                      {t('notifications.disable')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Step 5: Feature - Read */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="book-open" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.readTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.readDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="download" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.offlineReading')}</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="globe" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.multipleLanguages')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 6: Feature - Translate */}
          {step === 6 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="type" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.translateTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.translateDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="edit-3" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.highlightWords')}</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="save" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.saveToLists')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 7: Feature - Study */}
          {step === 7 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="layers" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.studyTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.studyDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="repeat" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.spacedRepetition')}</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="trending-up" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>{t('onboarding.trackProgress')}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 8: Feature requests */}
          {step === 8 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="message-circle" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.helpShapeTitle')}</Text>
              <Text style={styles.description}>
                {t('onboarding.helpShapeDesc')}
              </Text>
              <TouchableOpacity
                style={styles.featureRequestButton}
                onPress={() => Linking.openURL(LEGAL_URLS.features)}
              >
                <Text style={styles.featureRequestButtonText}>{t('onboarding.submitFeatureRequest')}</Text>
              </TouchableOpacity>
              <Text style={styles.featureRequestSubtext}>{t('onboarding.featureRequestLater')}</Text>
            </View>
          )}

          {/* Step 9: Terms — user must accept to proceed */}
          {step === 9 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="check-circle" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.termsTitle')}</Text>
              <Text style={styles.description}>
                {t('onboarding.termsDescription')}
              </Text>
              <View style={styles.termsLinks}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(LEGAL_URLS.terms)}
                >
                  <Text style={styles.linkText}>{t('onboarding.viewTerms')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
                >
                  <Text style={styles.linkText}>{t('onboarding.viewPrivacy')}</Text>
                </TouchableOpacity>
              </View>
              <Pressable
                style={[styles.termsAcceptRow, termsAccepted && styles.termsAcceptRowChecked]}
                onPress={() => setTermsAccepted((v) => !v)}
              >
                <Feather name={termsAccepted ? 'check-square' : 'square'} size={24} color={termsAccepted ? colors.primary : colors.textSecondary} />
                <Text style={styles.termsAcceptText}>{t('onboarding.acceptTerms')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.buttonSecondaryText}>{t('tutorial.back')}</Text>
            </TouchableOpacity>
          )}
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, !canProceed() && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text style={styles.buttonPrimaryText}>
                {getButtonLabel()}
              </Text>
            </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  skipButton: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  skipPlaceholder: {
    minWidth: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepContent: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  iconWrapper: {
    marginBottom: spacing.lg,
  },
  featureIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  featureVisual: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  miniCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniCardText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  goalTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  goalTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  goalTypeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  goalTypeOptionLocked: {
    opacity: 0.85,
  },
  goalTypeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  goalTypeTextSelected: {
    color: colors.primary,
  },
  goalInputCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  goalCapNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalInputLabel: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  goalInputControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 88,
    justifyContent: 'flex-end',
  },
  goalInput: {
    ...typography.body,
    color: colors.text,
    minWidth: 56,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  goalInputSuffix: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    minWidth: 24,
  },
  reminderCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reminderPrompt: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderToggleButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  reminderToggleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  reminderToggleText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  reminderToggleTextActive: {
    color: colors.primary,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
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
    color: colors.surface,
    fontWeight: '600',
  },
  featureRequestButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  featureRequestButtonText: {
    ...typography.button,
    color: colors.surface,
    fontWeight: '600',
  },
  featureRequestSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  termsLinks: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  termsAcceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
  },
  termsAcceptRowChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  termsAcceptText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    ...typography.button,
    color: colors.surface,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '600',
  },
});
