import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingGuestMigrationUserId,
  getPendingGuestMigrationUserId,
  migrateUserDataIfNeeded,
  setPendingGuestMigrationUserId,
} from '@/supabase/migrateUserData';

describe('migrateUserData helpers', () => {
  beforeEach(async () => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
    await AsyncStorage.clear();
  });

  it('migrateUserDataIfNeeded sends migrate mode', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, migrated: true, results: [] }),
    }) as unknown as typeof fetch;

    const result = await migrateUserDataIfNeeded('from', 'to', 'token');

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toContain('\"mode\":\"migrate\"');
  });

  it('migrateUserDataIfNeeded skips when IDs are missing', async () => {
    const result = await migrateUserDataIfNeeded('', 'to', 'token');
    expect(result).toEqual({ ok: true, migrated: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('migrateUserDataIfNeeded skips when IDs match', async () => {
    const result = await migrateUserDataIfNeeded('same', 'same', 'token');
    expect(result).toEqual({ ok: true, migrated: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('migrateUserDataIfNeeded soft-fails when token is missing', async () => {
    const result = await migrateUserDataIfNeeded('from', 'to', '');
    expect(result.ok).toBe(false);
    expect(result.migrated).toBe(false);
    expect(result.error).toContain('Missing access token');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('migrateUserDataIfNeeded returns soft error payload on failed response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: 'Migration blocked by limits' }),
    }) as unknown as typeof fetch;

    const result = await migrateUserDataIfNeeded('from', 'to', 'token');

    expect(result.ok).toBe(false);
    expect(result.migrated).toBe(false);
    expect(result.error).toContain('Migration blocked by limits');
  });

  it('migrateUserDataIfNeeded surfaces non-JSON backend errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Gateway timeout',
    }) as unknown as typeof fetch;

    const result = await migrateUserDataIfNeeded('from', 'to', 'token');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Gateway timeout');
  });

  it('stores and clears pending guest migration user id', async () => {
    expect(await getPendingGuestMigrationUserId()).toBeNull();
    await setPendingGuestMigrationUserId('guest-123');
    expect(await getPendingGuestMigrationUserId()).toBe('guest-123');
    await clearPendingGuestMigrationUserId();
    expect(await getPendingGuestMigrationUserId()).toBeNull();
  });

  it('ignores blank pending guest migration values', async () => {
    await setPendingGuestMigrationUserId('   ');
    expect(await getPendingGuestMigrationUserId()).toBeNull();
  });
});
