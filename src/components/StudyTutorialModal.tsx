/**
 * StudyTutorialModal
 *
 * Full-screen mock walkthrough of the Study screen.
 * 4 steps: vocab lists, study button, flashcard preview, create list.
 * Shown on first Study tab visit; can be replayed from Profile.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { TutorialTooltip } from './TutorialTooltip';
import { useTranslation } from '@/i18n/useTranslation';

const TOTAL_STEPS = 4;

const MOCK_LISTS = [
  { name: 'Spanish Basics', count: 12 },
  { name: 'Travel Phrases', count: 8 },
  { name: 'Food & Cooking', count: 5 },
];
const MOCK_ALL_COUNT = 25;

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function StudyTutorialModal({ visible, onComplete, onSkip }: Props) {
  const t = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const stepKeys: { title: string; desc: string }[] = [
    { title: t('tutorial.vocabLists'), desc: t('tutorial.vocabListsDesc') },
    { title: t('tutorial.studyFlashcards'), desc: t('tutorial.studyFlashcardsDesc') },
    { title: t('tutorial.flashcardPreviewTitle'), desc: t('tutorial.flashcardPreviewDesc') },
    { title: t('tutorial.createLists'), desc: t('tutorial.createListsDesc') },
  ];

  const cur = stepKeys[step];

  const showFlashcard = step === 2;
  const highlightStudyBtn = step === 1;
  const highlightCreateRow = step === 3;

  const extraMarginBottom = step === 2 ? 70 : 0;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.container}>
        {showFlashcard ? (
          // Flashcard screen — mirrors FlashcardsScreen (spaced mode: progress, mode toggle, card, rating row)
          <View style={styles.flashcardScreen}>
            {/* Nav bar: back | All Words | 3-dots */}
            <View style={styles.navBar}>
              <View style={styles.navBarLeft}>
                <Feather name="arrow-left" size={22} color={colors.text} />
              </View>
              <Text style={styles.navBarTitle} numberOfLines={1}>{t('study.allWords')}</Text>
              <View style={styles.navBarRight}>
                <Feather name="more-vertical" size={24} color={colors.primary} />
              </View>
            </View>
            <View style={styles.flashcardHeader}>
              <Text style={styles.flashcardProgress}>
                {t('flashcards.unseen')}: 10  ·  {t('flashcards.learning')}: 12  ·  {t('flashcards.learned')}: 3
              </Text>
              <View style={styles.modeToggle}>
                <Feather name="repeat" size={16} color={colors.primary} />
                <Text style={styles.modeToggleText}>{t('flashcards.switchToFreeStudy')}</Text>
              </View>
            </View>

            <View style={styles.spacedCardArea}>
              <View style={[styles.cardRow, styles.cardRowCentered]}>
                <View style={styles.edgeTap} />
                <View style={styles.cardContainer}>
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('flashcards.term')}</Text>
                    <Text style={styles.cardText}>hola</Text>
                    <Text style={styles.cardHint}>{t('flashcards.tapToFlip')}</Text>
                    <View style={styles.starButton}>
                      <Ionicons name="star-outline" size={24} color={colors.textSecondary} />
                    </View>
                  </View>
                </View>
                <View style={styles.edgeTap} />
              </View>
            </View>

            <View style={styles.ratingSlot}>
              <View style={styles.ratingRow}>
                <View style={[styles.ratingButton, styles.ratingAgain]}>
                  <Text style={styles.ratingText}>{t('flashcards.again')}</Text>
                  <Text style={styles.ratingSub}>{t('flashcards.cards', { count: 2 })}</Text>
                </View>
                <View style={[styles.ratingButton, styles.ratingHard]}>
                  <Text style={styles.ratingText}>{t('flashcards.hard')}</Text>
                  <Text style={styles.ratingSub}>5m</Text>
                </View>
                <View style={[styles.ratingButton, styles.ratingGood]}>
                  <Text style={styles.ratingText}>{t('flashcards.good')}</Text>
                  <Text style={styles.ratingSub}>2h</Text>
                </View>
                <View style={[styles.ratingButton, styles.ratingEasy]}>
                  <Text style={styles.ratingText}>{t('flashcards.easy')}</Text>
                  <Text style={styles.ratingSub}>1d</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          // Mock study lists — mirrors StudyScreen lists view
          <View style={styles.listsScreen}>
            {/* Nav bar: Study title (matches tab screen header) */}
            <View style={styles.navBarStudy}>
              <Text style={styles.navBarStudyTitle}>{t('study.title')}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{t('study.title')}</Text>
              <View style={styles.studyAllPill}>
                <Text style={styles.studyAllText}>{t('study.studyAll')}</Text>
                <Text style={styles.studyAllMeta}>{MOCK_ALL_COUNT}</Text>
              </View>
            </View>

            <View style={[styles.createRow, highlightCreateRow && styles.highlightRing]}>
              <View style={styles.createInput}>
                <Text style={styles.createInputText}>
                  {highlightCreateRow ? 'My New List' : t('study.newListName')}
                </Text>
              </View>
              <View style={[styles.addBtn, highlightCreateRow && styles.addBtnActive]}>
                <Text style={styles.addBtnText}>{t('study.add')}</Text>
              </View>
            </View>

            {MOCK_LISTS.map((list, i) => (
              <View key={i} style={styles.listRow}>
                <View style={styles.listLeft}>
                  <Text style={styles.listName}>{list.name}</Text>
                  <Text style={styles.listCount}>{list.count} {t('study.words')}</Text>
                </View>
                <View style={styles.listRight}>
                  <View style={styles.editIcon}>
                    <Feather name="edit-2" size={16} color={colors.textSecondary} />
                  </View>
                  <View style={[
                    styles.studyBtnWrap,
                    highlightStudyBtn && i === 0 && styles.studyBtnWrapHighlight,
                  ]}>
                    <View style={styles.studyBtn}>
                      <Text style={styles.studyBtnText}>{t('study.study')}</Text>
                    </View>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tooltip — compact on flashcard step so user sees full screen */}
        <View style={[styles.tooltipWrap, { marginBottom: extraMarginBottom }]}>
          <TutorialTooltip
            title={cur.title}
            description={cur.desc}
            currentStep={step}
            totalSteps={TOTAL_STEPS}
            onNext={goNext}
            onSkip={onSkip}
            onBack={goBack}
            isLast={step === TOTAL_STEPS - 1}
            skipLabel={t('tutorial.skip')}
            nextLabel={t('tutorial.next')}
            doneLabel={t('tutorial.done')}
            backLabel={t('tutorial.back')}
            compact={step === 2}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Nav bars (mock screen headers) ---
  navBarStudy: {
    paddingTop: 50,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBarStudyTitle: {
    ...typography.h2,
    color: colors.text,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '115%',
    height: 100,
    marginLeft: -spacing.xl,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBarLeft: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navBarTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  navBarRight: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // --- Lists screen ---
  listsScreen: {
    flex: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  studyAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
  },
  studyAllText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  studyAllMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Create row
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  createInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  createInputText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    opacity: 0.5,
  },
  addBtnActive: {
    opacity: 1,
  },
  addBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.surface,
  },

  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listLeft: {
    flex: 1,
    paddingRight: spacing.md,
  },
  listName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  listCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyBtnWrap: {
    borderRadius: 999,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  studyBtnWrapHighlight: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: colors.primary + '18',
  },
  studyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  studyBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.surface,
  },
  chevron: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Highlight ring (create row)
  highlightRing: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  // --- Flashcard screen (mirrors FlashcardsScreen) ---
  flashcardScreen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  flashcardHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  flashcardProgress: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
  },
  modeToggleText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  spacedCardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  cardRowCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  edgeTap: {
    width: 6,
  },
  cardContainer: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1.45,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
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
  starButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  ratingSlot: {
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  ratingAgain: { backgroundColor: colors.error + '30' },
  ratingHard: { backgroundColor: colors.warning + '30' },
  ratingGood: { backgroundColor: colors.success + '30' },
  ratingEasy: { backgroundColor: colors.primary + '30' },
  ratingText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  ratingSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Tooltip
  tooltipWrap: {
    position: 'absolute',
    bottom: 40,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
});
