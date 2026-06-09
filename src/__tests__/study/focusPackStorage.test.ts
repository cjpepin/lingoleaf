import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedFocusPackAny,
  getCachedFocusPack,
  getCachedFocusPackMetadata,
  getFocusPackCompletion,
  saveCachedFocusPack,
  saveCachedFocusPackMetadata,
  saveFocusPackCompletion,
} from '@/study/focusPackStorage';
import type { StudyPack } from '@/study/focusPack';

function makePack(overrides?: Partial<StudyPack>): StudyPack {
  return {
    id: 'focus_hash',
    listId: null,
    mode: 'focus_pack',
    wordIds: ['w1', 'w2'],
    targetCount: 2,
    reviewCount: 1,
    newCount: 1,
    title: 'Today',
    coachLine: '1 review, 1 new',
    createdAt: '2026-04-04T08:00:00.000Z',
    expiresAt: '2026-04-05T08:00:00.000Z',
    ...overrides,
  };
}

describe('focusPackStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reuses a cached pack when the hash matches and the pack is fresh', async () => {
    const pack = makePack();
    await saveCachedFocusPack('user-1', 'hash-a', pack);

    const loaded = await getCachedFocusPack('user-1', 'hash-a', new Date('2026-04-04T12:00:00.000Z'));

    expect(loaded).toEqual(pack);
  });

  it('invalidates the cached pack when the hash changes', async () => {
    await saveCachedFocusPack('user-1', 'hash-a', makePack());

    const loaded = await getCachedFocusPack('user-1', 'hash-b', new Date('2026-04-04T12:00:00.000Z'));

    expect(loaded).toBeNull();
  });

  it('can still read the freshest cached pack regardless of hash', async () => {
    const pack = makePack();
    await saveCachedFocusPack('user-1', 'hash-a', pack);

    const loaded = await getCachedFocusPackAny('user-1', new Date('2026-04-04T12:00:00.000Z'));

    expect(loaded).toEqual(pack);
  });

  it('stores and returns a fresh focus-pack completion marker', async () => {
    await saveFocusPackCompletion('user-1', 'focus_hash', '2026-04-04T12:30:00.000Z');

    const loaded = await getFocusPackCompletion('user-1', 'focus_hash', new Date('2026-04-04T18:00:00.000Z'));

    expect(loaded).toBe('2026-04-04T12:30:00.000Z');
  });

  it('expires cached pack metadata after 24 hours', async () => {
    await saveCachedFocusPackMetadata('hash-a', {
      title: 'Today',
      coachLine: 'calm pack',
      groups: ['recent'],
    });

    const loaded = await getCachedFocusPackMetadata('hash-a', new Date(Date.now() + 26 * 60 * 60 * 1000));

    expect(loaded).toBeNull();
  });
});
