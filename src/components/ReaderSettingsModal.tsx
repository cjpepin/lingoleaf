/**
 * ReaderSettingsModal
 * Reader preferences: highlight on translate, font size, font, highlight color
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import {
  useReaderSettingsStore,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  FONT_FAMILIES,
  HIGHLIGHT_COLORS,
} from '@/state/useReaderSettingsStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { upsertUserSettings } from '@/supabase/queries';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSettingsChange?: () => void; // Call when font/size changes (page count may need refresh)
}

const FONT_KEY: Record<string, string> = {
  inherit: 'readerSettings.fontInherit',
  Georgia: 'readerSettings.fontGeorgia',
  Palatino: 'readerSettings.fontPalatino',
  'Times New Roman': 'readerSettings.fontTimesNewRoman',
  serif: 'readerSettings.fontSerif',
  'sans-serif': 'readerSettings.fontSansSerif',
};

const COLOR_KEY: Record<string, string> = {
  mint: 'readerSettings.colorMint',
  yellow: 'readerSettings.colorYellow',
  pink: 'readerSettings.colorPink',
};

export function ReaderSettingsModal({ visible, onClose, onSettingsChange }: Props) {
  const t = useTranslation();
  const { user } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const {
    highlightOnTranslate,
    fontSize,
    fontFamily,
    highlightColor,
    setHighlightOnTranslate,
    setFontSize,
    setFontFamily,
    setHighlightColor,
  } = useReaderSettingsStore();

  const saveToBackend = async () => {
    if (!user) return;
    try {
      await upsertUserSettings({
        user_id: user.id,
        reader_highlight_on_translate: highlightOnTranslate,
        reader_font_size: fontSize,
        reader_font_family: fontFamily,
        reader_highlight_color: highlightColor,
      });
      onSettingsChange?.();
    } catch (e) {
      console.error('Failed to save reader settings', e);
    }
  };

  useEffect(() => {
    if (visible && user) {
      loadSettings(user.id);
    }
  }, [visible, user, loadSettings]);

  const handleClose = async () => {
    await saveToBackend();
    onClose();
  };

  return (
    <OverlayModal visible={visible} onClose={handleClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('readerSettings.title')}</Text>
        <Pressable onPress={handleClose}>
          <Text style={styles.close}>{t('readerSettings.done')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator
      >
        <View style={styles.row}>
          <Text style={styles.label}>{t('readerSettings.highlightOnTranslate')}</Text>
          <View style={styles.switchWrap}>
            <Switch
              value={highlightOnTranslate}
              onValueChange={setHighlightOnTranslate}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('readerSettings.fontSize')}</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{FONT_SIZE_MIN}px</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={FONT_SIZE_MIN}
              maximumValue={FONT_SIZE_MAX}
              step={FONT_SIZE_STEP}
              value={Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, parseInt(fontSize, 10) || FONT_SIZE_MIN))}
              onValueChange={(v) => setFontSize(`${Math.round(v)}px`)}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
          <Text style={styles.sliderLabel}>{FONT_SIZE_MAX}px</Text>
        </View>
        <Text style={styles.sliderValue}>{fontSize}</Text>

        <Text style={styles.sectionTitle}>{t('readerSettings.font')}</Text>
        <View style={styles.chipRow}>
          {FONT_FAMILIES.map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, fontFamily === f && styles.chipSelected]}
              onPress={() => setFontFamily(f)}
            >
              <Text style={[styles.chipText, fontFamily === f && styles.chipTextSelected]}>
                {t(FONT_KEY[f] ?? f)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('readerSettings.highlightColor')}</Text>
        <View style={styles.chipRow}>
          {HIGHLIGHT_COLORS.map((c) => (
            <Pressable
              key={c.value}
              style={[
                styles.chip,
                highlightColor === c.value && styles.chipSelected,
                { borderColor: c.hex },
              ]}
              onPress={() => setHighlightColor(c.value)}
            >
              <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
              <Text style={[styles.chipText, highlightColor === c.value && styles.chipTextSelected]}>
                {t(COLOR_KEY[c.value])}
              </Text>
            </Pressable>
          ))}
        </View>
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
  content: {
    maxHeight: 400,
  },
  contentContainer: {
    flexGrow: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minWidth: 0,
  },
  switchWrap: {
    flexShrink: 0,
    paddingRight: spacing.md,
    alignItems: 'flex-end',
  },
  label: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    minWidth: 32,
  },
  sliderValue: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
  },
  chipTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
