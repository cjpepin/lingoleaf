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

  const handlePostAuthMigration = async (fromUserId: string | null): Promise<void> => {
    if (!fromUserId) {
      logger.info('No fromUserId provided, skipping migration');
      return;
    }
    
    logger.info('Starting post-auth migration process', { fromUserId, isGuest });
    
    // Wait for session to be established with retry logic
    let attempts = 0;
    const maxAttempts = 10;
    let nextId: string | null = null;
    
    while (attempts < maxAttempts) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        nextId = sessionData.session.user.id;
        logger.info('Session established for migration', { 
          fromUserId, 
          nextId, 
          attempts,
          sameUser: fromUserId === nextId,
        });
        break;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        // Wait 100ms between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (!nextId) {
      logger.warn('Failed to establish session after sign-in, skipping migration');
      return;
    }
    
    if (fromUserId === nextId) {
      logger.info('Same user ID after auth, no migration needed');
      return;
    }
    
    logger.info('Different user IDs detected, proceeding with migration', { fromUserId, nextId });
    await migrateUserDataIfNeeded(fromUserId, nextId);
  };

  const handleAppleSignIn = async (): Promise<void> => {
    const available = Platform.OS === 'ios' ? await AppleAuthentication.isAvailableAsync() : false;
    if (!available) {
      Alert.alert('Unavailable', 'Sign in with Apple is only available on iOS devices.');
      return;
    }

    const fromUserId = isGuest ? user?.id ?? null : null;

    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        setSnackbar({ visible: true, message: 'Apple sign-in failed', type: 'error' });
        return;
      }
      await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      await handlePostAuthMigration(fromUserId);
      setSnackbar({ visible: true, message: 'Signed in successfully!', type: 'success' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (e: any) {
      if (isUserCancelledAuth(e)) return;
      logger.error('Apple sign-in failed', e);
      setSnackbar({ visible: true, message: e?.message ?? 'Apple sign-in failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (idToken: string): Promise<void> => {
    const fromUserId = isGuest ? user?.id ?? null : null;
    setLoading(true);
    try {
      await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      await handlePostAuthMigration(fromUserId);
      setSnackbar({ visible: true, message: 'Signed in successfully!', type: 'success' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (e: any) {
      logger.error('Google sign-in failed', e);
      setSnackbar({ visible: true, message: e?.message ?? 'Google sign-in failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      setSnackbar({ visible: true, message: 'Please enter email and password', type: 'error' });
      return;
    }

    if (effectiveIsSignUp) {
      // Validate password strength
      const validation = validatePassword(password);
      if (!validation.isValid) {
        setSnackbar({ 
          visible: true, 
          message: `Password must have: ${validation.errors.join(', ')}`, 
          type: 'error' 
        });
        return;
      }

      if (!confirmPassword) {
        setSnackbar({ visible: true, message: 'Please confirm your password', type: 'error' });
        return;
      }

      if (password !== confirmPassword) {
        setSnackbar({ visible: true, message: 'Passwords do not match', type: 'error' });
        return;
      }
    }

    const fromUserId = isGuest ? user?.id ?? null : null;

    setLoading(true);
    try {
      if (effectiveIsSignUp) {
        // Always use signUp for new accounts (sends proper welcome email)
        await signUp(email, password);
        // If user was a guest, migrate their data to the new account
        if (fromUserId) {
          await handlePostAuthMigration(fromUserId);
        }
      } else {
        // Sign in to existing account
        await signIn(email, password);
        // If user was a guest, migrate their data to the existing account
        if (fromUserId) {
          await handlePostAuthMigration(fromUserId);
        }
      }
      setSnackbar({ visible: true, message: effectiveIsSignUp ? 'Account created!' : 'Signed in successfully!', type: 'success' });
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error: any) {
      // Special handling for email confirmation requirement (expected behavior, not an error)
      if (error.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        logger.info('Email confirmation required for new account');
        Alert.alert(
          'Check Your Email',
          `We've sent a confirmation link to ${email}. Please check your inbox (and spam folder) and click the link to activate your account.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // Log actual errors
      logger.error('Auth error:', error);
      setSnackbar({ visible: true, message: error.message || 'Authentication failed', type: 'error' });
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
        <Text style={styles.title}>{mode === 'upgrade' ? 'Create Account' : 'LingoLeaf'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'upgrade'
            ? 'Back up your highlights, vocab, and reading progress.'
            : 'Read. Translate. Learn.'}
        </Text>

        <View style={styles.form}>
          <View style={styles.providers}>
            {Platform.OS === 'ios' ? (
              <Button
                label="Sign in with Apple"
                variant="surface"
                onPress={handleAppleSignIn}
                disabled={loading}
                style={styles.providerButton}
                textStyle={styles.providerText}
                leftIcon={<FontAwesome name="apple" size={18} color={colors.surface} />}
              />
            ) : null}
            <Button
              label="Sign in with Google"
              variant="surface"
              onPress={() => {
                if (!googleRequest) {
                  Alert.alert('Google not configured', 'Missing Google OAuth client IDs in env vars.');
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
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
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
                  <Text style={styles.passwordRulesTitle}>Password must have:</Text>
                  {passwordValidation.errors.map((error, i) => (
                    <Text key={i} style={styles.passwordRuleError}>• {error}</Text>
                  ))}
                  {passwordValidation.isValid && (
                    <Text style={styles.passwordRuleSuccess}>✓ Strong password!</Text>
                  )}
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
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
              {loading ? 'Loading...' : effectiveIsSignUp ? (isGuest ? 'Create Account' : 'Sign Up') : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {mode ? null : (
            <TouchableOpacity style={styles.switchButton} onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
              <Text style={styles.switchButtonText}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
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

