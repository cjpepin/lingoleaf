/**
 * StudyScreen
 *
 * Lists-first study UI:
 * - Lists view: show vocab lists as rows with per-list Study button + "Study all words"
 * - Detail view: show words in a list as rows, with Move/Delete actions and Study button
 *
 * Uses existing vocab list CRUD + word move/delete flows.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { StudyWord, VocabList } from '@/supabase/types';
import {
  createVocabList,
  deleteStudyWord,
  deleteVocabList,
  fetchBookTitlesByIds,
  fetchStudyWords,
  MAX_STUDY_LIST_WORDS,
  moveStudyWordToList,
  renameVocabList,
  touchVocabList,
} from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';
import { useStudyStore } from '@/state/useStudyStore';
import { useTranslation } from '@/i18n/useTranslation';
import { EmptyState } from '@/components/EmptyState';
import { FocusPackCard } from '@/components/FocusPackCard';
import { VocabListPickerModal } from '@/components/VocabListPickerModal';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/Button';
import { AdBanner } from '@/components/ads/AdBanner';
import { track } from '@/analytics/client';
import { usePremium } from '@/premium/PremiumProvider';
import * as FileSystem from 'expo-file-system';
import {
  checkStudyListCreationEligibility,
  FREE_STUDY_LIST_CAP,
  getStudyListCap,
  getStudyListLimitMessage,
  recordStudyListCreated,
} from '@/premium/studyListPolicy';
import { usePremiumGate } from '@/premium/usePremiumGate';
import { buildStudyWordsAnkiTsv, buildStudyWordsCsv, getStudyExportPath } from '@/screens/study/exportCsv';
import { getLockedStudyListIds, sortStudyListsByRecentUpdate } from '@/screens/study/listAccess';
import { loadFocusPack } from '@/study/focusPackService';
import type { StudyPack } from '@/study/focusPack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ViewMode = 'lists' | 'detail';
type ExportFormat = 'csv' | 'anki';

async function selectExportFormat(title: string): Promise<ExportFormat | null> {
  return new Promise((resolve) => {
    if (typeof ActionSheetIOS.showActionSheetWithOptions === 'function') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ['CSV', 'Anki TSV', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) resolve('csv');
          else if (index === 1) resolve('anki');
          else resolve(null);
        }
      );
      return;
    }

    Alert.alert(title, '', [
      { text: 'CSV', onPress: () => resolve('csv') },
      { text: 'Anki TSV', onPress: () => resolve('anki') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

async function shareExportFile(path: string, title: string): Promise<void> {
  // Optional dependency. If unavailable, fail gracefully with user-facing copy.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sharing = require('expo-sharing');
  if (!Sharing || typeof Sharing.isAvailableAsync !== 'function') {
    throw new Error('sharing_unavailable');
  }
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('sharing_unavailable');
  }
  await Sharing.shareAsync(path, {
    dialogTitle: title,
  });
}

export default function StudyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isGuest } = useAuthStore();
  const { isPremium } = usePremium();
  const { openPaywallOrAuth } = usePremiumGate();
  const studyStore = useStudyStore();
  const t = useTranslation();

  const [mode, setMode] = useState<ViewMode>('lists');
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const lists = studyStore.lists;
  const sortedLists = useMemo(() => sortStudyListsByRecentUpdate(lists), [lists]);
  const lockedListIds = useMemo(
    () => getLockedStudyListIds(sortedLists, isPremium, FREE_STUDY_LIST_CAP),
    [isPremium, sortedLists]
  );
  const hasLockedLists = lockedListIds.size > 0;
  const pickerLists = useMemo(
    () => sortedLists.filter((list) => !lockedListIds.has(list.id)),
    [lockedListIds, sortedLists]
  );
  const counts = studyStore.counts;
  const allCount = studyStore.allCount;

  const [words, setWords] = useState<StudyWord[]>([]);
  const wordsRef = useRef<StudyWord[]>([]);
  const [focusPack, setFocusPack] = useState<StudyPack | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create list (inline)
  const [createName, setCreateName] = useState('');
  const [renameTarget, setRenameTarget] = useState<VocabList | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VocabList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const [moveTarget, setMoveTarget] = useState<StudyWord | null>(null);
  const studyListCap = useMemo(() => getStudyListCap(isPremium), [isPremium]);
  const maxListsReached = sortedLists.length >= studyListCap;
  const focusPackCardPack = useMemo(() => {
    if (!focusPack) return null;
    if (!focusPack.isCompleted) return focusPack;
    return {
      ...focusPack,
      coachLine: t('study.focusPackCompletedCoachLine'),
    };
  }, [focusPack, t]);
  const focusPackCaption = focusPack?.isCompleted
    ? t('study.focusPackCompletedBadge')
    : t('study.focusPackBadge');
  const focusPackButtonLabel = focusPack?.isCompleted
    ? t('study.focusPackReviewCta')
    : t('study.focusPackCta');

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  const activeList = useMemo(() => sortedLists.find((l) => l.id === activeListId) ?? null, [activeListId, sortedLists]);
  const activeListName = activeList?.name ?? 'List';

  const loadListsAndCounts = useCallback(
    async (opts?: { force?: boolean }): Promise<void> => {
      if (!user) return;
      studyStore.hydrateForUser(user.id);
      await studyStore.refreshListsAndCounts(user.id, opts);
    },
    [studyStore, user]
  );

  const loadWordsForActiveList = useCallback(
    async (opts?: { force?: boolean }): Promise<void> => {
      if (!user || !activeListId) return;
      studyStore.hydrateForUser(user.id);
      await studyStore.refreshWordsForList(user.id, activeListId, opts);
      const cached = studyStore.getCachedWords(activeListId);
      if (cached) setWords(cached);
    },
    [activeListId, studyStore, user]
  );

  const reload = useCallback(async (): Promise<void> => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextFocusPack] = await Promise.all([
        loadFocusPack(user.id, t).catch(() => null),
        loadListsAndCounts(),
      ]);
      setFocusPack(nextFocusPack);
      if (mode === 'detail') await loadWordsForActiveList();
    } catch (e) {
      logger.error('Failed to load study data', e);
      Alert.alert(t('common.error'), t('study.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadListsAndCounts, loadWordsForActiveList, mode, t, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      track('study_opened', { source: 'study_tab' });
      reload();
    }, [reload, user])
  );

  useEffect(() => {
    if (mode !== 'detail' || !activeListId) return;
    if (!lockedListIds.has(activeListId)) return;
    setMode('lists');
    setActiveListId(null);
    setWords([]);
  }, [activeListId, lockedListIds, mode]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [nextFocusPack] = await Promise.all([
        loadFocusPack(user.id, t).catch(() => null),
        loadListsAndCounts({ force: true }),
      ]);
      setFocusPack(nextFocusPack);
      if (mode === 'detail') await loadWordsForActiveList({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadListsAndCounts, loadWordsForActiveList, mode, t, user]);

  const handleOpenList = useCallback(
    async (listId: string) => {
      setActiveListId(listId);
      setMode('detail');
      touchVocabList(listId).catch(() => {});
      if (!user) return;
      try {
        setLoading(true);
        await studyStore.refreshWordsForList(user.id, listId, { force: false });
        const cached = studyStore.getCachedWords(listId);
        if (cached) setWords(cached);
      } catch (e) {
        logger.error('Failed to load list words', e);
        Alert.alert(t('common.error'), t('study.loadWordsFailed'));
      } finally {
        setLoading(false);
      }
    },
    [studyStore, user]
  );

  const handleStudyList = useCallback(
    (listId: string, listName: string, listCount: number) => {
      if (listCount === 0) {
        Alert.alert(t('study.noWordsYet'), t('study.noWordsYet'));
        return;
      }
      if (focusPack) {
        track('study_pack_dismissed', {
          pack_id: focusPack.id,
          destination: 'list_study',
          source: 'study_screen',
        });
      }
      track('study_session_started', {
        mode: 'spaced',
        source: 'study_screen',
        placement: 'list_row_study_button',
      });
      track('ai_study_started', {
        mode: 'spaced',
        vocab_count: listCount,
      });
      touchVocabList(listId).catch(() => {});
      navigation.navigate('Flashcards', { listId, listName });
    },
    [focusPack, navigation, t]
  );

  const handleStudyAll = useCallback(() => {
    if (!isPremium && hasLockedLists) {
      openPaywallOrAuth('settings', 'study_all_locked_lists');
      return;
    }
    if (allCount === 0) {
      Alert.alert(t('study.noWordsYet'), t('study.noWordsAll'));
      return;
    }
    if (focusPack) {
      track('study_pack_dismissed', {
        pack_id: focusPack.id,
        destination: 'study_all',
        source: 'study_screen',
      });
    }
    track('study_session_started', {
      mode: 'spaced',
      source: 'study_screen',
      placement: 'study_all_button',
    });
    track('ai_study_started', {
      mode: 'spaced',
      vocab_count: allCount,
    });
    navigation.navigate('Flashcards', { listId: null, listName: t('study.allWords') });
  }, [allCount, focusPack, hasLockedLists, isPremium, navigation, openPaywallOrAuth, t]);

  const handleStartFocusPack = useCallback(() => {
    if (!focusPack) return;
    track('study_pack_started', {
      pack_id: focusPack.id,
      target_count: focusPack.targetCount,
      review_count: focusPack.reviewCount,
      new_count: focusPack.newCount,
      source: 'study_screen',
    });
    track('study_session_started', {
      mode: 'focus_pack',
      source: 'study_screen',
      placement: 'focus_pack_card',
    });
    track('ai_study_started', {
      mode: 'focus_pack',
      vocab_count: focusPack.targetCount,
    });
    navigation.navigate('Flashcards', {
      listId: null,
      listName: focusPack.title,
      sessionMode: 'focus_pack',
      wordIds: focusPack.wordIds,
      reviewAllWords: focusPack.isCompleted === true,
      packTitle: focusPack.title,
      packId: focusPack.id,
      packReviewCount: focusPack.reviewCount,
      packNewCount: focusPack.newCount,
    });
  }, [focusPack, navigation]);

  const handleExport = useCallback(async () => {
    if (!user) return;

    if (!isPremium) {
      if (isGuest) {
        openPaywallOrAuth('export_locked', 'study_export_button');
        return;
      }
      track('export_clicked', {
        format: 'csv',
        locked: true,
        is_premium: false,
      });
      openPaywallOrAuth('export_locked', 'study_export_button');
      return;
    }

    const format = await selectExportFormat(t('study.export'));
    if (!format) return;

    track('export_clicked', {
      format,
      locked: false,
      is_premium: true,
    });

    let path: string | null = null;
    try {
      const words = await fetchStudyWords(user.id);
      const bookIds = Array.from(new Set(words.map((w) => w.book_id).filter(Boolean))) as string[];
      const bookTitleById = await fetchBookTitlesByIds(bookIds);
      const fileBody = format === 'csv'
        ? buildStudyWordsCsv(words, bookTitleById)
        : buildStudyWordsAnkiTsv(words, bookTitleById);
      const basePath = getStudyExportPath(FileSystem.cacheDirectory);
      path = format === 'csv' ? basePath : basePath.replace(/\.csv$/i, '.tsv');
      await FileSystem.writeAsStringAsync(path, fileBody, { encoding: FileSystem.EncodingType.UTF8 });
      await shareExportFile(path, t('study.export'));
      track('export_completed', {
        format,
        rows_count: words.length,
      });
    } catch (error) {
      logger.error('Failed to export vocabulary', error);
      track('export_failed', {
        format,
        error: String((error as any)?.message ?? 'unknown_error'),
      });
      Alert.alert(t('common.error'), t('study.exportFailed'));
    } finally {
      if (path) {
        const cleanupPath = path;
        setTimeout(() => {
          FileSystem.deleteAsync(cleanupPath, { idempotent: true }).catch(() => {});
        }, 120000);
      }
    }
  }, [isGuest, isPremium, openPaywallOrAuth, t, user]);

  const handleLockedListPress = useCallback(() => {
    openPaywallOrAuth('settings', 'study_locked_list');
  }, [openPaywallOrAuth]);

  const handleDeleteWord = useCallback((word: StudyWord) => {
    Alert.alert(t('study.deleteWord'), t('study.deleteWordConfirm', { term: word.term }), [
      { text: t('study.cancel'), style: 'cancel' },
      {
        text: t('study.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStudyWord(word.id);
            setWords((prev) => prev.filter((w) => w.id !== word.id));
            if (activeListId) {
              studyStore.removeWordFromCache(activeListId, word.id);
              studyStore.adjustListCount(activeListId, -1);
            }
            studyStore.adjustAllCount(-1);
          } catch (e) {
            logger.error('Failed to delete word', e);
            Alert.alert(t('common.error'), t('msg.failedToSave'));
          }
        },
      },
    ]);
  }, [activeListId, studyStore, t]);

  const handleMoveWord = useCallback(
    async (word: StudyWord, toListId: string) => {
      const targetCount = studyStore.counts[toListId] ?? 0;
      if (targetCount >= MAX_STUDY_LIST_WORDS) {
        Alert.alert(t('common.error'), t('study.listFull'));
        return;
      }
      try {
        const updated = await moveStudyWordToList(word.id, toListId);
        touchVocabList(toListId).catch(() => {});
        setMoveTarget(null);

        if (activeListId && updated.list_id !== activeListId) {
          setWords((prev) => prev.filter((w) => w.id !== word.id));
          studyStore.removeWordFromCache(activeListId, word.id);
          studyStore.adjustListCount(activeListId, -1);
          studyStore.adjustListCount(toListId, 1);
          studyStore.upsertWordInCache(toListId, updated);
        } else {
          setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
          studyStore.upsertWordInCache(toListId, updated);
        }
      } catch (e) {
        logger.error('Failed to move word', e);
        Alert.alert(t('common.error'), t('study.moveFailed'));
      }
    },
    [activeListId, studyStore, t]
  );

  const handleCreateList = useCallback(async () => {
    if (!user) return;
    const name = createName.trim();
    if (!name) return;
    const eligibility = await checkStudyListCreationEligibility(user.id, sortedLists.length, isPremium);
    if (!eligibility.ok) {
      Alert.alert(t('common.error'), eligibility.message);
      return;
    }
    try {
      const created = await createVocabList(user.id, name, { maxLists: studyListCap });
      await recordStudyListCreated(user.id);
      studyStore.addListToCache(created);
      setCreateName('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('profile.saveFailed'));
    }
  }, [createName, isPremium, sortedLists.length, studyListCap, studyStore, user, t]);

  const handleRenameList = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    try {
      const updated = await renameVocabList(renameTarget.id, name);
      studyStore.updateListInCache(updated);
      setRenameTarget(null);
      setRenameName('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('profile.saveFailed'));
    }
  }, [renameName, renameTarget, studyStore, t]);

  const handleConfirmDeleteList = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.name) {
      Alert.alert(t('study.nameMismatch'), t('study.nameMismatch'));
      return;
    }
    try {
      await deleteVocabList(deleteTarget.id);
      studyStore.removeListFromCache(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirm('');
      await loadListsAndCounts({ force: true });
      if (activeListId === deleteTarget.id) {
        setActiveListId(null);
        setWords([]);
        setMode('lists');
      }
    } catch (e) {
      logger.error('Failed to delete list', e);
      Alert.alert(t('common.error'), t('profile.saveFailed'));
    }
  }, [activeListId, deleteConfirm, deleteTarget, loadListsAndCounts, studyStore, t]);

  const manageModals = (
    <>
      <Modal visible={Boolean(renameTarget)} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('study.renameList')}</Text>
            <TextInput
              style={styles.confirmInput}
              value={renameName}
              onChangeText={setRenameName}
              placeholder={t('translate.listName')}
              placeholderTextColor={colors.textSecondary}
              maxLength={50}
            />
            <TouchableOpacity
              style={styles.inlineDangerRow}
              onPress={() => {
                if (!renameTarget) return;
                setDeleteTarget(renameTarget);
                setDeleteConfirm('');
                setRenameTarget(null);
              }}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={styles.inlineDangerText}>{t('study.deleteList')}</Text>
            </TouchableOpacity>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => setRenameTarget(null)}>
                <Text style={styles.confirmButtonText}>{t('study.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, styles.confirmPrimary]} onPress={handleRenameList}>
                <Text style={[styles.confirmButtonText, styles.confirmPrimaryText]}>{t('study.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('study.deleteList')}</Text>
            <Text style={styles.confirmBody}>
              {t('study.deleteListConfirm', { name: deleteTarget?.name ?? '' })}
            </Text>
            <View style={styles.confirmInputRow}>
              <TextInput
                style={[
                  styles.confirmInput,
                  deleteTarget && deleteConfirm.trim() === deleteTarget.name && styles.confirmInputMatch,
                ]}
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder={t('translate.listName')}
                placeholderTextColor={colors.textSecondary}
              />
              {deleteTarget && deleteConfirm.trim() === deleteTarget.name ? (
                <Feather name="check-circle" size={22} color={colors.success} style={styles.confirmInputCheck} />
              ) : null}
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.confirmButtonText}>{t('study.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, styles.confirmDanger]} onPress={handleConfirmDeleteList}>
                <Text style={[styles.confirmButtonText, styles.confirmDangerText]}>{t('study.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <VocabListPickerModal
        visible={Boolean(moveTarget)}
        title={t('study.moveToList')}
        lists={pickerLists}
        selectedListId={moveTarget?.list_id ?? null}
        onSelect={(listId: string) => {
          if (!moveTarget) return;
          handleMoveWord(moveTarget, listId);
        }}
        onClose={() => setMoveTarget(null)}
      />
    </>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState message={t('study.signInPrompt')} />
        <View style={styles.footerCta}>
          <Button label={t('common.signIn')} variant="primary" onPress={() => navigation.navigate('Auth', { mode: 'signin' })} />
        </View>
      </View>
    );
  }

  if (mode === 'lists') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('study.title')}</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => void handleExport()}
            >
              {!isPremium ? <Feather name="lock" size={14} color={colors.textSecondary} /> : null}
              <Text style={styles.exportButtonText}>{t('study.export')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.studyAllButtonCompact, allCount === 0 && styles.disabled]}
              onPress={handleStudyAll}
              disabled={allCount === 0}
            >
              {!isPremium && hasLockedLists ? <Feather name="lock" size={14} color={colors.textSecondary} /> : null}
              <Text style={styles.studyAllTextCompact}>{t('study.studyAll')}</Text>
              <Text style={styles.studyAllMetaCompact}>{allCount}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={createName}
            onChangeText={setCreateName}
            placeholder={maxListsReached ? getStudyListLimitMessage(studyListCap) : t('study.newListName')}
            placeholderTextColor={colors.textSecondary}
            editable={!maxListsReached}
            maxLength={50}
          />
          <TouchableOpacity
            style={[styles.createButton, (maxListsReached || createName.trim().length === 0) && styles.disabled]}
            onPress={handleCreateList}
            disabled={maxListsReached || createName.trim().length === 0}
          >
            <Text style={styles.createButtonText}>{t('study.add')}</Text>
          </TouchableOpacity>
        </View>

        {focusPack && focusPackCardPack ? (
          <View style={styles.focusPackWrap}>
            <FocusPackCard
              pack={focusPackCardPack}
              caption={focusPackCaption}
              metaText={t('study.focusPackMixLabel', {
                reviewCount: focusPack.reviewCount,
                newCount: focusPack.newCount,
              })}
              buttonLabel={focusPackButtonLabel}
              onPress={handleStartFocusPack}
            />
          </View>
        ) : null}

        <FlatList
          data={sortedLists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState message={t('study.noLists')} />}
          ListFooterComponent={
            <View style={styles.studyListFooterAd}>
              <AdBanner placement="study_list" />
            </View>
          }
          renderItem={({ item }) => {
            const c = counts[item.id] ?? 0;
            const isLocked = lockedListIds.has(item.id);
            return (
              <View style={[styles.listRow, isLocked && styles.lockedListRow]}>
                <TouchableOpacity
                  style={styles.listRowLeft}
                  onPress={() => {
                    if (isLocked) {
                      handleLockedListPress();
                      return;
                    }
                    handleOpenList(item.id);
                  }}
                >
                  <Text style={styles.listName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.listCount}>
                    {c} {t('study.words')}
                    {isLocked ? ` • ${t('paywall.title')}` : ''}
                  </Text>
                </TouchableOpacity>
                <View style={styles.listRowRight}>
                  {isLocked ? (
                    <TouchableOpacity style={styles.lockedIcon} onPress={handleLockedListPress}>
                      <Feather name="lock" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.editIcon}
                        onPress={() => {
                          setRenameTarget(item);
                          setRenameName(item.name);
                        }}
                      >
                        <Feather name="edit-2" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inlineStudyButton, c === 0 && styles.disabled]}
                        onPress={() => handleStudyList(item.id, item.name, c)}
                        disabled={c === 0}
                      >
                        <Text style={styles.inlineStudyText}>{t('study.study')}</Text>
                      </TouchableOpacity>
                      <Text style={styles.chevron}>›</Text>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />

        {manageModals}
      </View>
    );
  }

  // detail view
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            setMode('lists');
            setActiveListId(null);
            setWords([]);
          }}
        >
          <Text style={styles.headerButtonText}>‹ {t('study.lists')}</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {activeListName}
        </Text>
        <TouchableOpacity
          style={[styles.inlineStudyButton, wordsRef.current.length === 0 && styles.disabled]}
          onPress={() => {
            if (!activeListId) return;
            handleStudyList(activeListId, activeListName, wordsRef.current.length);
          }}
          disabled={wordsRef.current.length === 0}
        >
          <Text style={styles.inlineStudyText}>{t('study.study')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message={t('study.noWords')} />}
        renderItem={({ item }) => (
          <View style={styles.wordCard}>
            <View style={styles.wordContent}>
              <Text style={styles.term}>{item.term}</Text>
              <Text style={styles.translation}>{item.translation}</Text>
              {item.context_snippet ? (
                <Text style={styles.context} numberOfLines={2}>
                  {item.context_snippet}
                </Text>
              ) : null}
            </View>
            <View style={styles.actionsCol}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setMoveTarget(item)}>
                <Text style={styles.actionButtonText}>{t('study.move')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteWord(item)}>
                <Text style={styles.deleteButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {manageModals}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footerCta: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exportButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  exportButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  detailTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerButtonText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  studyListFooterAd: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  focusPackWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  createInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  createButtonText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '600',
  },
  studyAllButtonCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  studyAllTextCompact: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  studyAllMetaCompact: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  lockedListRow: {
    opacity: 0.72,
  },
  listRowLeft: {
    flex: 1,
    paddingRight: spacing.md,
  },
  listName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  listCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  inlineStudyButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineStudyText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '600',
  },
  chevron: {
    ...typography.body,
    color: colors.textSecondary,
  },
  wordCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  wordContent: {
    flex: 1,
    paddingRight: spacing.md,
  },
  term: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  translation: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  context: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Manage lists modals (reused)
  manageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  manageSheet: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  manageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manageInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  managePrimaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  managePrimaryText: {
    ...typography.bodySmall,
    color: colors.surface,
    fontWeight: '600',
  },
  manageDisabled: {
    opacity: 0.5,
  },
  manageListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  manageListButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  manageListText: {
    ...typography.body,
    color: colors.text,
  },
  manageAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manageActionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  manageDanger: {
    borderColor: colors.error,
  },
  manageDangerText: {
    color: colors.error,
  },
  manageClose: {
    marginTop: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manageCloseText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  confirmCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  confirmBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  confirmBold: {
    color: colors.text,
    fontWeight: '700',
  },
  confirmInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  confirmInputMatch: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  confirmInputCheck: {
    marginLeft: spacing.xs,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inlineDangerRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  inlineDangerText: {
    ...typography.bodySmall,
    color: colors.error,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmButtonText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  confirmPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confirmPrimaryText: {
    color: colors.surface,
    fontWeight: '600',
  },
  confirmDanger: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
  },
  confirmDangerText: {
    color: colors.error,
    fontWeight: '600',
  },
});
