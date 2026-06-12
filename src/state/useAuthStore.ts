/**
 * Auth state management
 * Handles user session and authentication
 */

import { create } from 'zustand';
import { supabase } from '@/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { isDemoMode } from '@/demo/config';
import { DEMO_USER } from '@/demo/demoUser';
import { ensureDemoHydrated } from '@/demo/localRepository';
import { useStudyStore } from '@/state/useStudyStore';
import { reset, track } from '@/analytics/client';
import { AUTH_EMAIL_REDIRECT_URL } from '@/utils/authDeepLink';
import {
  clearPendingEmailConfirmation,
  hasPendingEmailConfirmation,
  markPendingEmailConfirmation,
} from '@/utils/pendingEmailConfirmation';

interface AuthStore {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  loading: boolean;
  authError: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  ensureGuestSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Session | null>;
  signUp: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

function isAnonymousUser(user: User | null): boolean {
  // supabase-js exposes is_anonymous for anonymous sessions
  return (user as any)?.is_anonymous === true;
}

function isAnonymousDisabledError(error: unknown): boolean {
  const message = (error as any)?.message as string | undefined;
  return typeof message === 'string' && message.toLowerCase().includes('anonymous sign-ins are disabled');
}

function isNetworkError(error: unknown): boolean {
  const message = (error as any)?.message as string | undefined;
  const name = (error as any)?.name as string | undefined;
  if (typeof message === 'string' && message.toLowerCase().includes('network')) return true;
  if (typeof name === 'string' && name.toLowerCase().includes('fetch')) return true;
  return false;
}

function isInvalidCredentialsError(error: unknown): boolean {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? '';
  const code = String((error as { code?: string })?.code ?? '').toLowerCase();
  return message.includes('invalid login credentials') || code.includes('invalid_credentials');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function clearLocalAuthSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isGuest: false,
  loading: true,
  authError: null,

  setUser: (user) => set({ user }),
  
  setSession: (session) => {
    const user = session?.user ?? null;
    set({ session, user, isGuest: isAnonymousUser(user) });
  },

  ensureGuestSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) {
      set({ session: data.session, user: data.session.user, isGuest: isAnonymousUser(data.session.user) });
      return;
    }

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) {
      if (isAnonymousDisabledError(anonError)) {
        set({
          session: null,
          user: null,
          isGuest: false,
          authError:
            'Anonymous sign-ins are disabled in Supabase. Enable Auth → Providers → Anonymous to use guest mode.',
        });
        return;
      }
      throw anonError;
    }
    set({ session: anonData.session, user: anonData.user, isGuest: isAnonymousUser(anonData.user) });
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (isInvalidCredentialsError(error) && await hasPendingEmailConfirmation(email)) {
        throw new Error('EMAIL_NOT_CONFIRMED');
      }
      throw error;
    }
    const signedInUser = data.user ?? data.session?.user ?? null;
    if (signedInUser && !signedInUser.email_confirmed_at) {
      // Defensive: if auth returns a session for an unconfirmed user, immediately clear it.
      await clearLocalAuthSession();
      throw new Error('EMAIL_NOT_CONFIRMED');
    }
    await clearPendingEmailConfirmation(email);
    set({
      session: data.session,
      user: signedInUser,
      isGuest: isAnonymousUser(signedInUser),
      authError: null,
    });
    return data.session;
  },

  signUp: async (email, password) => {
    const {
      data: { session: previousSession },
      error: previousSessionError,
    } = await supabase.auth.getSession();
    if (previousSessionError) throw previousSessionError;
    const previousGuestSession = previousSession && isAnonymousUser(previousSession.user) ? previousSession : null;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_EMAIL_REDIRECT_URL,
      },
    });
    if (error) throw error;

    if (data.session) {
      const signedUpUser = data.user ?? data.session.user ?? null;
      await clearPendingEmailConfirmation(email);
      set({
        session: data.session,
        user: signedUpUser,
        isGuest: isAnonymousUser(signedUpUser),
        authError: null,
      });
      return data.session;
    }

    await markPendingEmailConfirmation(email);

    // Keep the original guest session active until email is confirmed and user explicitly signs in.
    if (previousGuestSession && previousGuestSession.refresh_token && previousGuestSession.access_token) {
      try {
        const { data: restoredData, error: restoredError } = await (supabase.auth as any).setSession({
          access_token: previousGuestSession.access_token,
          refresh_token: previousGuestSession.refresh_token,
        });
        if (restoredError) throw restoredError;
        const restoredSession = restoredData?.session ?? previousGuestSession;
        set({ session: restoredSession, user: restoredSession.user, isGuest: true, authError: null });
      } catch {
        // If restoring the previous guest session fails, keep current state and let initialize() recover.
      }
    }
    throw new Error('EMAIL_CONFIRMATION_REQUIRED');
  },


  signOut: async () => {
    track('logout', { source: 'profile_screen' });
    await clearLocalAuthSession();
    await reset();
    // Immediately fall back to guest so the app is never "logged out".
    set({ session: null, user: null, isGuest: false, authError: null });
    try {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        if (isAnonymousDisabledError(anonError)) {
          set({
            session: null,
            user: null,
            isGuest: false,
            authError:
              'Anonymous sign-ins are disabled in Supabase. Enable Auth → Providers → Anonymous to use guest mode.',
          });
        }
      } else {
        set({ session: anonData.session, user: anonData.user, isGuest: isAnonymousUser(anonData.user) });
      }
    } catch {
      // If this fails, initialize() will retry on next app open.
    }
  },

  initialize: async () => {
    if (isDemoMode()) {
      set({ loading: true, authError: null });
      try {
        await ensureDemoHydrated();
        useStudyStore.getState().clear();
        set({
          session: null,
          user: DEMO_USER,
          isGuest: true,
          loading: false,
          authError: null,
        });
      } catch (error) {
        console.error('Failed to initialize demo mode:', error);
        set({
          loading: false,
          authError: (error as Error)?.message ?? 'Failed to initialize demo mode',
        });
      }
      return;
    }

    set({ loading: true, authError: null });
    const maxRetries = 3;
    const baseDelayMs = 1000;

    const attemptInit = async (): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.user.email_confirmed_at) {
          await clearPendingEmailConfirmation(session.user.email ?? undefined);
        }
        set({ session, user: session.user, isGuest: isAnonymousUser(session.user), loading: false, authError: null });
        return;
      }
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        if (isAnonymousDisabledError(anonError)) {
          set({
            session: null,
            user: null,
            isGuest: false,
            loading: false,
            authError:
              'Anonymous sign-ins are disabled in Supabase. Enable Auth → Providers → Anonymous to use guest mode.',
          });
          return;
        }
        throw anonError;
      }
      set({
        session: anonData.session,
        user: anonData.user,
        isGuest: isAnonymousUser(anonData.user),
        loading: false,
        authError: null,
      });
    };

    try {
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await attemptInit();
          supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            if (user?.email_confirmed_at) {
              void clearPendingEmailConfirmation(user.email ?? undefined);
            }
            set({ session, user, isGuest: isAnonymousUser(user), authError: null });
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries && isNetworkError(error)) {
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
          } else {
            throw error;
          }
        }
      }
      throw lastError;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      const message = isNetworkError(error)
        ? 'Network request failed. Check your connection and try again.'
        : ((error as any)?.message ?? 'Failed to initialize auth');
      set({ loading: false, authError: message });
    }
  },
}));
