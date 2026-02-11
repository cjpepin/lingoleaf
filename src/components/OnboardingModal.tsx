/**
 * OnboardingModal
 * Guided step-by-step user journey for first-time users
 * Steps 1-3: Language setup, Steps 4-6: Feature tour, Step 7: Terms
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { LANGUAGES } from '@/constants/languages';
import { useTranslation } from '@/i18n/useTranslation';

const TOTAL_STEPS = 7;

interface Props {
  visible: boolean;
  onComplete: (data: {
    nativeLang: string;
    goalLangs: string[];
  }) => void;
  onSkip: () => void;
}

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

export function OnboardingModal({ visible, onComplete, onSkip }: Props) {
  const t = useTranslation();
  const [step, setStep] = useState(1);
  const [nativeLang, setNativeLang] = useState('en');
  const [goalLangs, setGoalLangs] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      onComplete({ nativeLang, goalLangs });
    }
  };

  const handleSkip = () => {
    onSkip();
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

  const getButtonLabel = () => {
    if (step === TOTAL_STEPS) return t('onboarding.getStarted');
    return 'Next';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <DotIndicator current={step} total={TOTAL_STEPS} />
          {step !== TOTAL_STEPS ? (
            <Pressable onPress={handleSkip}>
              <Text style={styles.skipButton}>{t('tutorial.skip')}</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Step 1: Welcome */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="book-open" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>Welcome to LingoLeaf!</Text>
              <Text style={styles.description}>
                Your personal language learning companion. Read books in foreign languages, translate words
                instantly, and build your vocabulary.
              </Text>
            </View>
          )}

          {/* Step 2: Native language */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.iconWrapper}>
                <Feather name="globe" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>What's your native language?</Text>
              <Text style={styles.description}>
                We'll use this to provide better translations and learning recommendations.
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
              <Text style={styles.title}>What language(s) do you want to learn?</Text>
              <Text style={styles.description}>
                Select one or more languages. You can always change this later.
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

          {/* Step 4: Feature - Read */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="book-open" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.readTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.readDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="download" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Offline reading</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="globe" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Multiple languages</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 5: Feature - Translate */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="type" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.translateTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.translateDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="edit-3" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Highlight words</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="save" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Save to lists</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 6: Feature - Study */}
          {step === 6 && (
            <View style={styles.stepContent}>
              <View style={styles.featureIconCircle}>
                <Feather name="layers" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboarding.studyTitle')}</Text>
              <Text style={styles.description}>{t('onboarding.studyDesc')}</Text>
              <View style={styles.featureVisual}>
                <View style={styles.miniCard}>
                  <Feather name="repeat" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Spaced repetition</Text>
                </View>
                <View style={styles.miniCard}>
                  <Feather name="trending-up" size={20} color={colors.textSecondary} />
                  <Text style={styles.miniCardText}>Track progress</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 7: Terms — user must accept to proceed */}
          {step === 7 && (
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
                  onPress={() => Linking.openURL('https://lingoleaf.app/terms-and-conditions')}
                >
                  <Text style={styles.linkText}>{t('onboarding.viewTerms')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://lingoleaf.app/privacy-policy')}
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
              <Text style={styles.buttonSecondaryText}>Back</Text>
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
