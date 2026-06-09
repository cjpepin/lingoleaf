import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export interface SegmentedTab {
  key: string;
  label: string;
  locked?: boolean;
}

interface Props {
  tabs: SegmentedTab[];
  activeKey: string;
  onPress: (key: string, locked: boolean) => void;
}

export function SegmentedTabs({ tabs, activeKey, onPress }: Props) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onPress(tab.key, tab.locked === true)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            {tab.locked ? <Feather name="lock" size={13} color={active ? colors.primary : colors.textSecondary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
});
