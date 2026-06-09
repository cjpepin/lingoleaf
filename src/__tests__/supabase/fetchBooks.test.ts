const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

function createBooksQueryChain(data: unknown[] = []) {
  const chain = {
    data,
    error: null,
    select: jest.fn(),
    or: jest.fn(),
    ilike: jest.fn(),
    in: jest.fn(),
    eq: jest.fn(),
    overlaps: jest.fn(),
    lte: jest.fn(),
    lt: jest.fn(),
    gte: jest.fn(),
    gt: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.ilike.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.overlaps.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.gt.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.range.mockReturnValue(chain);

  return chain;
}

describe('fetchBooks query builder', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('applies combined filters and cursor pagination', async () => {
    const chain = createBooksQueryChain([{ id: 'b1' }]);
    mockFrom.mockReturnValue(chain);

    const { fetchBooks } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    const result = await fetchBooks({
      search: 'don',
      language: 'es',
      languages: ['es', 'fr'],
      subjects: ['classic'],
      source: 'gutendex',
      difficulty: 'Easy',
      shortWins: true,
      tags: ['fiction'],
      limit: 25,
      cursor: 50,
    });

    expect(mockFrom).toHaveBeenCalledWith('books');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.or).toHaveBeenCalledWith('title.ilike.%don%,author.ilike.%don%');
    expect(chain.in).toHaveBeenCalledWith('source_lang', ['es', 'fr']);
    expect(chain.overlaps).toHaveBeenCalledWith('subjects', ['classic']);
    expect(chain.eq).toHaveBeenCalledWith('source', 'gutendex');
    expect(chain.eq).toHaveBeenCalledWith('difficulty', 'Easy');
    expect(chain.lte).toHaveBeenCalledWith('word_count', 35000);
    expect(chain.overlaps).toHaveBeenCalledWith('tags', ['fiction']);
    expect(chain.range).toHaveBeenCalledWith(50, 74);

    const sourceLangEqCalls = chain.eq.mock.calls.filter((c: unknown[]) => c[0] === 'source_lang');
    expect(sourceLangEqCalls).toHaveLength(0);

    expect(result).toEqual([{ id: 'b1' }]);
  });

  it('applies start_easy shelf ordering and medium length bucket', async () => {
    const chain = createBooksQueryChain([]);
    mockFrom.mockReturnValue(chain);

    const { fetchBooks } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    await fetchBooks({
      shelfType: 'start_easy',
      lengthBucket: 'medium',
    });

    expect(chain.gte).toHaveBeenCalledWith('word_count', 35000);
    expect(chain.lte).toHaveBeenCalledWith('word_count', 80000);
    expect(chain.in).toHaveBeenCalledWith('difficulty', ['Easy']);
    expect(chain.in).toHaveBeenCalledWith('estimated_cefr', ['A1', 'A2', 'B1']);
    expect(chain.order).toHaveBeenCalledWith('lexical_score', { ascending: true, nullsFirst: false });
    expect(chain.order).toHaveBeenCalledWith('word_count', { ascending: true, nullsFirst: false });
  });

  it('uses offset pagination when cursor is not provided', async () => {
    const chain = createBooksQueryChain([]);
    mockFrom.mockReturnValue(chain);

    const { fetchBooks } = require('@/supabase/queries') as typeof import('@/supabase/queries');

    await fetchBooks({ limit: 10, offset: 30 });

    expect(chain.range).toHaveBeenCalledWith(30, 39);
  });
});

describe('fetchAvailableTags', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns [] and logs warn when rpc fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    const { fetchAvailableTags } = require('@/supabase/queries') as typeof import('@/supabase/queries');
    const tags = await fetchAvailableTags('es');

    expect(mockRpc).toHaveBeenCalledWith('get_distinct_book_tags', { p_lang: 'es' });
    expect(tags).toEqual([]);
    expect(mockLoggerWarn).toHaveBeenCalledWith('Failed to fetch book tags', expect.any(Error));
  });

  it('maps rpc rows to a flat tag list', async () => {
    mockRpc.mockResolvedValue({
      data: [{ tag: 'fiction' }, { tag: 'history' }, { tag: '' }, { x: 'ignore' }],
      error: null,
    });

    const { fetchAvailableTags } = require('@/supabase/queries') as typeof import('@/supabase/queries');
    const tags = await fetchAvailableTags();

    expect(mockRpc).toHaveBeenCalledWith('get_distinct_book_tags', { p_lang: null });
    expect(tags).toEqual(['fiction', 'history']);
  });
});

describe('fetchHistoryBooks', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('sorts rows by latest read date and maps status', async () => {
    const chain = createBooksQueryChain([
      {
        id: 'b2',
        title: 'Second',
        user_books: [{ last_read_at: '2026-03-01T00:00:00.000Z', status: 'saved_for_later' }],
      },
      {
        id: 'b1',
        title: 'First',
        user_books: [{ last_read_at: '2026-03-02T00:00:00.000Z', status: 'reading' }],
      },
      {
        id: 'b3',
        title: 'Third',
        user_books: [{ last_read_at: null, status: null }],
      },
    ]);
    mockFrom.mockReturnValue(chain);

    const { fetchHistoryBooks } = require('@/supabase/queries') as typeof import('@/supabase/queries');
    const rows = await fetchHistoryBooks('user-1');

    expect(mockFrom).toHaveBeenCalledWith('books');
    expect(chain.eq).toHaveBeenCalledWith('user_books.user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('last_read_at', { foreignTable: 'user_books', ascending: false });
    expect(rows.map((r: { id: string }) => r.id)).toEqual(['b1', 'b2', 'b3']);
    expect(rows[0].status).toBe('reading');
    expect(rows[1].status).toBe('saved_for_later');
    expect(rows[2].status).toBe('reading');
    expect((rows[0] as unknown as { user_books?: unknown }).user_books).toBeUndefined();
  });
});
