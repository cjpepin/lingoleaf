import { validatePayloadDev } from '@/analytics/events';
import { redactRouteParams, sanitizeProperties } from '@/analytics/privacy';

describe('analytics payload validation', () => {
  it('accepts valid payload', () => {
    expect(() => {
      validatePayloadDev('search_performed', {
        query_length: 12,
        source: 'library_search',
      });
    }).not.toThrow();
  });

  it('rejects invalid payload shape', () => {
    expect(() => {
      validatePayloadDev('search_performed', {
        // @ts-expect-error test invalid runtime payload
        query_length: '12',
      });
    }).toThrow();
  });

  it('accepts paywall payload with selected plan', () => {
    expect(() => {
      validatePayloadDev('paywall_viewed', {
        source: 'settings',
        placement: 'settings_upgrade_button',
        plan_selected: 'yearly',
      });
    }).not.toThrow();
  });

  it('accepts my-books analytics payloads', () => {
    expect(() => {
      validatePayloadDev('books_tab_viewed', {
        tab: 'saved',
        source: 'my_books_screen',
      });
      validatePayloadDev('books_default_decided', {
        has_history: true,
        default_tab: 'history',
      });
      validatePayloadDev('library_search', {
        query_len: 4,
        has_filters: true,
        language: 'es',
      });
      validatePayloadDev('library_filter_opened', {});
      validatePayloadDev('library_filter_applied', {
        tags_count: 2,
        short_wins: true,
      });
      validatePayloadDev('garden_viewed', {
        placement: 'my_progress_screen',
        stage: 'sprout',
        streak_days: 3,
      });
      validatePayloadDev('garden_progressed', {
        delta_gp: 8,
        source: 'reading',
        minutes_done_today: 10,
        goal_minutes: 10,
      });
      validatePayloadDev('garden_streak_changed', {
        old_streak: 2,
        new_streak: 3,
        reason: 'goal_completed',
      });
      validatePayloadDev('study_pack_created', {
        pack_id: 'focus_hash',
        target_count: 10,
        review_count: 7,
        new_count: 3,
      });
      validatePayloadDev('study_pack_completed', {
        pack_id: 'focus_hash',
        answered_count: 10,
        review_count: 7,
        new_count: 3,
      });
    }).not.toThrow();
  });
});

describe('analytics privacy helpers', () => {
  it('strips disallowed keys', () => {
    const sanitized = sanitizeProperties({
      source: 'reader',
      selected_text: 'secret',
      nested: {
        email: 'test@example.com',
        okay: true,
      },
    }) as Record<string, unknown>;

    expect(sanitized.selected_text).toBeUndefined();
    expect((sanitized.nested as Record<string, unknown>).email).toBeUndefined();
    expect((sanitized.nested as Record<string, unknown>).okay).toBe(true);
  });

  it('redacts route params', () => {
    const redacted = redactRouteParams({
      bookId: 'book-123',
      localPath: '/private/path/to/file.epub',
      listName: 'My List',
      page: 3,
    });

    expect(redacted.bookId_hash).toBeDefined();
    expect(redacted.localPath).toBeUndefined();
    expect(redacted.listName_length).toBe(7);
    expect(redacted.page).toBe(3);
  });
});
