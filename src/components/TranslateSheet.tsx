/**
 * TranslateSheet
 * Bottom sheet displaying translation with save option
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { useTranslation } from '@/i18n/useTranslation';
import type { VocabList } from '@/supabase/types';

interface Props {
  visible: boolean;
  term: string;
  translation: string | null;
  loading: boolean;
  error: string | null;
  selectedListName?: string | null;
  onSelectList?: () => void;
  listPickerVisible?: boolean;
  lists?: VocabList[];
  selectedListId?: string | null;
  onPickList?: (listId: string) => void;
  onCloseListPicker?: () => void;
  onCreateNewList?: (listName: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function TranslateSheet({
  visible,
  term,
  translation,
  loading,
  error,
  selectedListName,
  onSelectList,
  listPickerVisible,
  lists,
  selectedListId,
  onPickList,
  onCloseListPicker,
  onCreateNewList,
  onSave,
  onClose,
}: Props) {
  const t = useTranslation();
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const pickerScrollRef = useRef<ScrollView>(null);


  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop is a sibling behind the sheet so taps inside the sheet never close it */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{t('translate.translating')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>{t('translate.close')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.content}>
                <Text style={styles.label}>{t('translate.original')}</Text>
                <Text style={styles.term}>{term}</Text>
                
                <Text style={styles.label}>{t('translate.translation')}</Text>
                <Text style={styles.translation}>{translation}</Text>

                {onSelectList ? (
                  <>
                    <Text style={styles.label}>{t('translate.list')}</Text>
                    <TouchableOpacity style={styles.listButton} onPress={onSelectList}>
                      <Text style={styles.listButtonText} numberOfLines={1}>
                        {selectedListName || t('translate.selectList')}
                      </Text>
                      <Text style={styles.listButtonChevron}>›</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
              
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={onSave}
                >
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                    {t('translate.saveToList')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={onClose}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* List picker rendered inside this modal to avoid stacking Modals on iOS */}
          {listPickerVisible && lists && onPickList && onCloseListPicker ? (
            <View style={styles.pickerOverlay} pointerEvents="box-none">
              <Pressable style={StyleSheet.absoluteFill} onPress={onCloseListPicker} />
              <KeyboardAvoidingView
                style={styles.pickerAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? (showNewListInput ? 220 : 120) : 0}
              >
              <View style={[styles.pickerCard, showNewListInput && styles.pickerCardWithInput]}>
                <Text style={styles.pickerTitle}>{t('translate.chooseList')}</Text>
                {/* New list input at top when visible so it stays above keyboard */}
                {showNewListInput ? (
                  <View style={styles.newListInput}>
                    <TextInput
                      style={styles.newListTextInput}
                      placeholder={t('translate.listName')}
                      placeholderTextColor={colors.textTertiary}
                      value={newListName}
                      onChangeText={setNewListName}
                      autoFocus
                    />
                    <View style={styles.newListActions}>
                      <TouchableOpacity
                        style={[styles.newListButton, styles.newListButtonCreate]}
                        onPress={() => {
                          if (!newListName.trim()) {
                            Alert.alert(t('translate.error'), t('translate.pleaseEnterListName'));
                            return;
                          }
                          onCreateNewList?.(newListName.trim());
                          setNewListName('');
                          setShowNewListInput(false);
                          onCloseListPicker();
                        }}
                      >
                        <Text style={styles.newListButtonTextCreate}>{t('translate.create')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.newListButton}
                        onPress={() => {
                          setNewListName('');
                          setShowNewListInput(false);
                        }}
                      >
                        <Text style={styles.newListButtonText}>{t('study.cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                <ScrollView
                  ref={pickerScrollRef}
                  style={styles.pickerList}
                  contentContainerStyle={styles.pickerListContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {lists.map((l) => {
                    const selected = l.id === selectedListId;
                    return (
                      <TouchableOpacity
                        key={l.id}
                        style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                        onPress={() => onPickList(l.id)}
                      >
                        <Text style={[styles.pickerRowText, selected && styles.pickerRowTextSelected]} numberOfLines={1}>
                          {l.name}
                        </Text>
                        {selected ? <Text style={styles.pickerCheck}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                  {!showNewListInput ? (
                    <TouchableOpacity
                      style={[styles.pickerRow, styles.newListRow]}
                      onPress={() => setShowNewListInput(true)}
                    >
                      <Text style={styles.newListText}>{t('translate.createNewList')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </ScrollView>
                <TouchableOpacity style={styles.pickerCloseButton} onPress={onCloseListPicker}>
                  <Text style={styles.pickerCloseText}>{t('translate.close')}</Text>
                </TouchableOpacity>
              </View>
              </KeyboardAvoidingView>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    minHeight: 300,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  content: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  term: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  translation: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  listButtonText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  listButtonChevron: {
    ...typography.h2,
    color: colors.textSecondary,
    marginTop: -2,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  pickerAvoid: {
    flex: 1,
    maxHeight: '85%',
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    maxHeight: '100%',
  },
  pickerCardWithInput: {
    minHeight: 220,
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerList: {
    flex: 1,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  pickerListContent: {
    gap: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  pickerRowText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  pickerRowTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerCheck: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  newListRow: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  newListText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  newListInput: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  newListTextInput: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  newListActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  newListButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  newListButtonCreate: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  newListButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  newListButtonTextCreate: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
  pickerCloseButton: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pickerCloseText: {
    ...typography.button,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: {
    ...typography.button,
    color: colors.text,
  },
  buttonTextPrimary: {
    color: colors.surface,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});

