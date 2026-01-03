/**
 * SettingsScreen
 * App settings (non-language; language prefs live in Profile)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { checkIsAdmin } from '@/supabase/queries';
import { Button } from '@/components/ui/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isGuest } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      logger.info('Checking admin status for user:', user.id);
      checkIsAdmin(user.id).then((isAdminResult) => {
        logger.info('Admin check result:', isAdminResult);
        setIsAdmin(isAdminResult);
      }).catch((error) => {
        logger.error('Failed to check admin status:', error);
      });
    }
  }, [user]);

  const handleAdminPress = () => {
    navigation.navigate('Admin');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {isGuest ? (
          <>
            <Text style={styles.sectionDescription}>You’re using a guest account on this device.</Text>
            <Button label="Sign in / Create account" variant="primary" style={styles.rectButton} onPress={() => navigation.navigate('Auth')} />
          </>
        ) : (
          <Text style={styles.sectionDescription}>You’re signed in.</Text>
        )}
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <Button label="Admin Panel" variant="surface" onPress={handleAdminPress} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rectButton: {
    borderRadius: 8,
  },
});

