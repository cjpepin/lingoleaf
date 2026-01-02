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
  countAllStudyWords,
  countStudyWordsForList,
  createVocabList,
  deleteStudyWord,
  deleteVocabList,
  fetchStudyWords,
  fetchVocabLists,
  moveStudyWordToList,
  renameVocabList,
  touchVocabList,
} from '@/supabase/queries';
import { useAuthStore } from '@/state/useAuthStore';
import { EmptyState } from '@/components/EmptyState';
import { VocabListPickerModal } from '@/components/VocabListPickerModal';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ViewMode = 'lists' | 'detail';

export default function StudyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<ViewMode>('lists');
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const [lists, setLists] = useState<VocabList[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [allCount, setAllCount] = useState(0);

  const [words, setWords] = useState<StudyWord[]>([]);
  const wordsRef = useRef<StudyWord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create list (inline)
  const [createName, setCreateName] = useState('');
  const [renameTarget, setRenameTarget] = useState<VocabList | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VocabList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const [moveTarget, setMoveTarget] = useState<StudyWord | null>(null);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  const activeList = useMemo(() => lists.find((l) => l.id === activeListId) ?? null, [activeListId, lists]);
  const activeListName = activeList?.name ?? 'List';

  const loadListsAndCounts = useCallback(async (): Promise<void> => {
    if (!user) return;
    const nextLists = await fetchVocabLists(user.id);
    setLists(nextLists);

    const [total, ...perListCounts] = await Promise.all([
      countAllStudyWords(user.id),
      ...nextLists.map((l) => countStudyWordsForList(user.id, l.id)),
    ]);

    const nextCounts: Record<string, number> = {};
    nextLists.forEach((l, i) => {
      nextCounts[l.id] = perListCounts[i] ?? 0;
    });
    setAllCount(total);
    setCounts(nextCounts);
  }, [user]);

  const loadWordsForActiveList = useCallback(async (): Promise<void> => {
    if (!user || !activeListId) return;
    const data = await fetchStudyWords(user.id, activeListId);
    setWords(data);
  }, [activeListId, user]);

  const reload = useCallback(async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    try {
      await loadListsAndCounts();
      if (mode === 'detail') await loadWordsForActiveList();
    } catch (e) {
      logger.error('Failed to load study data', e);
      Alert.alert('Error', 'Failed to load study data');
    } finally {
      setLoading(false);
    }
  }, [loadListsAndCounts, loadWordsForActiveList, mode, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      reload();
    }, [reload, user])
  );

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await loadListsAndCounts();
      if (mode === 'detail') await loadWordsForActiveList();
    } finally {
      setRefreshing(false);
    }
  }, [loadListsAndCounts, loadWordsForActiveList, mode, user]);

  const handleOpenList = useCallback(
    async (listId: string) => {
      setActiveListId(listId);
      setMode('detail');
      touchVocabList(listId).catch(() => {});
      if (!user) return;
      try {
        setLoading(true);
        const data = await fetchStudyWords(user.id, listId);
        setWords(data);
      } catch (e) {
        logger.error('Failed to load list words', e);
        Alert.alert('Error', 'Failed to load words');
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const handleStudyList = useCallback(
    (listId: string, listName: string, listCount: number) => {
      if (listCount === 0) {
        Alert.alert('No words', 'This list has no words yet.');
        return;
      }
      touchVocabList(listId).catch(() => {});
      navigation.navigate('Flashcards', { listId, listName });
    },
    [navigation]
  );

  const handleStudyAll = useCallback(() => {
    if (allCount === 0) {
      Alert.alert('No words', 'You have no saved words yet.');
      return;
    }
    navigation.navigate('Flashcards', { listId: null, listName: 'All words' });
  }, [allCount, navigation]);

  const handleDeleteWord = useCallback((word: StudyWord) => {
    Alert.alert('Delete Word', `Remove "${word.term}" from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStudyWord(word.id);
            setWords((prev) => prev.filter((w) => w.id !== word.id));
            setAllCount((prev) => Math.max(0, prev - 1));
            if (activeListId) {
              setCounts((prev) => ({ ...prev, [activeListId]: Math.max(0, (prev[activeListId] ?? 0) - 1) }));
            }
          } catch (e) {
            logger.error('Failed to delete word', e);
            Alert.alert('Error', 'Failed to delete word');
          }
        },
      },
    ]);
  }, [activeListId]);

  const handleMoveWord = useCallback(
    async (word: StudyWord, toListId: string) => {
      try {
        const updated = await moveStudyWordToList(word.id, toListId);
        touchVocabList(toListId).catch(() => {});
        setMoveTarget(null);

        if (activeListId && updated.list_id !== activeListId) {
          setWords((prev) => prev.filter((w) => w.id !== word.id));
          setCounts((prev) => ({
            ...prev,
            [activeListId]: Math.max(0, (prev[activeListId] ?? 0) - 1),
            [toListId]: (prev[toListId] ?? 0) + 1,
          }));
        } else {
          setWords((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        }
      } catch (e) {
        logger.error('Failed to move word', e);
        Alert.alert('Error', 'Failed to move word');
      }
    },
    [activeListId]
  );

  const handleCreateList = useCallback(async () => {
    if (!user) return;
    const name = createName.trim();
    if (!name) return;
    try {
      const created = await createVocabList(user.id, name);
      setLists((prev) => [...prev, created]);
      setCounts((prev) => ({ ...prev, [created.id]: 0 }));
      setCreateName('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create list');
    }
  }, [createName, user]);

  const handleRenameList = useCallback(async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    try {
      const updated = await renameVocabList(renameTarget.id, name);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setRenameTarget(null);
      setRenameName('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to rename list');
    }
  }, [renameName, renameTarget]);

  const handleConfirmDeleteList = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.name) {
      Alert.alert('Name Mismatch', 'Please type the list name exactly to confirm deletion.');
      return;
    }
    try {
      await deleteVocabList(deleteTarget.id);
      setLists((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setCounts((prev) => {
        const { [deleteTarget.id]: _drop, ...rest } = prev;
        return rest;
      });
      setDeleteTarget(null);
      setDeleteConfirm('');
      await loadListsAndCounts();
      if (activeListId === deleteTarget.id) {
        setActiveListId(null);
        setWords([]);
        setMode('lists');
      }
    } catch (e) {
      logger.error('Failed to delete list', e);
      Alert.alert('Error', 'Failed to delete list');
    }
  }, [activeListId, deleteConfirm, deleteTarget, loadListsAndCounts]);

  const manageModals = (
    <>
      <Modal visible={Boolean(renameTarget)} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Rename List</Text>
            <TextInput
              style={styles.confirmInput}
              value={renameName}
              onChangeText={setRenameName}
              placeholder="List name"
              placeholderTextColor={colors.textSecondary}
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
              <Text style={styles.inlineDangerText}>Delete list</Text>
            </TouchableOpacity>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => setRenameTarget(null)}>
                <Text style={styles.confirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, styles.confirmPrimary]} onPress={handleRenameList}>
                <Text style={[styles.confirmButtonText, styles.confirmPrimaryText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete List</Text>
            <Text style={styles.confirmBody}>
              Type <Text style={styles.confirmBold}>{deleteTarget?.name}</Text> to confirm. This deletes all words inside.
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="List name"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.confirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, styles.confirmDanger]} onPress={handleConfirmDeleteList}>
                <Text style={[styles.confirmButtonText, styles.confirmDangerText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <VocabListPickerModal
        visible={Boolean(moveTarget)}
        title="Move to list"
        lists={lists}
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

  if (mode === 'lists') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Study</Text>

            <TouchableOpacity
                style={[styles.studyAllButtonCompact, allCount === 0 && styles.disabled]}
                onPress={handleStudyAll}
                disabled={allCount === 0}
            >
                <Text style={styles.studyAllTextCompact}>Study all</Text>
                <Text style={styles.studyAllMetaCompact}>{allCount}</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={createName}
            onChangeText={setCreateName}
            placeholder={lists.length >= 5 ? 'List limit reached (max 5)' : 'New List Name'}
            placeholderTextColor={colors.textSecondary}
            editable={lists.length < 5}
          />
          <TouchableOpacity
            style={[styles.createButton, (lists.length >= 5 || createName.trim().length === 0) && styles.disabled]}
            onPress={handleCreateList}
            disabled={lists.length >= 5 || createName.trim().length === 0}
          >
            <Text style={styles.createButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState message="No lists yet. Create a list to start saving words." />}
          renderItem={({ item }) => {
            const c = counts[item.id] ?? 0;
            return (
              <View style={styles.listRow}>
                <TouchableOpacity style={styles.listRowLeft} onPress={() => handleOpenList(item.id)}>
                  <Text style={styles.listName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.listCount}>{c} words</Text>
                </TouchableOpacity>
                <View style={styles.listRowRight}>
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
                    <Text style={styles.inlineStudyText}>Study</Text>
                  </TouchableOpacity>
                  <Text style={styles.chevron}>›</Text>
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
          <Text style={styles.headerButtonText}>‹ Lists</Text>
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
          <Text style={styles.inlineStudyText}>Study</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={words}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message="No words in this list yet. Start reading and save words!" />}
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
                <Text style={styles.actionButtonText}>Move</Text>
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
  disabled: {
    opacity: 0.5,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
    alignSelf: 'flex-start',
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    borderRadius: 999,
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
  confirmInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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


