const mockInvoke = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

jest.mock('@/analytics/client', () => ({
  track: jest.fn(),
}));

describe('generateStudyPackMetadata', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns metadata when the edge function succeeds', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        title: 'Travel phrases',
        coachLine: 'Mostly review today.',
        groups: ['Travel'],
        source: 'ai',
      },
      error: null,
    });

    const { generateStudyPackMetadata } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    const result = await generateStudyPackMetadata({
      words: [
        {
          term: 'hola',
          translation: 'hello',
          context_snippet: null,
          source_lang: 'es',
          target_lang: 'en',
        },
      ],
      review_count: 1,
      new_count: 0,
    });

    expect(result).toEqual({
      title: 'Travel phrases',
      coachLine: 'Mostly review today.',
      groups: ['Travel'],
      source: 'ai',
    });
    expect(mockInvoke).toHaveBeenCalledWith('study-pack-metadata', {
      body: expect.objectContaining({
        review_count: 1,
        new_count: 0,
      }),
    });
  });

  it('throws without extra logger noise when the edge function returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    const { generateStudyPackMetadata } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    await expect(
      generateStudyPackMetadata({
        words: [
          {
            term: 'hola',
            translation: 'hello',
            context_snippet: null,
            source_lang: 'es',
            target_lang: 'en',
          },
        ],
        review_count: 1,
        new_count: 0,
      }),
    ).rejects.toThrow('Study pack metadata failed: Edge Function returned a non-2xx status code');

    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('passes through fallback warnings from the edge function response', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        title: "Today's Focus Pack",
        coachLine: '7 review cards, 3 new cards.',
        groups: [],
        source: 'fallback',
        fallbackReason: 'missing_openai_api_key',
      },
      error: null,
    });

    const { generateStudyPackMetadata } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    const result = await generateStudyPackMetadata({
      words: [
        {
          term: 'hola',
          translation: 'hello',
          context_snippet: null,
          source_lang: 'es',
          target_lang: 'en',
        },
      ],
      review_count: 7,
      new_count: 3,
    });

    expect(result).toEqual({
      title: "Today's Focus Pack",
      coachLine: '7 review cards, 3 new cards.',
      groups: [],
      source: 'fallback',
      fallbackReason: 'missing_openai_api_key',
    });
  });
});
