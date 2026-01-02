/**
 * BookNavigationSheet
 *
 * Reader navigation UI:
 * - Scrub progress (by location index)
 * - Jump to page number
 * - Jump to chapter (TOC)
 *
 * Hidden by default; parent controls visibility.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { OverlayModal } from '@/components/ui/OverlayModal';
import { Button } from '@/components/ui/Button';

interface TocItem {
  label: string;
  href: string;
}

interface Props {
  visible: boolean;
  currentIndex: number; // 0-based
  total: number; // total locations
  tocItems: TocItem[];
  onClose: () => void;
  onGoToIndex: (index: number) => void;
  onGoToHref: (href: string) => void;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function BookNavigationSheet({ visible, currentIndex, total, tocItems, onClose, onGoToIndex, onGoToHref }: Props) {
  const [pageInput, setPageInput] = useState('');

  const currentPage = useMemo(() => (total > 0 ? currentIndex + 1 : 1), [currentIndex, total]);
  const percent = useMemo(() => {
    if (total <= 1) return 0;
    return Math.round((currentIndex / (total - 1)) * 100);
  }, [currentIndex, total]);

  const handleJump = useCallback(() => {
    const n = parseInt(pageInput.trim(), 10);
    if (!Number.isFinite(n) || total <= 0) return;
    const idx = clamp(n - 1, 0, total - 1);
    onGoToIndex(idx);
    setPageInput('');
    onClose();
  }, [onClose, onGoToIndex, pageInput, total]);

  return (
    <OverlayModal visible={visible} onClose={onClose} cardStyle={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Navigate</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.meta}>{total > 0 ? `${currentPage} / ${total} • ${percent}%` : 'Generating pages…'}</Text>

      <Text style={styles.label}>Go to page</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={pageInput}
          onChangeText={setPageInput}
          placeholder={total > 0 ? `1–${total}` : 'Waiting…'}
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          style={styles.input}
          editable={total > 0}
        />
        <Button label="Go" onPress={handleJump} disabled={total <= 0} variant="primary" size="sm" style={styles.goButton} />
      </View>

      <View style={styles.sectionSpacer} />

      <Text style={styles.label}>Chapters</Text>
      <ScrollView contentContainerStyle={styles.chapterList}>
        {tocItems.length === 0 ? (
          <Text style={styles.empty}>No chapters available.</Text>
        ) : (
          tocItems.map((c) => (
            <TouchableOpacity
              key={c.href}
              style={styles.chapterRow}
              onPress={() => {
                onGoToHref(c.href);
                onClose();
              }}
            >
              <Text style={styles.chapterText} numberOfLines={2}>
                {c.label || 'Chapter'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  close: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  goButton: {
    minHeight: 0,
  },
  sectionSpacer: {
    height: spacing.lg,
  },
  chapterList: {
    gap: spacing.sm,
  },
  chapterRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
  },
  chapterText: {
    ...typography.body,
    color: colors.text,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});


