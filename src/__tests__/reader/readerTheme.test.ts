import { READER_THEME } from '@/reader/readerTheme';

describe('READER_THEME', () => {
  it('has a body key with background and overflow', () => {
    expect(READER_THEME.body).toBeDefined();
    expect(READER_THEME.body.background).toBeTruthy();
    expect(READER_THEME.body.overflow).toBe('hidden');
  });
});
