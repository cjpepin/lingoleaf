import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_EMAIL_CONFIRMATION_KEY = '@lingoleaf:pending_email_confirmation';
const PENDING_EMAIL_CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingEmailConfirmationRecord {
  email: string;
  createdAt: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readPendingEmailConfirmation(): Promise<PendingEmailConfirmationRecord | null> {
  const raw = await AsyncStorage.getItem(PENDING_EMAIL_CONFIRMATION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingEmailConfirmationRecord;
    if (!parsed.email || typeof parsed.createdAt !== 'number') {
      await AsyncStorage.removeItem(PENDING_EMAIL_CONFIRMATION_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > PENDING_EMAIL_CONFIRMATION_TTL_MS) {
      await AsyncStorage.removeItem(PENDING_EMAIL_CONFIRMATION_KEY);
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(PENDING_EMAIL_CONFIRMATION_KEY);
    return null;
  }
}

export async function markPendingEmailConfirmation(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  await AsyncStorage.setItem(
    PENDING_EMAIL_CONFIRMATION_KEY,
    JSON.stringify({
      email: normalizedEmail,
      createdAt: Date.now(),
    } satisfies PendingEmailConfirmationRecord)
  );
}

export async function hasPendingEmailConfirmation(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  const pending = await readPendingEmailConfirmation();
  return pending?.email === normalizedEmail;
}

export async function clearPendingEmailConfirmation(email?: string): Promise<void> {
  const pending = await readPendingEmailConfirmation();
  if (!pending) return;

  if (email && pending.email !== normalizeEmail(email)) {
    return;
  }

  await AsyncStorage.removeItem(PENDING_EMAIL_CONFIRMATION_KEY);
}
