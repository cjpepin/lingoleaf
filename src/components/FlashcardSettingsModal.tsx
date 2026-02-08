/**
 * FlashcardSettingsModal
 * Study preferences: term/translation first, interval settings.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/useTranslation';
import { colors, spacing, typography } from '@/theme';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import {
  useFlashcardSettingsStore,
  AGAIN_CARDS_MIN,
  AGAIN_CARDS_MAX,
  INTERVAL_HARD_MIN,
  INTERVAL_HARD_MAX,
  INTERVAL_GOOD_MIN,
  INTERVAL_GOOD_MAX,
  INTERVAL_EASY_MIN,
  INTERVAL_EASY_MAX,
  MULTIPLIER_MIN,
  MULTIPLIER_MAX,
  type StudyMethod,
} from '@/state/useFlashcardSettingsStore';
import { upsertUserSettings } from '@/supabase/queries';

interface Props {
  visible: boolean;
  onClose: () => void;
  showTranslationFirst: boolean;
  onShowTranslationFirstChange: (value: boolean) => void;
  onResetProgress?: () => void;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / (24 * 60))}d`;
}

export function FlashcardSettingsModal({
  visible,
  onClose,
  showTranslationFirst,
  onShowTranslationFirstChange,
  onResetProgress,
}: Props) {
  const { user } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const t = useTranslation();
  const {
    againCards,
    intervalHardMin,
    intervalGoodMin,
    intervalEasyMin,
    multiplier,
    setAgainCards,
    setIntervalHardMin,
    setIntervalGoodMin,
    setIntervalEasyMin,
    setMultiplier,
  } = useFlashcardSettingsStore();

  useEffect(() => {
    if (visible && user) loadSettings(user.id);
  }, [visible, user, loadSettings]);

  const handleClose = async () => {
    if (user) {
      const s = useFlashcardSettingsStore.getState();
      await upsertUserSettings({
        user_id: user.id,
        flashcard_again_cards: s.againCards,
        flashcard_interval_hard_min: s.intervalHardMin,
        flashcard_interval_good_min: s.intervalGoodMin,
        flashcard_interval_easy_min: s.intervalEasyMin,
        flashcard_interval_multiplier: s.multiplier,
      });
    }
    onClose();
  };

  return (
    <OverlayModal visible={visible} onClose={handleClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('flashcardSettings.title')}</Text>
        <Pressable onPress={handleClose}>
          <Text style={styles.close}>{t('flashcardSettings.done')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Text style={styles.sectionTitle}>{t('flashcardSettings.showTranslationFirst')}</Text>
              <Text style={styles.toggleHelp}>
                {showTranslationFirst
                  ? t('flashcardSettings.translationToTerm')
                  : t('flashcardSettings.termToTranslation')}
              </Text>
            </View>
            <Switch
              value={showTranslationFirst}
              onValueChange={onShowTranslationFirstChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <View style={[styles.sectionCard, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>{t('flashcardSettings.intervals')}</Text>
          <Text style={styles.description}>{t('flashcardSettings.intervalsDesc')}</Text>

          <View style={styles.sliderGroup}>
            <View style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>{t('flashcardSettings.againCards')}</Text>
                <Text style={styles.sliderHelp}>{t('flashcardSettings.againCardsHelp')}</Text>
              </View>
              <Text style={styles.sliderValue}>{againCards}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={AGAIN_CARDS_MIN}
                maximumValue={AGAIN_CARDS_MAX}
                step={1}
                value={againCards}
                onValueChange={(v) => setAgainCards(Math.round(v))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.sliderGroup}>
            <View style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>Hard</Text>
                <Text style={styles.sliderHelp}>{t('flashcardSettings.hardDesc')}</Text>
              </View>
              <Text style={styles.sliderValue}>{formatMinutes(intervalHardMin)}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={INTERVAL_HARD_MIN}
                maximumValue={INTERVAL_HARD_MAX}
                step={5}
                value={intervalHardMin}
                onValueChange={(v) => setIntervalHardMin(Math.round(v))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.sliderGroup}>
            <View style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>Good</Text>
                <Text style={styles.sliderHelp}>{t('flashcardSettings.goodDesc')}</Text>
              </View>
              <Text style={styles.sliderValue}>{formatMinutes(intervalGoodMin)}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={INTERVAL_GOOD_MIN}
                maximumValue={INTERVAL_GOOD_MAX}
                step={60}
                value={intervalGoodMin}
                onValueChange={(v) => setIntervalGoodMin(Math.round(v))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.sliderGroup}>
            <View style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>Easy</Text>
                <Text style={styles.sliderHelp}>{t('flashcardSettings.easyDesc')}</Text>
              </View>
              <Text style={styles.sliderValue}>{formatMinutes(intervalEasyMin)}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={INTERVAL_EASY_MIN}
                maximumValue={INTERVAL_EASY_MAX}
                step={24 * 60}
                value={intervalEasyMin}
                onValueChange={(v) => setIntervalEasyMin(Math.round(v))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.sliderGroup}>
            <View style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>{t('flashcardSettings.increaseOnRepeat')}</Text>
                <Text style={styles.sliderHelp}>{t('flashcardSettings.increaseDesc')}</Text>
              </View>
              <Text style={styles.sliderValue}>{multiplier}x</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={MULTIPLIER_MIN}
                maximumValue={MULTIPLIER_MAX}
                step={0.25}
                value={multiplier}
                onValueChange={(v) => setMultiplier(Math.round(v * 100) / 100)}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>
        </View>

        {onResetProgress ? (
          <View style={styles.resetSection}>
            <Text style={styles.resetTitle}>{t('flashcardSettings.resetTitle')}</Text>
            <Text style={styles.resetDescription}>{t('flashcardSettings.resetDescription')}</Text>
            <Button
              label={t('flashcardSettings.resetProgress')}
              variant="outline"
              onPress={onResetProgress}
              style={styles.resetButton}
            />
          </View>
        ) : null}
      </ScrollView>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  close: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 400,
  },
  content: {
    gap: spacing.md,
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  sliderLabel: {
    ...typography.bodySmall,
    color: colors.text,
  },
  sliderValue: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  sliderContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sliderGroup: {
    marginTop: spacing.md,
  },
  sliderHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionSpacing: {
    marginTop: spacing.lg,
  },
  resetSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  resetTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  resetDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resetButton: {
    marginTop: spacing.sm,
  },
});
