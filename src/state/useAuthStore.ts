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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  upgradeGuestToEmailPassword: (email: string, password: string) => Promise<void>;
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
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    set({ session: data.session, user: data.user, isGuest: isAnonymousUser(data.user) });
  },

  upgradeGuestToEmailPassword: async (email, password) => {
    // Upgrade the currently-anonymous user to an email/password account.
    // This preserves the same user id, so all user-owned rows remain valid.
    const { data, error } = await supabase.auth.updateUser({ email, password });
    if (error) throw error;
    const user = data.user ?? null;
    const { data: sessionData } = await supabase.auth.getSession();
    set({ user, session: sessionData.session ?? null, isGuest: isAnonymousUser(user) });
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
    try {
      // Ensure we always have a user session (guest-first).
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user, isGuest: isAnonymousUser(session.user), loading: false, authError: null });
      } else {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          if (isAnonymousDisabledError(anonError)) {
            console.warn(
              'Anonymous sign-ins are disabled in Supabase. Enable Auth → Providers → Anonymous to use guest mode.'
            );
            set({
              session: null,
              user: null,
              isGuest: false,
              loading: false,
              authError:
                'Anonymous sign-ins are disabled in Supabase. Enable Auth → Providers → Anonymous to use guest mode.',
            });
          } else {
            throw anonError;
          }
        } else {
          set({
            session: anonData.session,
            user: anonData.user,
            isGuest: isAnonymousUser(anonData.user),
            loading: false,
            authError: null,
          });
        }
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null;
        set({ session, user, isGuest: isAnonymousUser(user), authError: null });
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ loading: false, authError: (error as any)?.message ?? 'Failed to initialize auth' });
    }
  },
}));

