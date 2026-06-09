/**
 * UpgradeAccountPrompt
 *
 * Soft modal encouraging guest users to upgrade to a real account for backup/sync.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import { track } from '@/analytics/client';
import { useTranslation } from '@/i18n/useTranslation';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNotNow: () => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function UpgradeAccountPrompt({ visible, onClose, onNotNow }: Props) {
  const navigation = useNavigation<Nav>();
  const t = useTranslation();
  const body = useMemo(() => t('upgradePrompt.body'), [t]);

  useEffect(() => {
    if (!visible) return;
    track('paywall_viewed', { placement: 'reader_upgrade_prompt', source: 'upgrade_prompt' });
  }, [visible]);

  return (
    <OverlayModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('upgradePrompt.title')}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('auth.signUp')}
          variant="primary"
          onPress={() => {
            track('purchase_started', {
              sku: 'premium_account_upgrade',
              placement: 'reader_upgrade_prompt',
              source: 'upgrade_prompt',
            });
            onClose();
            navigation.navigate('Auth', { mode: 'upgrade' });
          }}
        />
        <Button label={t('auth.keepDeleted')} variant="surface" onPress={onNotNow} />
      </View>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
  },
});
