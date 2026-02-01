/**
 * Auth state management
 * Handles user session and authentication
 */

import { create } from 'zustand';
import { supabase } from '@/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

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

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
    if (error) throw error;
    set({ session: data.session, user: data.user });
    return data.session;
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    
    // When email confirmation is enabled, data.session will be null and user.identities will be empty
    // until the user clicks the confirmation link.
    const needsEmailConfirmation = !data.session && data.user && (data.user.identities?.length === 0 || !data.user.email_confirmed_at);
    
    set({ session: data.session, user: data.user, isGuest: isAnonymousUser(data.user) });
    
    // Return a signal so AuthScreen can show appropriate messaging
    if (needsEmailConfirmation) {
      throw new Error('EMAIL_CONFIRMATION_REQUIRED');
    }
    return data.session;
  },


  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
    set({ loading: true, authError: null });
    const maxRetries = 3;
    const baseDelayMs = 1000;

    const attemptInit = async (): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
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

