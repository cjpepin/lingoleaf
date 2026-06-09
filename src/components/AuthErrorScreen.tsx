/**
 * AuthErrorScreen
 *
 * Shown when auth init fails (e.g. network error). Offers retry.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/state/useAuthStore';
import { useTranslation } from '@/i18n/useTranslation';

export function AuthErrorScreen() {
  const { authError, initialize } = useAuthStore();
  const t = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('authError.title')}</Text>
      <Text style={styles.message}>
        {authError ?? t('authError.message')}
      </Text>
      <Button
        label={t('authError.retry')}
        variant="primary"
        onPress={() => initialize()}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    minWidth: 140,
  },
});
