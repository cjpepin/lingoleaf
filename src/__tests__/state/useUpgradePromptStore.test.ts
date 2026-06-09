import { useUpgradePromptStore } from '@/state/useUpgradePromptStore';
import { fetchUserPromptState, upsertUserPromptState } from '@/supabase/queries';

jest.mock('@/supabase/queries', () => ({
  fetchUserPromptState: jest.fn(),
  upsertUserPromptState: jest.fn(),
}));

const mockedFetchUserPromptState = fetchUserPromptState as jest.MockedFunction<typeof fetchUserPromptState>;
const mockedUpsertUserPromptState = upsertUserPromptState as jest.MockedFunction<typeof upsertUserPromptState>;

describe('useUpgradePromptStore', () => {
  beforeEach(() => {
    useUpgradePromptStore.setState({
      visible: false,
      reason: null,
      shownThisSession: false,
    });
    mockedFetchUserPromptState.mockReset();
    mockedUpsertUserPromptState.mockReset();
    mockedUpsertUserPromptState.mockResolvedValue({
      user_id: 'u1',
      last_upgrade_prompt_at: new Date().toISOString(),
      upgrade_prompt_dismiss_count: 0,
      upgrade_prompt_last_reason: 'vocab_10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('does not show prompt for non-guests', async () => {
    const shown = await useUpgradePromptStore.getState().requestShow('u1', 'vocab_10', { isGuest: false });

    expect(shown).toBe(false);
    expect(mockedFetchUserPromptState).not.toHaveBeenCalled();
  });

  it('shows prompt when eligible and persists prompt state', async () => {
    mockedFetchUserPromptState.mockResolvedValue(null);

    const shown = await useUpgradePromptStore.getState().requestShow('u1', 'vocab_10', { isGuest: true });

    expect(shown).toBe(true);
    expect(useUpgradePromptStore.getState().visible).toBe(true);
    expect(useUpgradePromptStore.getState().reason).toBe('vocab_10');
    expect(useUpgradePromptStore.getState().shownThisSession).toBe(true);
    expect(mockedUpsertUserPromptState).toHaveBeenCalledTimes(1);
  });

  it('blocks prompt within cooldown window', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockedFetchUserPromptState.mockResolvedValue({
      user_id: 'u1',
      last_upgrade_prompt_at: oneDayAgo,
      upgrade_prompt_dismiss_count: 0,
      upgrade_prompt_last_reason: null,
      created_at: oneDayAgo,
      updated_at: oneDayAgo,
    });

    const shown = await useUpgradePromptStore.getState().requestShow('u1', 'vocab_10', { isGuest: true });

    expect(shown).toBe(false);
    expect(mockedUpsertUserPromptState).not.toHaveBeenCalled();
  });

  it('dismiss increments dismiss count and closes prompt', async () => {
    useUpgradePromptStore.setState({ visible: true, reason: 'read_sessions' });
    mockedFetchUserPromptState.mockResolvedValue({
      user_id: 'u1',
      last_upgrade_prompt_at: null,
      upgrade_prompt_dismiss_count: 2,
      upgrade_prompt_last_reason: 'read_sessions',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await useUpgradePromptStore.getState().dismiss('u1');

    expect(mockedUpsertUserPromptState).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        upgrade_prompt_dismiss_count: 3,
        upgrade_prompt_last_reason: 'read_sessions',
      })
    );
    expect(useUpgradePromptStore.getState().visible).toBe(false);
    expect(useUpgradePromptStore.getState().reason).toBeNull();
  });
});
