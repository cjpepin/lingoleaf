/**
 * FlashcardsScreen
 *
 * Simple flashcard study mode for a vocab list.
 * - Tap card to flip
 * - Next/Prev controls
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { fetchStudyWords } from '@/supabase/queries';
import type { StudyWord } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { CenteredLoader } from '@/components/ui/CenteredLoader';
import { Button } from '@/components/ui/Button';

type FlashcardsRouteProp = RouteProp<RootStackParamList, 'Flashcards'>;

export default function FlashcardsScreen() {
  const route = useRoute<FlashcardsRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const { listId, listName } = route.params;

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: listName || 'Flashcards' });
  }, [listName, navigation]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchStudyWords(user.id, listId);
      setWords(data);
      setIndex(0);
      setFlipped(false);
      logger.info('Loaded flashcards', { listId, count: data.length });
    } catch (error) {
      logger.error('Failed to load flashcards:', error);
      Alert.alert('Error', 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [listId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const current = words[index] ?? null;
  const progressText = useMemo(() => {
    if (words.length === 0) return '0 / 0';
    return `${index + 1} / ${words.length}`;
  }, [index, words.length]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
    setFlipped(false);
  }, []);

  const handleNext = useCallback(() => {
    setIndex((prev) => Math.min(words.length - 1, prev + 1));
    setFlipped(false);
  }, [words.length]);

  if (loading) {
    return <CenteredLoader />;
  }

  if (!current) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No words in this list yet</Text>
        <Text style={styles.subtitle}>Add some words, then come back to study them as flashcards.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>{progressText}</Text>
      </View>

      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setFlipped((p) => !p)}>
        <Text style={styles.cardLabel}>{flipped ? 'Translation' : 'Term'}</Text>
        <Text style={styles.cardText}>{flipped ? current.translation : current.term}</Text>
        <Text style={styles.cardHint}>Tap to flip</Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        <Button label="Prev" onPress={handlePrev} disabled={index === 0} variant="surface" size="md" style={styles.actionButton} />
        <Button
          label="Next"
          onPress={handleNext}
          disabled={index >= words.length - 1}
          variant="primary"
          size="md"
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  progress: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardText: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cardHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});


