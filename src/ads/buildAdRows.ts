/**
 * buildAdRows
 *
 * Converts a flat list of books into renderable rows:
 * - row of N book items (e.g. 3 columns)
 * - ad row inserted every K book rows (e.g. every 4 rows)
 */

import type { Book } from '@/supabase/types';

export type LibraryRow<B = Book> =
  | { type: 'books'; key: string; items: B[] }
  | { type: 'ad'; key: string };

export function buildAdRows<B extends Book>(books: B[], opts: { columns: number; adEveryRows: number }): LibraryRow<B>[] {
  const columns = Math.max(1, Math.floor(opts.columns));
  const adEveryRows = Math.max(1, Math.floor(opts.adEveryRows));

  const bookRows: LibraryRow<B>[] = [];
  for (let i = 0; i < books.length; i += columns) {
    const chunk = books.slice(i, i + columns);
    const firstId = chunk[0]?.id ?? String(i);
    bookRows.push({ type: 'books', key: `books-${i}-${firstId}`, items: chunk });
  }

  const out: LibraryRow<B>[] = [];
  let rowCount = 0;
  let adCount = 0;
  for (const r of bookRows) {
    out.push(r);
    rowCount += 1;
    if (rowCount % adEveryRows === 0) {
      out.push({ type: 'ad', key: `ad-${rowCount}-${adCount}` });
      adCount += 1;
    }
  }
  return out;
}


