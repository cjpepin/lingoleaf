import type { StudyWord } from '@/supabase/types';

function escapeCsvField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildStudyWordsCsv(words: StudyWord[], bookTitleById: Record<string, string> = {}): string {
  const header = 'word,translation,example_sentence,book_title,date';
  const rows = words.map((word) => [
    escapeCsvField(word.term),
    escapeCsvField(word.translation),
    escapeCsvField(word.context_snippet ?? ''),
    escapeCsvField(bookTitleById[word.book_id ?? ''] ?? word.book_id ?? ''),
    escapeCsvField((word.created_at ?? '').slice(0, 10)),
  ].join(','));

  return [header, ...rows].join('\n');
}

export function buildStudyWordsAnkiTsv(words: StudyWord[], bookTitleById: Record<string, string> = {}): string {
  const rows = words.map((word) => [
    `${word.term}`.replace(/\t|\n/g, ' ').trim(),
    `${word.translation}${word.context_snippet ? `\n${word.context_snippet}` : ''}`.replace(/\t/g, ' ').trim(),
    `lingoleaf ${word.target_lang ?? ''} ${(bookTitleById[word.book_id ?? ''] ?? word.book_id ?? '').replace(/\s+/g, '_')}`.trim(),
  ].join('\t'));

  return rows.join('\n');
}

export function getStudyExportPath(cacheDirectory: string | null): string {
  if (!cacheDirectory) {
    throw new Error('cache_directory_unavailable');
  }
  return `${cacheDirectory}lingoleaf_vocab_export.csv`;
}
