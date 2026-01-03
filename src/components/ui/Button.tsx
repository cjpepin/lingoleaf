/**
 * Button
 *
 * Reusable button with theme-consistent variants/sizes.
 * Use this for most tappable actions instead of re-creating styles per screen.
 */

import React from 'react';
import { Pressable, Text, View, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type Variant = 'primary' | 'surface' | 'outline' | 'danger';
type Size = 'sm' | 'md';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'surface',
  size = 'md',
  style,
  textStyle: textStyleOverride,
  leftIcon,
  rightIcon,
}: Props) {
  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    styles[size],
    styles[variant],
    disabled ? styles.disabled : null,
    style,
  ];

  const textStyle: StyleProp<TextStyle> = [
    styles.textBase,
    styles[`text_${size}`],
    styles[`text_${variant}`],
    disabled ? styles.textDisabled : null,
    textStyleOverride,
  ];

  return (
    <Pressable onPress={onPress} disabled={disabled} style={containerStyle}>
      <View style={styles.inner}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <Text style={textStyle} numberOfLines={1}>
          {label}
        </Text>
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },

  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
  },

  disabled: {
    opacity: 0.5,
  },

  textBase: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  text_sm: {
    ...typography.bodySmall,
  },
  text_md: {
    ...typography.body,
  },
  text_primary: {
    color: colors.surface,
  },
  text_surface: {
    color: colors.text,
  },
  text_outline: {
    color: colors.text,
  },
  text_danger: {
    color: colors.error,
  },
  textDisabled: {},
});


