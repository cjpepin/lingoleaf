/**
 * readerTheme
 *
 * Static theme object for the epubjs reader.
 * Minimal overflow prevention - avoids layout-affecting rules that break epub.js pagination.
 */

import { colors } from '@/theme';

export const READER_THEME = {
  body: {
    background: colors.background,
    overflow: 'hidden',
  },
};


