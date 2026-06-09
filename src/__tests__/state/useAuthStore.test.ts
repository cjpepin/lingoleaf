type MockAuthApi = {
  getSession: jest.Mock;
  setSession: jest.Mock;
  signInAnonymously: jest.Mock;
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  signOut: jest.Mock;
  onAuthStateChange: jest.Mock;
};

jest.mock('@/supabase/client', () => {
  const auth: MockAuthApi = {
    getSession: jest.fn(),
    setSession: jest.fn(),
    signInAnonymously: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  };
  return {
    supabase: { auth },
    __mockAuth: auth,
  };
});

import { useAuthStore } from '@/state/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { __mockAuth } = require('@/supabase/client') as { __mockAuth: MockAuthApi };

describe('useAuthStore', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      user: null,
      session: null,
      isGuest: false,
      loading: true,
      authError: null,
    });
    Object.values(__mockAuth).forEach((fn) => fn.mockReset?.());
    __mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    __mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await AsyncStorage.clear();
  });

  it('ensureGuestSession uses existing session if present', async () => {
    const existingSession = { user: { id: 'u1', is_anonymous: false } };
    __mockAuth.getSession.mockResolvedValue({ data: { session: existingSession }, error: null });

    await useAuthStore.getState().ensureGuestSession();

    expect(__mockAuth.signInAnonymously).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.id).toBe('u1');
    expect(useAuthStore.getState().isGuest).toBe(false);
  });

  it('signUp throws EMAIL_CONFIRMATION_REQUIRED when session is null and account unconfirmed', async () => {
    __mockAuth.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: 'u2', identities: [], email_confirmed_at: null, is_anonymous: false },
      },
      error: null,
    });

    await expect(useAuthStore.getState().signUp('a@b.com', 'password123')).rejects.toThrow(
      'EMAIL_CONFIRMATION_REQUIRED'
    );
    expect(__mockAuth.setSession).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem('@lingoleaf:pending_email_confirmation')).resolves.toContain('a@b.com');
  });

  it('signUp restores previous guest session while awaiting confirmation', async () => {
    const guestSession = {
      user: { id: 'guest-1', is_anonymous: true },
      access_token: 'guest-access',
      refresh_token: 'guest-refresh',
    };
    __mockAuth.getSession.mockResolvedValue({ data: { session: guestSession }, error: null });
    __mockAuth.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: 'new-user', identities: [], email_confirmed_at: null, is_anonymous: false },
      },
      error: null,
    });
    __mockAuth.setSession.mockResolvedValue({
      data: { session: guestSession },
      error: null,
    });

    await expect(useAuthStore.getState().signUp('a@b.com', 'password123')).rejects.toThrow(
      'EMAIL_CONFIRMATION_REQUIRED'
    );

    expect(__mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'guest-access',
      refresh_token: 'guest-refresh',
    });
    expect(useAuthStore.getState().user?.id).toBe('guest-1');
    expect(useAuthStore.getState().isGuest).toBe(true);
  });

  it('initialize hydrates existing session and clears loading', async () => {
    const existingSession = { user: { id: 'u3', is_anonymous: false } };
    __mockAuth.getSession.mockResolvedValue({ data: { session: existingSession }, error: null });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe('u3');
    expect(__mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('signIn rejects unconfirmed email sessions and signs out immediately', async () => {
    __mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: 'u4', is_anonymous: false } },
        user: { id: 'u4', email_confirmed_at: null, is_anonymous: false },
      },
      error: null,
    });
    __mockAuth.signOut.mockResolvedValue({ error: null });

    await expect(useAuthStore.getState().signIn('a@b.com', 'password123')).rejects.toThrow('EMAIL_NOT_CONFIRMED');

    expect(__mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(__mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signIn treats invalid credentials as unconfirmed when the email is pending confirmation', async () => {
    await AsyncStorage.setItem(
      '@lingoleaf:pending_email_confirmation',
      JSON.stringify({ email: 'a@b.com', createdAt: Date.now() })
    );
    __mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(useAuthStore.getState().signIn('A@B.com', 'password123')).rejects.toThrow('EMAIL_NOT_CONFIRMED');
  });

  it('signIn clears pending confirmation after a successful confirmed login', async () => {
    await AsyncStorage.setItem(
      '@lingoleaf:pending_email_confirmation',
      JSON.stringify({ email: 'a@b.com', createdAt: Date.now() })
    );
    __mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: 'u5', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false } },
        user: { id: 'u5', email: 'a@b.com', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false },
      },
      error: null,
    });

    await expect(useAuthStore.getState().signIn('a@b.com', 'password123')).resolves.toEqual({
      user: { id: 'u5', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false },
    });
    await expect(AsyncStorage.getItem('@lingoleaf:pending_email_confirmation')).resolves.toBeNull();
    expect(useAuthStore.getState().isGuest).toBe(false);
  });

  it('signUp returns a live session when email confirmation is not required', async () => {
    __mockAuth.signUp.mockResolvedValue({
      data: {
        session: {
          user: { id: 'u6', email: 'a@b.com', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false },
        },
        user: { id: 'u6', email: 'a@b.com', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false },
      },
      error: null,
    });

    await expect(useAuthStore.getState().signUp('a@b.com', 'password123')).resolves.toEqual({
      user: { id: 'u6', email: 'a@b.com', email_confirmed_at: '2026-03-23T12:00:00.000Z', is_anonymous: false },
    });
    await expect(AsyncStorage.getItem('@lingoleaf:pending_email_confirmation')).resolves.toBeNull();
    expect(useAuthStore.getState().isGuest).toBe(false);
  });

  it('ensureGuestSession creates anonymous user when no session exists', async () => {
    __mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    __mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: { user: { id: 'guest-2', is_anonymous: true } }, user: { id: 'guest-2', is_anonymous: true } },
      error: null,
    });

    await useAuthStore.getState().ensureGuestSession();

    expect(__mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isGuest).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('guest-2');
  });

  it('initialize surfaces anonymous-disabled configuration errors', async () => {
    __mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    __mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Anonymous sign-ins are disabled' },
    });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().isGuest).toBe(false);
    expect(useAuthStore.getState().authError).toContain('Anonymous sign-ins are disabled');
  });

  it('signOut falls back to anonymous session', async () => {
    __mockAuth.signOut.mockResolvedValue({ error: null });
    __mockAuth.signInAnonymously.mockResolvedValue({
      data: { session: { user: { id: 'guest', is_anonymous: true } }, user: { id: 'guest', is_anonymous: true } },
      error: null,
    });

    await useAuthStore.getState().signOut();

    expect(__mockAuth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(__mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useAuthStore.getState().user?.id).toBe('guest');
    expect(useAuthStore.getState().isGuest).toBe(true);
  });
});
