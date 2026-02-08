/**
 * AuthScreen
 *
 * Guest-first upgrade entry:
 * - Apple / Google provider sign-in
 * - Email/password (sign in or create account)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Snackbar } from '@/components/Snackbar';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { validatePassword } from '@/utils/passwordValidation';
import { supabase } from '@/supabase/client';
import { migrateUserDataIfNeeded } from '@/supabase/migrateUserData';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { FontAwesome } from '@expo/vector-icons';
import { useTranslation } from '@/i18n/useTranslation';

type AuthRouteProp = RouteProp<RootStackParamList, 'Auth'>;

WebBrowser.maybeCompleteAuthSession();

function isUserCancelledAuth(error: unknown): boolean {
  const code = (error as any)?.code;
  // Apple (expo-apple-authentication) cancellation can come through as string or numeric.
  if (code === 'ERR_CANCELED' || code === 'ERR_REQUEST_CANCELED' || code === 'CANCELED') return true;

  const domain = ((error as any)?.domain as string | undefined) ?? '';
  const nativeCode = (error as any)?.nativeCode;
  // Some iOS auth errors surface as ASAuthorizationErrorDomain with numeric codes.
  // 1001 is "canceled"; 1000 is "unknown" but can appear when the sheet is dismissed.
  if (typeof domain === 'string' && domain.includes('ASAuthorizationErrorDomain')) {
    if (nativeCode === 1001 || nativeCode === 1000) return true;
  }

  const message = ((error as any)?.message as string | undefined) ?? '';
  if (typeof message === 'string') {
    const m = message.toLowerCase();
    if (m.includes('canceled') || m.includes('cancelled') || m.includes('cancel')) return true;
    // iOS sometimes reports dismiss/cancel as an "unknown reason" authorization failure.
    if (m.includes('authorization attempt') && m.includes('unknown reason')) return true;
  }
  return false;
}

export default function AuthScreen() {
  const route = useRoute<AuthRouteProp>();
  const navigation = useNavigation();
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const { user, signIn, signUp, isGuest } = useAuthStore();

  const mode = route.params?.mode;
  const effectiveIsSignUp = useMemo(() => {
    if (mode === 'upgrade') return true;
    if (mode === 'signin') return false;
    return isSignUp;
  }, [isSignUp, mode]);

  const passwordValidation = useMemo(() => {
    if (!effectiveIsSignUp || !password) return null;
    return validatePassword(password);
  }, [effectiveIsSignUp, password]);

  const googleConfig = useMemo(() => {
    return {
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    };
  }, []);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    ...googleConfig,
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = (googleResponse as any)?.params?.id_token as string | undefined;
    if (!idToken) return;
    handleGoogleSignIn(idToken).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const handlePostAuthMigration = async (
    fromUserId: string | null,
    session: { user: { id: string }; access_token: string } | null
  ): Promise<void> => {
    if (!fromUserId || !session?.user?.id || !session?.access_token) {
      logger.info('Skipping migration: missing fromUserId or session', { hasFrom: Boolean(fromUserId), hasSession: Boolean(session) });
      return;
    }
    const toUserId = session.user.id;
    if (fromUserId === toUserId) {
      logger.info('Same user ID after auth, no migration needed');
      return;
    }
    logger.info('Different user IDs detected, migrating with session from sign-in response', { fromUserId, toUserId });
    await migrateUserDataIfNeeded(fromUserId, toUserId, session.access_token);
  };

  const handleAppleSignIn = async (): Promise<void> => {
    const available = Platform.OS === 'ios' ? await AppleAuthentication.isAvailableAsync() : false;
    if (!available) {
      Alert.alert(t('common.error'), t('auth.appleUnavailable'));
      return;
    }

    const fromUserId = isGuest ? user?.id ?? null : null;

    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        setSnackbar({ visible: true, message: t('auth.appleFailed'), type: 'error' });
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (error) throw error;
      await handlePostAuthMigration(fromUserId, data?.session ?? null);
      setSnackbar({ visible: true, message: t('auth.signedInSuccess'), type: 'success' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (e: any) {
      if (isUserCancelledAuth(e)) return;
      logger.error('Apple sign-in failed', e);
      setSnackbar({ visible: true, message: e?.message ?? t('auth.appleFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (idToken: string): Promise<void> => {
    const fromUserId = isGuest ? user?.id ?? null : null;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
      await handlePostAuthMigration(fromUserId, data?.session ?? null);
      setSnackbar({ visible: true, message: t('auth.signedInSuccess'), type: 'success' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (e: any) {
      logger.error('Google sign-in failed', e);
      setSnackbar({ visible: true, message: e?.message ?? t('auth.googleFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      setSnackbar({ visible: true, message: t('auth.missingEmailPassword'), type: 'error' });
      return;
    }

    if (effectiveIsSignUp) {
      // Validate password strength
      const validation = validatePassword(password);
      if (!validation.isValid) {
        setSnackbar({ 
          visible: true, 
          message: t('auth.passwordRequirementsPrefix') + validation.errors.join(', '), 
          type: 'error' 
        });
        return;
      }

      if (!confirmPassword) {
        setSnackbar({ visible: true, message: t('auth.confirmPasswordRequired'), type: 'error' });
        return;
      }

      if (password !== confirmPassword) {
        setSnackbar({ visible: true, message: t('auth.passwordMismatch'), type: 'error' });
        return;
      }
    }

    const fromUserId = isGuest ? user?.id ?? null : null;

    setLoading(true);
    try {
      let session: { user: { id: string }; access_token: string } | null = null;
      if (effectiveIsSignUp) {
        // Always use signUp for new accounts (sends proper welcome email)
        session = (await signUp(email, password)) ?? null;
      } else {
        // Sign in to existing account
        session = (await signIn(email, password)) ?? null;
      }
      // If user was a guest, migrate their data using the session we just received
      if (fromUserId && session) {
        await handlePostAuthMigration(fromUserId, session);
      }
      setSnackbar({
        visible: true,
        message: effectiveIsSignUp ? t('auth.accountCreated') : t('auth.signedInSuccess'),
        type: 'success',
      });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error: any) {
      // Special handling for email confirmation requirement (expected behavior, not an error)
      if (error.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        logger.info('Email confirmation required for new account');
        Alert.alert(
          t('auth.checkEmailTitle'),
          t('auth.checkEmailMessage', { email }),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // Log actual errors
      logger.error('Auth error:', error);
      setSnackbar({
        visible: true,
        message: error.message || (effectiveIsSignUp ? t('auth.signUpError') : t('auth.signInError')),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{mode === 'upgrade' ? t('auth.signUp') : 'LingoLeaf'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'upgrade'
            ? t('auth.upgradeSubtitle')
            : t('auth.subtitle')}
        </Text>

        <View style={styles.form}>
          <View style={styles.providers}>
            {Platform.OS === 'ios' ? (
              <Button
                label={t('auth.appleSignIn')}
                variant="surface"
                onPress={handleAppleSignIn}
                disabled={loading}
                style={styles.providerButton}
                textStyle={styles.providerText}
                leftIcon={<FontAwesome name="apple" size={18} color={colors.surface} />}
              />
            ) : null}
            <Button
              label={t('auth.googleSignIn')}
              variant="surface"
              onPress={() => {
                if (!googleRequest) {
                  Alert.alert(
                    t('auth.googleNotConfiguredTitle'),
                    t('auth.googleNotConfiguredMessage'),
                  );
                  return;
                }
                googlePromptAsync()
                  .then((res) => {
                    // Treat user cancellation/dismiss as a no-op.
                    if (res.type === 'cancel' || res.type === 'dismiss') return;
                  })
                  .catch((e) => {
                    if (isUserCancelledAuth(e)) return;
                    // Avoid throwing an Alert here; handle real errors via the response effect / token flow.
                    logger.error('Google prompt failed', e);
                  });
              }}
              disabled={loading}
              style={styles.providerButton}
              textStyle={styles.providerText}
              leftIcon={<FontAwesome name="google" size={16} color={colors.surface} />}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {effectiveIsSignUp && (
            <>
              {passwordValidation && password && (
                <View style={styles.passwordRules}>
                  <Text style={styles.passwordRulesTitle}>{t('auth.passwordRulesTitle')}</Text>
                  {passwordValidation.errors.map((error, i) => (
                    <Text key={i} style={styles.passwordRuleError}>• {error}</Text>
                  ))}
                  {passwordValidation.isValid && (
                    <Text style={styles.passwordRuleSuccess}>{t('auth.passwordStrong')}</Text>
                  )}
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder={t('auth.confirmPassword')}
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? t('auth.loading')
                : effectiveIsSignUp
                ? t('auth.signUp')
                : t('auth.signIn')}
            </Text>
          </TouchableOpacity>

          {mode ? null : (
            <TouchableOpacity style={styles.switchButton} onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
              <Text style={styles.switchButtonText}>
                {isSignUp ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  form: {
    gap: spacing.md,
  },
  providers: {
    gap: spacing.sm,
  },
  providerButton: {
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  providerText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    ...typography.button,
    color: colors.surface,
  },
  switchButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  switchButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  passwordRules: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: -spacing.xs,
  },
  passwordRulesTitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  passwordRuleError: {
    ...typography.small,
    color: colors.error,
    marginTop: spacing.xs / 4,
  },
  passwordRuleSuccess: {
    ...typography.small,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.xs / 2,
  },
});

