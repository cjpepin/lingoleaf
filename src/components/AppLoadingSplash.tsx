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
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 20,
  },
  spinner: {
    marginTop: spacing.xl,
  },
});
