import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkStudyListCreationEligibility,
  FREE_STUDY_LIST_CAP,
  getStudyListCap,
  getStudyListLimitMessage,
  PREMIUM_STUDY_LIST_CAP,
  recordStudyListCreated,
  STUDY_LIST_CREATION_RATE_LIMIT_PER_HOUR,
} from '@/premium/studyListPolicy';

describe('studyListPolicy', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
  });

  it('uses premium and free caps correctly', () => {
    expect(getStudyListCap(false)).toBe(FREE_STUDY_LIST_CAP);
    expect(getStudyListCap(true)).toBe(PREMIUM_STUDY_LIST_CAP);
    expect(getStudyListLimitMessage(PREMIUM_STUDY_LIST_CAP)).toBe(`List limit reached (max ${PREMIUM_STUDY_LIST_CAP})`);
  });

  it('blocks when current list count reaches cap', async () => {
    const result = await checkStudyListCreationEligibility('u1', FREE_STUDY_LIST_CAP, false);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('list_cap');
  });

  it('enforces rate limit per hour', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    for (let i = 0; i < STUDY_LIST_CREATION_RATE_LIMIT_PER_HOUR; i += 1) {
      await recordStudyListCreated('u1');
    }

    const blocked = await checkStudyListCreationEligibility('u1', 0, true);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe('rate_limit');
  });

  it('allows creation after rate-limit window expires', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    for (let i = 0; i < STUDY_LIST_CREATION_RATE_LIMIT_PER_HOUR; i += 1) {
      await recordStudyListCreated('u1');
    }

    jest.spyOn(Date, 'now').mockReturnValue(1_000_000 + 3_601_000);
    const allowed = await checkStudyListCreationEligibility('u1', 0, true);
    expect(allowed.ok).toBe(true);
  });
});
