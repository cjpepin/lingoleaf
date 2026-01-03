/**
 * UpgradeAccountPrompt
 *
 * Soft modal encouraging guest users to upgrade to a real account for backup/sync.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNotNow: () => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function UpgradeAccountPrompt({ visible, onClose, onNotNow }: Props) {
  const navigation = useNavigation<Nav>();

  const body = useMemo(
    () =>
      'Create an account to keep your saved words, highlights, and reading progress if you switch phones or reinstall.',
    []
  );

  return (
    <OverlayModal visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>Protect your progress</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Create account"
          variant="primary"
          onPress={() => {
            onClose();
            navigation.navigate('Auth', { mode: 'upgrade' });
          }}
        />
        <Button label="Not now" variant="surface" onPress={onNotNow} />
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


