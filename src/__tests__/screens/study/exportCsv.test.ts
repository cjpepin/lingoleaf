import { buildStudyWordsAnkiTsv, buildStudyWordsCsv, getStudyExportPath } from '@/screens/study/exportCsv';
import type { StudyWord } from '@/supabase/types';

function makeWord(overrides: Partial<StudyWord> = {}): StudyWord {
  return {
    id: 'w1',
    user_id: 'u1',
    book_id: 'b1',
    list_id: null,
    source_lang: 'en',
    target_lang: 'es',
    term: 'hello',
    term_normalized: 'hello',
    translation: 'hola',
    context_snippet: null,
    created_at: '2026-03-01T00:00:00.000Z',
    starred: false,
    ...overrides,
  };
}

describe('study CSV export helpers', () => {
  it('builds CSV with header and rows', () => {
    const csv = buildStudyWordsCsv([
      makeWord({ term: 'hello', translation: 'hola' }),
      makeWord({ id: 'w2', term: 'bye', translation: 'adios' }),
    ], { b1: 'Book One' });

    const lines = csv.split('\n');
    expect(lines[0]).toBe('word,translation,example_sentence,book_title,date');
    expect(lines[1]).toContain('"hello"');
    expect(lines[1]).toContain('"hola"');
    expect(lines[1]).toContain('"Book One"');
    expect(lines[2]).toContain('"bye"');
    expect(lines[2]).toContain('"adios"');
  });

  it('escapes quotes for valid CSV', () => {
    const csv = buildStudyWordsCsv([
      makeWord({ term: 'he"llo', translation: 'ho"la' }),
    ]);

    expect(csv).toContain('"he""llo"');
    expect(csv).toContain('"ho""la"');
  });

  it('creates deterministic export path', () => {
    expect(getStudyExportPath('file:///tmp/')).toBe('file:///tmp/lingoleaf_vocab_export.csv');
  });

  it('builds Anki TSV with front, back, tags', () => {
    const tsv = buildStudyWordsAnkiTsv([
      makeWord({ term: 'hello', translation: 'hola', context_snippet: 'hello world' }),
    ], { b1: 'Book One' });

    expect(tsv).toContain('hello');
    expect(tsv).toContain('hola');
    expect(tsv).toContain('lingoleaf');
    expect(tsv).toContain('Book_One');
  });

  it('throws when cache directory is unavailable', () => {
    expect(() => getStudyExportPath(null)).toThrow('cache_directory_unavailable');
  });
});
