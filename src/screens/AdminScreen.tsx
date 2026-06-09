/**
 * AdminScreen
 * Admin-only page for managing global library
 * Only accessible to users with admin=true in user_settings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { useAuthStore } from '@/state/useAuthStore';
import { checkIsAdmin, createBook, updateBook } from '@/supabase/queries';
import { supabase } from '@/supabase/client';
import { logger } from '@/utils/logger';
import { extractEpubCover } from '@/utils/epubCover';
import { useTranslation } from '@/i18n/useTranslation';

const STORAGE_BUCKETS = [
  { id: 'general-library' as const, nameKey: 'admin.generalLibrary' },
] as const;

const SOURCE_LANGUAGES = [
  { code: 'en' },
  { code: 'es' },
  { code: 'fr' },
  { code: 'de' },
  { code: 'it' },
  { code: 'pt' },
  { code: 'ru' },
  { code: 'zh' },
  { code: 'ja' },
  { code: 'ko' },
] as const;

export default function AdminScreen() {
  const navigation = useNavigation();
  const t = useTranslation();
  const { user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Upload metadata
  const [bucketId, setBucketId] = useState<(typeof STORAGE_BUCKETS)[number]['id']>('general-library');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [sourceLang, setSourceLang] = useState<(typeof SOURCE_LANGUAGES)[number]['code']>('en');

  useEffect(() => {
    checkAdminStatus();
  }, [user]);
  const untitledLabel = t('admin.untitled');

  const checkAdminStatus = async () => {
    if (!user) {
      navigation.goBack();
      return;
    }

    try {
      const adminStatus = await checkIsAdmin(user.id);
      setIsAdmin(adminStatus);
      
      if (!adminStatus) {
        Alert.alert(t('admin.accessDeniedTitle'), t('admin.accessDeniedBody'));
        navigation.goBack();
      }
    } catch (error) {
      logger.error('Failed to check admin status:', error);
      Alert.alert(t('common.error'), t('admin.verifyFailed'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEpub = async () => {
    try {
      // Pick EPUB file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/epub+zip',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      if (!file.uri) {
        Alert.alert(t('common.error'), t('admin.noFileSelected'));
        return;
      }

      const MAX_FILE_SIZE_MB = 50;
      if (file.size && file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        Alert.alert(t('admin.fileTooLargeTitle'), t('admin.fileTooLargeBody', { sizeMb: MAX_FILE_SIZE_MB }));
        return;
      }

      const fileName = file.name || untitledLabel;
      const inferredTitle = fileName.replace(/\.epub$/i, '');

      setSelectedFile(file);
      setTitle((prev) => (prev.trim().length > 0 ? prev : inferredTitle));

      logger.info('Selected EPUB', {
        name: fileName,
        size: file.size,
      });
    } catch (error) {
      logger.error('Failed to pick EPUB:', error);
      Alert.alert(t('common.error'), t('admin.selectEpubFailed'));
    }
  };

  const handleUploadEpub = async () => {
    if (!selectedFile?.uri) {
      Alert.alert(t('admin.missingFileTitle'), t('admin.missingFileBody'));
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(t('admin.missingTitleTitle'), t('admin.missingTitleBody'));
      return;
    }

    try {
      setUploading(true);

      const fileName = selectedFile.name || `${untitledLabel}.epub`;
      const filePath = `${Date.now()}-${fileName}`;

      logger.info('Uploading EPUB', {
        bucketId,
        filePath,
        title: trimmedTitle,
        author: author.trim() || null,
        sourceLang,
      });

      // Use FormData to upload the file properly in React Native
      const formData = new FormData();
      
      // Create file object for FormData
      const fileToUpload: any = {
        uri: selectedFile.uri,
        type: 'application/epub+zip',
        name: fileName,
      };
      
      formData.append('file', fileToUpload);
      
      logger.info('Uploading file via FormData', { name: fileName, size: selectedFile.size });

      // Use fetch directly with FormData for proper binary upload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('admin.notAuthenticated'));
      }

      // Get Supabase URL from environment
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketId}/${filePath}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logger.error('Upload failed', { status: uploadResponse.status, error: errorText });
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      logger.info('File uploaded successfully', { path: filePath, result: uploadResult });

      // Create book record in database
      const book = await createBook({
        title: trimmedTitle,
        author: author.trim() || null,
        cover_path: null,
        source_lang: sourceLang,
        storage_path: filePath,
      });

      logger.info('Book created:', book);

      // Best-effort: extract cover from the selected EPUB and upload it, so library shows covers immediately.
      try {
        const cover = await extractEpubCover(selectedFile.uri);
        if (cover) {
          const coverPath = `covers/${book.id}.${cover.ext}`;
          const coverUri = `${FileSystem.cacheDirectory}tmp-cover-${book.id}.${cover.ext}`;

          await FileSystem.writeAsStringAsync(coverUri, cover.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const coverForm = new FormData();
          const mime =
            cover.ext === 'png'
              ? 'image/png'
              : cover.ext === 'webp'
                ? 'image/webp'
                : 'image/jpeg';

          coverForm.append('file', {
            uri: coverUri,
            type: mime,
            name: `cover-${book.id}.${cover.ext}`,
          } as any);

          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const coverUploadUrl = `${supabaseUrl}/storage/v1/object/${bucketId}/${coverPath}`;

          const coverResp = await fetch(coverUploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: coverForm,
          });

          if (!coverResp.ok) {
            const errorText = await coverResp.text();
            logger.warn('Cover upload failed', { status: coverResp.status, error: errorText });
          } else {
            await updateBook(book.id, { cover_path: coverPath });
            logger.info('✅ Cover uploaded and book updated', { bookId: book.id, coverPath });
          }

          // Cleanup temp file
          FileSystem.deleteAsync(coverUri, { idempotent: true }).catch(() => {});
        } else {
          logger.info('No embedded cover found in EPUB (skipping cover upload)');
        }
      } catch (coverError) {
        logger.warn('Cover extraction/upload failed (non-fatal)', coverError);
      }

      Alert.alert(
        t('admin.uploadSuccessTitle'),
        t('admin.uploadSuccessBody', { title: trimmedTitle }),
        [{ text: t('common.ok') }]
      );

      // Reset form for next upload
      setSelectedFile(null);
      setTitle('');
      setAuthor('');
      setSourceLang('en');
      setBucketId('general-library');
    } catch (error) {
      logger.error('Failed to upload EPUB:', error);
      Alert.alert(t('admin.uploadFailedTitle'), t('admin.uploadFailedBody'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav.adminPanel')}</Text>
        <Text style={styles.subtitle}>{t('admin.subtitle')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.uploadEpub')}</Text>
        <Text style={styles.sectionDescription}>
          {t('admin.uploadEpubDescription')}
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('admin.selectedFile')}</Text>
          <View style={styles.fileRow}>
            <Text style={styles.fileName} numberOfLines={1}>
              {selectedFile?.name ?? t('admin.noFileSelected')}
            </Text>
            <TouchableOpacity
              style={[styles.secondaryButton, uploading && styles.secondaryButtonDisabled]}
              onPress={handleSelectEpub}
              disabled={uploading}
            >
              <Text style={styles.secondaryButtonText}>
                {selectedFile ? t('admin.changeFile') : t('admin.selectFile')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('admin.bookTitle')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('admin.bookTitlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!uploading}
          />

          <Text style={styles.label}>{t('admin.authorOptional')}</Text>
          <TextInput
            style={styles.input}
            value={author}
            onChangeText={setAuthor}
            placeholder={t('admin.authorPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!uploading}
          />

          <Text style={styles.label}>{t('admin.sourceLanguage')}</Text>
          <View style={styles.pillRow}>
            {SOURCE_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.pill,
                  sourceLang === lang.code && styles.pillSelected,
                ]}
                onPress={() => setSourceLang(lang.code)}
                disabled={uploading}
              >
                <Text
                  style={[
                    styles.pillText,
                    sourceLang === lang.code && styles.pillTextSelected,
                  ]}
                >
                  {lang.code.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('admin.storageBucket')}</Text>
          <View style={styles.pillRow}>
            {STORAGE_BUCKETS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.pill, bucketId === b.id && styles.pillSelected]}
                onPress={() => setBucketId(b.id)}
                disabled={uploading}
              >
                <Text style={[styles.pillText, bucketId === b.id && styles.pillTextSelected]}>
                  {t(b.nameKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            {t('admin.storageBucketHelper')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={handleUploadEpub}
          disabled={uploading || !selectedFile}
        >
          {uploading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <View style={styles.uploadButtonContent}>
              <Feather name="upload-cloud" size={18} color={colors.background} />
              <Text style={styles.uploadButtonText}>{t('admin.uploadBook')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.instructionsTitle')}</Text>
        <View style={styles.instructionsList}>
          <Text style={styles.instruction}>{t('admin.instructions.1')}</Text>
          <Text style={styles.instruction}>{t('admin.instructions.2')}</Text>
          <Text style={styles.instruction}>{t('admin.instructions.3')}</Text>
          <Text style={styles.instruction}>{t('admin.instructions.4')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.notesTitle')}</Text>
        <Text style={styles.note}>
          {t('admin.notes.1')}
        </Text>
        <Text style={styles.note}>
          {t('admin.notes.2')}
        </Text>
        <Text style={styles.note}>
          {t('admin.notes.3')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  form: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlightMint,
  },
  pillText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: colors.primary,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
  instructionsList: {
    gap: spacing.sm,
  },
  instruction: {
    ...typography.body,
    color: colors.text,
    paddingLeft: spacing.md,
  },
  note: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
});
