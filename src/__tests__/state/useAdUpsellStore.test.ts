import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAdUpsellStore } from '@/state/useAdUpsellStore';

jest.mock('@/analytics/client', () => ({
  track: jest.fn(),
}));

const { track } = require('@/analytics/client') as { track: jest.Mock };

describe('useAdUpsellStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    await AsyncStorage.clear();
    useAdUpsellStore.setState({
      hydrated: false,
      visible: false,
      impressionCount: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hydrates persisted impression count', async () => {
    await AsyncStorage.setItem('ll_ad_impressions_count', '7');

    await useAdUpsellStore.getState().hydrate();

    const state = useAdUpsellStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.impressionCount).toBe(7);
  });

  it('increments impressions without showing upsell before threshold', async () => {
    for (let i = 0; i < 9; i += 1) {
      await useAdUpsellStore.getState().recordImpression(false);
    }

    const state = useAdUpsellStore.getState();
    expect(state.impressionCount).toBe(9);
    expect(state.visible).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('shows upsell and tracks once when threshold is reached', async () => {
    for (let i = 0; i < 10; i += 1) {
      await useAdUpsellStore.getState().recordImpression(false);
    }

    const state = useAdUpsellStore.getState();
    expect(state.visible).toBe(true);
    expect(track).toHaveBeenCalledWith('ad_removed_seen', { impression_count: 10 });
  });

  it('does not show upsell again if already shown today', async () => {
    await AsyncStorage.setItem('ll_ad_impressions_count', '10');
    await AsyncStorage.setItem('ll_premium_soft_upsell_shown_date', '2026-03-01');

    await useAdUpsellStore.getState().recordImpression(false);

    expect(useAdUpsellStore.getState().visible).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('does nothing for premium users', async () => {
    await useAdUpsellStore.getState().recordImpression(true);

    expect(useAdUpsellStore.getState().impressionCount).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('dismiss hides visible interstitial', async () => {
    useAdUpsellStore.setState({ visible: true });

    useAdUpsellStore.getState().dismiss();

    expect(useAdUpsellStore.getState().visible).toBe(false);
  });
});
