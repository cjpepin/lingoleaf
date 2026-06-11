/**
 * Portfolio demo disclaimer shown on web builds.
 */

import React from 'react';
import { Linking, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { isWebDemo } from '@/demo/config';
import { colors, spacing, typography } from '@/theme';

const portfolioProjects = (() => {
  const raw = process.env.EXPO_PUBLIC_PORTFOLIO_URL?.trim();
  const home = raw && raw.length > 0 ? raw : 'https://connorjpepin.com/';
  return `${home.replace(/\/$/, '')}/#projects`;
})();

function isStandaloneDemo(): boolean {
  if (typeof window === 'undefined') return false;
  return window.self === window.top;
}

export function DemoBanner() {
  if (!isWebDemo()) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        LingoLeaf web demo — changes stay in your browser. Translation is rate-limited via the portfolio demo API.
      </Text>
      {isStandaloneDemo() && Platform.OS === 'web' ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(portfolioProjects);
          }}
        >
          <Text style={styles.link}>← Back to portfolio</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.highlightMint,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  text: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
  link: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
