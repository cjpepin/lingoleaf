/**
 * AnalyticsDebugScreen
 *
 * Development-only analytics inspector.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { analyticsClient, flushAnalytics, type AnalyticsDebugSnapshot } from '@/analytics/client';
import { useTranslation } from '@/i18n/useTranslation';

export default function AnalyticsDebugScreen() {
  const t = useTranslation();
  const [snapshot, setSnapshot] = useState<AnalyticsDebugSnapshot>(analyticsClient.getDebugSnapshot());

  useEffect(() => {
    return analyticsClient.subscribeDebug(setSnapshot);
  }, []);

  const events = useMemo(() => {
    return [...snapshot.recent].reverse().slice(0, 200);
  }, [snapshot.recent]);

  const copyEvents = (): void => {
    const json = JSON.stringify({ queued: snapshot.queued, recent: events }, null, 2);
    try {
      Clipboard.setString(json);
      Alert.alert(t('analyticsDebug.copiedTitle'), t('analyticsDebug.copiedBody'));
    } catch {
      Alert.alert(t('analyticsDebug.copyUnavailableTitle'), t('analyticsDebug.copyUnavailableBody'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('analyticsDebug.title')}</Text>
        <Text style={styles.subtitle}>
          {t('analyticsDebug.stats', {
            queued: snapshot.queued.length,
            inFlight: String(snapshot.in_flight),
            optedOut: String(snapshot.opted_out),
          })}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => void flushAnalytics(true)}>
            <Text style={styles.buttonText}>{t('analyticsDebug.forceFlush')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.outline]} onPress={copyEvents}>
            <Text style={[styles.buttonText, styles.outlineText]}>{t('analyticsDebug.copyEventsJson')}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.eventName}>{item.event_name}</Text>
            <Text style={styles.meta}>{item.created_at}</Text>
            <Text style={styles.payload} numberOfLines={4}>
              {JSON.stringify(item.properties)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '600',
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  outlineText: {
    color: colors.primary,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  eventName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  meta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  payload: {
    ...typography.small,
    color: colors.text,
  },
});
