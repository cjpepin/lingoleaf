import { logger } from '@/utils/logger';

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls console.debug for debug level', () => {
    logger.debug('test message');
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG]'),
      'test message'
    );
  });

  it('calls console.info for info level', () => {
    logger.info('info msg', { extra: true });
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
      'info msg',
      { extra: true }
    );
  });

  it('calls console.warn for warn level', () => {
    logger.warn('warn msg');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      'warn msg'
    );
  });

  it('calls console.error for error level', () => {
    logger.error('err msg');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR]'),
      'err msg'
    );
  });

  it('includes a timestamp prefix', () => {
    logger.info('ts check');
    const call = (console.info as jest.Mock).mock.calls[0][0];
    expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
  });
});
