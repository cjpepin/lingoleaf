/**
 * FlashcardsScreen
 *
 * Simple flashcard study mode for a vocab list.
 * - Tap card to flip
 * - Next/Prev controls
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { useStudyStore } from '@/state/useStudyStore';
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
  const studyStore = useStudyStore();

  const { listId, listName } = route.params;

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showTranslationFirst, setShowTranslationFirst] = useState(false);

  // Animation values
  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({ title: listName || 'Flashcards' });
  }, [listName, navigation]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (listId) {
        studyStore.hydrateForUser(user.id);
        await studyStore.refreshWordsForList(user.id, listId, { force: false });
        const cached = studyStore.getCachedWords(listId);
        const data = cached ?? (await fetchStudyWords(user.id, listId));
        setWords(data);
        logger.info('Loaded flashcards', { listId, count: data.length, source: cached ? 'cache' : 'network' });
      } else {
        const data = await fetchStudyWords(user.id, listId);
        setWords(data);
        logger.info('Loaded flashcards', { listId, count: data.length, source: 'network' });
      }
      setIndex(0);
      setFlipped(false);
    } catch (error) {
      logger.error('Failed to load flashcards:', error);
      Alert.alert('Error', 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [listId, studyStore, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user && !loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sign in required</Text>
        <Text style={styles.subtitle}>Sign in to study flashcards and sync your vocab.</Text>
        <Button label="Sign in" variant="primary" onPress={() => (navigation as any).navigate('Auth', { mode: 'signin' })} />
      </View>
    );
  }

  const current = words[index] ?? null;
  const progressText = useMemo(() => {
    if (words.length === 0) return '0 / 0';
    return `${index + 1} / ${words.length}`;
  }, [index, words.length]);

  const handleFlip = useCallback(() => {
    setFlipped((p) => !p);
    // 3D flip animation
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipped, flipAnim]);

  const handlePrev = useCallback(() => {
    // Slide right animation
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    setIndex((prev) => Math.max(0, prev - 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [slideAnim, flipAnim]);

  const handleNext = useCallback(() => {
    // Slide left animation
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    setIndex((prev) => Math.min(words.length - 1, prev + 1));
    setFlipped(false);
    flipAnim.setValue(0);
  }, [words.length, slideAnim, flipAnim]);

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

  // Determine front and back based on showTranslationFirst
  const frontText = showTranslationFirst ? current.translation : current.term;
  const backText = showTranslationFirst ? current.term : current.translation;
  const frontLabel = showTranslationFirst ? 'Translation' : 'Term';
  const backLabel = showTranslationFirst ? 'Term' : 'Translation';

  // Interpolate flip animation for 3D effect
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>{progressText}</Text>
        <Pressable
          style={styles.toggleButton}
          onPress={() => {
            setShowTranslationFirst((p) => !p);
            setFlipped(false);
            flipAnim.setValue(0);
          }}
        >
          <Text style={styles.toggleText}>
            {showTranslationFirst ? '🔄 Translation → Term' : '🔄 Term → Translation'}
          </Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={handleFlip}>
          {/* Front of card */}
          <Animated.View
            style={[
              styles.cardFace,
              {
                opacity: frontOpacity,
                transform: [{ rotateY: frontInterpolate }],
              },
            ]}
          >
            <Text style={styles.cardLabel}>{frontLabel}</Text>
            <Text style={styles.cardText}>{frontText}</Text>
            <Text style={styles.cardHint}>Tap to flip</Text>
          </Animated.View>

          {/* Back of card */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardBack,
              {
                opacity: backOpacity,
                transform: [{ rotateY: backInterpolate }],
              },
            ]}
          >
            <Text style={styles.cardLabel}>{backLabel}</Text>
            <Text style={styles.cardText}>{backText}</Text>
            <Text style={styles.cardHint}>Tap to flip</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

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
    gap: spacing.sm,
  },
  progress: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
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
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
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


