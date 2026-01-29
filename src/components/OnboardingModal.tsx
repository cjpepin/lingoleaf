/**
 * OnboardingModal
 * Guided step-by-step user journey for first-time users
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
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { LANGUAGES } from '@/constants/languages';

interface Props {
  visible: boolean;
  onComplete: (data: {
    nativeLang: string;
    goalLangs: string[];
  }) => void;
  onSkip: () => void;
}

export function OnboardingModal({ visible, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(1);
  const [nativeLang, setNativeLang] = useState('en');
  const [goalLangs, setGoalLangs] = useState<string[]>([]);

  const handleNext = () => {
    if (step < 4) {
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
    if (step === 1) return true; // Welcome
    if (step === 2) return nativeLang.length > 0; // Native language
    if (step === 3) return goalLangs.length > 0; // Goal languages
    if (step === 4) return true; // Tour
    return false;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>
            Step {step} of 4
          </Text>
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipButton}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>📚</Text>
              <Text style={styles.title}>Welcome to LingoLeaf!</Text>
              <Text style={styles.description}>
                Your personal language learning companion. Read books in foreign languages, translate words
                instantly, and build your vocabulary.
              </Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🌍</Text>
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
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🎯</Text>
              <Text style={styles.title}>What languages do you want to learn?</Text>
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
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>✨</Text>
              <Text style={styles.title}>You're all set!</Text>
              <Text style={styles.description}>
                Here's what you can do in LingoLeaf:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📖</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>Browse Library</Text>
                    <Text style={styles.featureDescription}>
                      Discover books in your target languages
                    </Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>💬</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>Instant Translation</Text>
                    <Text style={styles.featureDescription}>
                      Select any word while reading to translate it
                    </Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📝</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>Build Vocabulary</Text>
                    <Text style={styles.featureDescription}>
                      Save words and study them with flashcards
                    </Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>👤</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>Manage Profile</Text>
                    <Text style={styles.featureDescription}>
                      Update preferences and track your progress
                    </Text>
                  </View>
                </View>
              </View>
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
              {step === 4 ? 'Get Started' : 'Next'}
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
  stepIndicator: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  skipButton: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
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
  },
  emoji: {
    fontSize: 72,
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
  featureList: {
    width: '100%',
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  featureDescription: {
    ...typography.body,
    color: colors.textSecondary,
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

