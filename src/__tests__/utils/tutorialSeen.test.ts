import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenTutorial, markTutorialSeen, tutorialSeenKey } from '@/utils/tutorialSeen';

describe('tutorialSeen helpers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('builds scoped keys when user id is present', () => {
    expect(tutorialSeenKey('@k', 'user-1')).toBe('@k:user-1');
    expect(tutorialSeenKey('@k', '  user-2  ')).toBe('@k:user-2');
    expect(tutorialSeenKey('@k', null)).toBe('@k');
  });

  it('reads false when scoped key has not been seen', async () => {
    const seen = await hasSeenTutorial('@tutorial', 'u1');
    expect(seen).toBe(false);
  });

  it('migrates legacy key to scoped key for signed-in user', async () => {
    await AsyncStorage.setItem('@tutorial', 'true');

    const seen = await hasSeenTutorial('@tutorial', 'u1');

    expect(seen).toBe(true);
    expect(await AsyncStorage.getItem('@tutorial:u1')).toBe('true');
  });

  it('marks scoped tutorial key as seen for signed-in user', async () => {
    await markTutorialSeen('@tutorial', 'u2');
    expect(await AsyncStorage.getItem('@tutorial:u2')).toBe('true');
    expect(await AsyncStorage.getItem('@tutorial')).toBeNull();
  });

  it('marks base key as seen when no user id', async () => {
    await markTutorialSeen('@tutorial', null);
    expect(await AsyncStorage.getItem('@tutorial')).toBe('true');
  });
});
