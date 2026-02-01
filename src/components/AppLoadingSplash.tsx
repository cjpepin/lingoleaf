/**
 * AppLoadingSplash
 *
 * Centered app icon with soft shadow and loading spinner during initial auth load.
 */

import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

const ICON_SIZE = 80;

export function AppLoadingSplash() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Image
          source={require('../../assets/lingoleaf_icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={styles.spinner}
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
  iconWrapper: {
    width: ICON_SIZE + 24,
    height: ICON_SIZE + 24,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  spinner: {
    marginTop: spacing.xl,
  },
});
