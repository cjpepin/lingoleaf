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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
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
      {/* Debug section - remove after testing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Info</Text>
        <Text style={styles.sectionDescription}>
          User ID: {user?.id || 'No user'}
        </Text>
        <Text style={styles.sectionDescription}>
          Is Admin: {isAdmin ? 'Yes' : 'No'}
        </Text>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin</Text>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={handleAdminPress}
          >
            <Text style={styles.adminButtonText}>🔧 Admin Panel</Text>
          </TouchableOpacity>
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
  adminButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
});

