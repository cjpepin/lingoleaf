/**
 * BookListItem
 * Displays a book in the library list
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Book } from '@/supabase/types';
import { colors, spacing, typography } from '@/theme';

interface Props {
  book: Book;
  onPress: (book: Book) => void;
}

export function BookListItem({ book, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(book)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        {book.author && (
          <Text style={styles.author} numberOfLines={1}>
            {book.author}
          </Text>
        )}
        {book.source_lang && (
          <Text style={styles.language}>{book.source_lang.toUpperCase()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  author: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  language: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});

