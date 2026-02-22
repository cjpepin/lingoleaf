/**
 * ReaderTutorialModal
 *
 * Full-screen mock walkthrough of the reader.
 * Renders fake but visually accurate UI elements in a scripted 7-step flow.
 * Shown on first book open; can be replayed from Profile.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { TutorialTooltip } from './TutorialTooltip';
import { AdBanner } from './ads/AdBanner';
import { useTranslation } from '@/i18n/useTranslation';

const TOTAL_STEPS = 7;

const SAMPLE_TEXT_BEFORE = 'El sol brillaba sobre las calles empedradas del pequeño pueblo. Los ';
const HIGHLIGHT_WORD = 'vendedores';
const SAMPLE_TEXT_AFTER =
  ' ofrecían frutas frescas mientras los niños corrían entre los puestos del mercado. Era una mañana perfecta para pasear y disfrutar del aire fresco de la montaña. Habia muchas personas en la plaza. Habia muchos niños en la plaza. Habia muchos adultos en la plaza. Era una mañana perfecta para pasear y disfrutar del aire fresco de la montaña. Habia muchas personas en la plaza. Habia muchos niños en la plaza. Habia muchos adultos en la plaza. Era una mañana perfecta para pasear y disfrutar del aire fresco de la montaña. Habia muchas personas en la plaza. Habia muchos niños en la plaza. Habia muchos adultos en la plaza. Era una mañana perfecta para pasear y disfrutar del aire fresco de la montaña.';

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

// iOS-style native text selection blue
const IOS_SELECTION_BLUE = 'rgba(26, 115, 232, 0.35)';

export function ReaderTutorialModal({ visible, onComplete, onSkip }: Props) {
  const t = useTranslation();
  const [step, setStep] = useState(0);
  const edgePulse = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  useEffect(() => {
    if (step === 6 && visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(edgePulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(edgePulse, { toValue: 0.15, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    edgePulse.setValue(0.15);
  }, [step, visible]);

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
    { title: t('tutorial.readerIntroTitle'), desc: t('tutorial.readerIntroDesc') },
    { title: t('tutorial.selectText'), desc: t('tutorial.selectTextDesc') },
    { title: t('tutorial.toolbar'), desc: t('tutorial.toolbarDesc') },
    { title: t('tutorial.saveVocab'), desc: t('tutorial.saveVocabDesc') },
    { title: t('tutorial.highlightsTitle'), desc: t('tutorial.highlightsDesc') },
    { title: t('tutorial.navigateBook'), desc: t('tutorial.navigateBookDesc') },
    { title: t('tutorial.turnPages'), desc: t('tutorial.turnPagesDesc') },
  ];

  const cur = stepKeys[step];

  // --- Mock elements per step ---
  // Step 1: blue (native) selection. Step 2: mint highlight + toolbar. Step 3: mint highlight + translate sheet.
  const showBlueSelection = step === 1;
  const showMintSelection = step === 2 || step === 3;
  const showToolbar = step === 2;
  const showTranslateSheet = step === 3;
  const showMultiHighlights = step === 4;
  const showHighlightPopup = step === 4;
  const showNavPanel = step === 5;
  const showEdgePulse = step === 6;

  const tooltipBottom = step === 3 ? 350 : step === 5 ? 500 : 40;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Mock nav bar */}
        <View style={styles.navBar}>
          <View style={styles.navBackButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </View>
          <Text style={styles.navTitle} numberOfLines={1}>Don Quijote</Text>
          <View style={styles.navRight}>
            <Feather name="settings" size={22} color={colors.text} />
          </View>
        </View>

        {/* Mock page indicator */}
        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>3 / 42</Text>
        </View>
        <View style={styles.chapterIndicator}>
          <Text style={styles.pageText}>8 pgs left in chapter</Text>
        </View>

        {/* Edge tap zones */}
        {showEdgePulse && (
          <>
            <Animated.View style={[styles.edgeLeft, { opacity: edgePulse }]} />
            <Animated.View style={[styles.edgeRight, { opacity: edgePulse }]} />
          </>
        )}

        {/* Mock book text */}
        <View style={styles.pageContent}>
          {showMultiHighlights ? (
            <Text style={styles.bookText}>
              {'El '}
              <Text style={[styles.bookText, { backgroundColor: colors.highlightMint }]}>sol brillaba</Text>
              {' sobre las calles empedradas del pequeño pueblo. Los '}
              <Text style={[styles.bookText, { backgroundColor: colors.highlightYellow }]}>vendedores</Text>
              {' ofrecían '}
              <Text style={[styles.bookText, { backgroundColor: colors.highlightPink }]}>frutas frescas</Text>
              {' mientras los niños corrían entre los puestos del mercado. Era una mañana perfecta para pasear y disfrutar del aire fresco de la montaña.'}
            </Text>
          ) : (
            <Text style={styles.bookText}>
              {SAMPLE_TEXT_BEFORE}
              {showBlueSelection ? (
                <Text style={[styles.bookText, { backgroundColor: IOS_SELECTION_BLUE }]}>{HIGHLIGHT_WORD}</Text>
              ) : showMintSelection ? (
                <Text style={[styles.bookText, { backgroundColor: colors.highlightMint }]}>{HIGHLIGHT_WORD}</Text>
              ) : (
                <Text>{HIGHLIGHT_WORD}</Text>
              )}
              {SAMPLE_TEXT_AFTER}
            </Text>
          )}
        </View>

        {/* Mock Selection Toolbar (step 2) */}
        {showToolbar && (
          <View style={styles.toolbarWrap}>
            <View style={styles.toolbarArrow} />
            <View style={[styles.toolbar, styles.toolbarNoTopBorder]}>
              <View style={styles.toolbarBtn}>
                <Feather name="edit-3" size={16} color={colors.text} style={{ opacity: 0.9 }} />
                <Text style={styles.toolbarBtnText}>Highlight</Text>
              </View>
              <View style={styles.toolbarDivider} />
              <View style={styles.toolbarBtn}>
                <Feather name="globe" size={16} color={colors.text} style={{ opacity: 0.9 }} />
                <Text style={styles.toolbarBtnText}>Translate</Text>
              </View>
            </View>
          </View>
        )}

        {/* Mock Highlight Action Popup (step 4) — translation section + color row + arrow */}
        {showHighlightPopup && (
          <View style={styles.highlightPopupWrap}>
            <View style={styles.highlightPopupContainer}>
              <View style={styles.highlightPopupArrow} />
              <View style={[styles.highlightPopup, styles.highlightPopupNoTopBorder]}>
                <View style={[styles.colorCircle, { backgroundColor: colors.annotationMint, borderColor: '#3CA874' }]}>
                  <Feather name="check" size={14} color="#3CA874" />
                </View>
                <View style={[styles.colorCircle, { backgroundColor: colors.annotationYellow, borderColor: colors.border }]} />
                <View style={[styles.colorCircle, { backgroundColor: colors.annotationPink, borderColor: colors.border }]} />
                <View style={styles.popupDivider} />
                <View style={styles.popupIconBtn}>
                  <Feather name="trash-2" size={16} color={colors.error} />
                </View>
              </View>
              <View style={styles.highlightPopupTranslation}>
                <Text style={styles.highlightPopupSelectedText} numberOfLines={2}>vendedores</Text>
                <Text style={styles.highlightPopupTranslationText} numberOfLines={2}>sellers, vendors</Text>
                <View style={styles.highlightPopupSaveBtn}>
                  <Text style={styles.highlightPopupSaveBtnText}>{t('translate.saveToList')}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Mock Translate Sheet (step 3) */}
        {showTranslateSheet && (
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetLabel}>ORIGINAL</Text>
              <Text style={styles.sheetTerm}>vendedores</Text>
              <Text style={styles.sheetLabel}>TRANSLATION</Text>
              <Text style={styles.sheetTranslation}>sellers, vendors</Text>
              <View style={styles.sheetListBtn}>
                <Text style={styles.sheetListBtnText}>My vocab list</Text>
                <Text style={styles.sheetChevron}>›</Text>
              </View>
              <View style={styles.sheetAdContainer}>
                <AdBanner />
              </View>
              <View style={styles.sheetSaveBtn}>
                <Text style={styles.sheetSaveBtnText}>Save to list</Text>
              </View>
            </View>
          </View>
        )}

        {/* Mock Navigation Panel (step 5) — matches ReaderNavigationOverlay */}
        {showNavPanel && (
          <>
            <View style={styles.navDim} />
            <View style={styles.navPanel}>
              {/* Page strip */}
              <View style={styles.navPageStrip}>
                {[1, 2, 3, 4, 5].map((p) => (
                  <View key={p} style={[styles.navPageCard, p === 3 && styles.navPageCardCurrent]}>
                    <View style={styles.navPageCardScribble}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <View key={i} style={[styles.navPageCardLine, p === 3 && styles.navPageCardLineCurrent]} />
                      ))}
                    </View>
                    <Text style={[styles.navPageNumber, p === 3 && styles.navPageNumberCurrent]}>{p}</Text>
                  </View>
                ))}
              </View>
              {/* Slider section */}
              <View style={styles.navSliderSection}>
                <View style={styles.navGoBackRow}>
                  <Feather name="arrow-left" size={14} color={colors.primary} />
                  <Text style={styles.navGoBackText}>{t('readerNav.goBack')}</Text>
                </View>
                <Text style={styles.navChapterLabel} numberOfLines={1}>Capítulo III</Text>
                <View style={styles.navSliderRow}>
                  <Text style={styles.navSliderEdge}>1</Text>
                  <View style={styles.navSliderTrack}>
                    <View style={styles.navSliderFill} />
                    <View style={styles.navSliderThumb} />
                  </View>
                  <Text style={styles.navSliderEdge}>42</Text>
                </View>
              </View>
              {/* Tabs */}
              <View style={styles.navTabs}>
                <View style={[styles.navTab, styles.navTabActive]}>
                  <Text style={[styles.navTabText, styles.navTabTextActive]}>{t('readerNav.chapters')}</Text>
                </View>
                <View style={styles.navTab}>
                  <Text style={styles.navTabText}>{t('readerNav.highlightsCount', { count: 3 })}</Text>
                </View>
              </View>
              {/* Chapter list */}
              <View style={styles.navChapterList}>
                {['Capítulo I', 'Capítulo II', 'Capítulo III', 'Capítulo IV'].map((label, i) => (
                  <View key={i} style={[styles.navChapterRow, i === 2 && styles.navChapterActive]}>
                    <Text style={[styles.navChapterItemText, i === 2 && { color: colors.primary, fontWeight: '600' }]} numberOfLines={2}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Tooltip */}
        <View style={[styles.tooltipWrap, { bottom: tooltipBottom }]}>
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

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    ...typography.h3,
    color: colors.primary,
  },
  navBackButton: {
  },
  navRight: {
  },

  // Page indicator
  pageIndicator: {
    position: 'absolute',
    top: 100,
    left: spacing.sm,
    zIndex: 2,
  },
  pageText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555',
  },
  chapterIndicator: {
    position: 'absolute',
    top: 100,
    right: spacing.sm,
    zIndex: 2,
  },

  // Edge tap zones
  edgeLeft: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 160,
    width: 28,
    backgroundColor: colors.primary,
    zIndex: 3,
  },
  edgeRight: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 160,
    width: 28,
    backgroundColor: colors.primary,
    zIndex: 3,
  },

  // Book text
  pageContent: {
    flex: 1,
    paddingHorizontal: spacing.xl + spacing.sm,
    paddingTop: spacing.xl,
  },
  bookText: {
    fontSize: 18,
    lineHeight: 30,
    color: colors.text,
    fontFamily: 'Georgia',
  },

  // Selection toolbar
  toolbarWrap: {
    position: 'absolute',
    top: 225,
    right: 160,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toolbarBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  toolbarDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  toolbarArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    transform: [{ rotate: '180deg' }],
  },
  toolbarNoTopBorder: {
    borderTopWidth: 0,
  },

  // Highlight popup
  highlightPopupWrap: {
    position: 'absolute',
    top: 160,
    right: 160,
    zIndex: 10,
  },
  highlightPopupContainer: {
    width: 260,
    alignItems: 'center',
  },
  highlightPopupTranslation: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomWidth: 0,
    width: '76%',
  },
  highlightPopupSelectedText: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  highlightPopupTranslationText: {
    ...typography.bodySmall,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  highlightPopupSaveBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  highlightPopupSaveBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  highlightPopup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  highlightPopupArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
    transform: [{ rotate: '180deg' }],
  },
  highlightPopupNoTopBorder: {
    borderTopWidth: 0,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  popupIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Translate sheet
  sheetBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sheetTerm: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sheetTranslation: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  sheetListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sheetListBtnText: {
    ...typography.body,
    color: colors.text,
  },
  sheetChevron: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  sheetAdContainer: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
  },
  sheetSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  sheetSaveBtnText: {
    ...typography.button,
    color: colors.surface,
    fontWeight: '600',
  },

  // Navigation panel (matches ReaderNavigationOverlay)
  navDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 8,
  },
  navPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 9,
  },
  navPageStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  navPageCard: {
    width: 56,
    height: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navPageCardCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.highlightMint,
  },
  navPageCardScribble: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-evenly',
    paddingHorizontal: 2,
  },
  navPageCardLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.divider,
    width: '100%',
  },
  navPageCardLineCurrent: {
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  navPageNumber: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  navPageNumberCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  navSliderSection: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  navGoBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  navGoBackText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  navChapterLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  navSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  navSliderEdge: {
    ...typography.caption,
    color: colors.textTertiary,
    minWidth: 28,
    textAlign: 'center',
  },
  navSliderTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    position: 'relative',
  },
  navSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '7%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  navSliderThumb: {
    position: 'absolute',
    top: -6,
    left: '6%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  navTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  navTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  navTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  navTabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  navTabTextActive: {
    color: colors.text,
  },
  navChapterList: {
    gap: spacing.sm,
    flex: 1,
  },
  navChapterRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
  },
  navChapterActive: {
    backgroundColor: colors.highlightMint,
    borderColor: colors.primary,
  },
  navChapterItemText: {
    ...typography.body,
    color: colors.text,
  },

  // Tooltip
  tooltipWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
});
