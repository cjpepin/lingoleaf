-- LingoLeaf demo seed data (generated from fixtures/demo-seed/lingoleaf.json)
-- Run after migrations and demo auth users exist.

INSERT INTO lingoleaf.books (id, title, author, storage_path, source_lang, epub_url, is_general, description, subjects_text)
VALUES
  ('11111111-1111-4111-8111-111111111101'::uuid, 'Don Quijote', 'Cervantes Saavedra, Miguel de', null, 'es', 'https://www.gutenberg.org/ebooks/2000.epub3.images', true, '"Don Quijote" by Miguel de Cervantes Saavedra is a Spanish novel published in two parts in 1605 and 1615. A minor nobleman reads so many chivalric romances that he loses his sanity and decides to become a knight-errant.', 'Knights and knighthood -- Spain -- Fiction, Picaresque literature, Romances, Historical fiction, Adventure stories, Knights and knighthood -- Fiction, Spain -- Social life and customs -- 16th century -- Fiction, Spain -- Fiction, Cervantes Saavedra, Miguel de, 1547-1616 -- Translations into English'),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'Les misérables Tome I: Fantine', 'Hugo, Victor', null, 'fr', 'https://www.gutenberg.org/ebooks/17489.epub3.images', true, '"Les misérables Tome I: Fantine" by Victor Hugo is a French epic historical novel first published in 1862. Set between 1815 and the 1832 June Rebellion in Paris, it follows ex-convict Jean Valjean''s struggle for redemption.', 'Epic literature, Ex-convicts -- Fiction, Historical fiction, Orphans -- Fiction, Paris (France) -- Fiction'),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'Pride and Prejudice', 'Austen, Jane', null, 'en', 'https://www.gutenberg.org/ebooks/1342.epub3.images', true, '"Pride and Prejudice" by Jane Austen is a novel published in 1813. It follows Elizabeth Bennet, who must learn to see past first impressions and hasty judgments.', 'Courtship -- Fiction, Domestic fiction, England -- Fiction, Love stories, Sisters -- Fiction, Young women -- Fiction, England -- Social life and customs -- 19th century -- Fiction')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, storage_path = EXCLUDED.storage_path, source_lang = EXCLUDED.source_lang, epub_url = EXCLUDED.epub_url, is_general = EXCLUDED.is_general, description = EXCLUDED.description, subjects_text = EXCLUDED.subjects_text;

INSERT INTO lingoleaf.translation_cache (source_lang, target_lang, term_normalized, translation)
VALUES
  ('es', 'en', 'hola', 'hello'),
  ('es', 'en', 'mundo', 'world'),
  ('es', 'en', 'caballero', 'knight'),
  ('es', 'en', 'ventura', 'adventure'),
  ('fr', 'en', 'bonjour', 'hello'),
  ('fr', 'en', 'misérable', 'wretched'),
  ('fr', 'en', 'grâce', 'grace'),
  ('en', 'es', 'hello', 'hola')
ON CONFLICT (source_lang, target_lang, term_normalized) DO NOTHING;

INSERT INTO lingoleaf.vocab_lists (id, user_id, name, created_at, updated_at, last_used_at)
VALUES
  ('22222222-2222-4222-8222-222222222201'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'Spanish verbs', '2025-05-15T10:00:00.000Z', '2025-06-08T14:00:00.000Z', '2025-06-08T14:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222202'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'French greetings', '2025-05-20T09:00:00.000Z', '2025-06-05T11:00:00.000Z', '2025-06-05T11:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, last_used_at = EXCLUDED.last_used_at;

INSERT INTO lingoleaf.user_books (user_id, book_id, last_cfi, highlights, last_read_at, status, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'epubcfi(/6/4!/4/2/1:0)', '[{"id":"hl-dq-1","cfi_range":"demo-cfi-dq-1","selected_text":"hola","created_at":"2025-06-01T12:00:00.000Z","color":"#B8E6C8","translation":"hello"},{"id":"hl-dq-2","cfi_range":"demo-cfi-dq-2","selected_text":"caballero andante","created_at":"2025-06-03T09:15:00.000Z","color":"#FFD6A5","translation":"knight-errant"},{"id":"hl-dq-3","cfi_range":"demo-cfi-dq-3","selected_text":"ventura","created_at":"2025-06-07T20:00:00.000Z","color":"#B8E6C8","translation":"adventure"}]'::jsonb, '2025-06-09T18:30:00.000Z', 'reading', '2025-05-01T12:00:00.000Z', '2025-06-09T18:30:00.000Z'),
  ('00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, null, '[{"id":"hl-lm-1","cfi_range":"demo-cfi-lm-1","selected_text":"misérable","created_at":"2025-05-12T16:00:00.000Z","color":"#C9B8E6","translation":"wretched"},{"id":"hl-lm-2","cfi_range":"demo-cfi-lm-2","selected_text":"grâce","created_at":"2025-05-20T19:30:00.000Z","color":"#B8E6C8","translation":"grace"}]'::jsonb, '2025-05-28T22:00:00.000Z', 'completed', '2025-04-10T08:00:00.000Z', '2025-05-28T22:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, null, '[{"id":"hl-pp-1","cfi_range":"demo-cfi-pp-1","selected_text":"fine eyes","created_at":"2025-06-02T07:05:00.000Z","color":"#FFD6A5","translation":null}]'::jsonb, '2025-06-02T07:00:00.000Z', 'saved_for_later', '2025-06-02T07:00:00.000Z', '2025-06-02T07:00:00.000Z')
ON CONFLICT (user_id, book_id) DO UPDATE SET last_cfi = EXCLUDED.last_cfi, highlights = EXCLUDED.highlights, last_read_at = EXCLUDED.last_read_at, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

INSERT INTO lingoleaf.study_words (id, user_id, book_id, list_id, source_lang, target_lang, term, term_normalized, translation, context_snippet, starred, created_at)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, '22222222-2222-4222-8222-222222222201'::uuid, 'es', 'en', 'hola', 'hola', 'hello', 'En un lugar de la Mancha...', true, '2025-06-01T12:05:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, '22222222-2222-4222-8222-222222222201'::uuid, 'es', 'en', 'caballero', 'caballero', 'knight', 'caballero andante', false, '2025-06-03T09:20:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, '22222222-2222-4222-8222-222222222201'::uuid, 'es', 'en', 'ventura', 'ventura', 'adventure', 'buscando venturas', false, '2025-06-07T20:05:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, null, 'es', 'en', 'mundo', 'mundo', 'world', 'el mejor escudero del mundo', false, '2025-06-04T11:00:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0005'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'fr', 'en', 'bonjour', 'bonjour', 'hello', 'Bonjour, monsieur.', true, '2025-05-10T14:00:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0006'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'fr', 'en', 'misérable', 'misérable', 'wretched', 'les misérables de Paris', false, '2025-05-12T16:05:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0007'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'fr', 'en', 'grâce', 'grâce', 'grace', 'par la grâce de Dieu', false, '2025-05-20T19:35:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0008'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111102'::uuid, null, 'fr', 'en', 'liberté', 'liberté', 'freedom', 'liberté, égalité, fraternité', false, '2025-05-18T10:00:00.000Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0009'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111103'::uuid, null, 'en', 'es', 'prejudice', 'prejudice', 'prejuicio', 'Pride and Prejudice', false, '2025-06-02T07:10:00.000Z')
ON CONFLICT (id) DO UPDATE SET list_id = EXCLUDED.list_id, translation = EXCLUDED.translation, context_snippet = EXCLUDED.context_snippet, starred = EXCLUDED.starred;

INSERT INTO lingoleaf.study_word_reviews (study_word_id, next_review_at, interval_minutes, last_rating, review_count)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001'::uuid, '2025-06-10T12:00:00.000Z', 1440, 'good', 3),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0005'::uuid, '2025-06-11T09:00:00.000Z', 2880, 'easy', 5)
ON CONFLICT (study_word_id) DO UPDATE SET next_review_at = EXCLUDED.next_review_at, interval_minutes = EXCLUDED.interval_minutes, last_rating = EXCLUDED.last_rating, review_count = EXCLUDED.review_count;

-- reading_sessions: 046+ uses duration_seconds; older migrations used minutes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lingoleaf'
      AND table_name = 'reading_sessions'
      AND column_name = 'duration_seconds'
  ) THEN
    INSERT INTO lingoleaf.reading_sessions (id, user_id, started_at, ended_at, duration_seconds, book_id)
    VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-09T18:00:00.000Z', '2025-06-09T18:30:00.000Z', 1800, '11111111-1111-4111-8111-111111111101'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-08T07:15:00.000Z', '2025-06-08T07:40:00.000Z', 1500, '11111111-1111-4111-8111-111111111101'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-07T20:00:00.000Z', '2025-06-07T20:45:00.000Z', 2700, '11111111-1111-4111-8111-111111111101'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-05T21:00:00.000Z', '2025-06-05T21:20:00.000Z', 1200, '11111111-1111-4111-8111-111111111102'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-03T09:00:00.000Z', '2025-06-03T09:25:00.000Z', 1500, '11111111-1111-4111-8111-111111111101'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0006'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-05-28T21:30:00.000Z', '2025-05-28T22:00:00.000Z', 1800, '11111111-1111-4111-8111-111111111102'::uuid),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0007'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-05-27T06:30:00.000Z', '2025-05-27T07:00:00.000Z', 1800, '11111111-1111-4111-8111-111111111101'::uuid)
    ON CONFLICT (id) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lingoleaf'
      AND table_name = 'reading_sessions'
      AND column_name = 'minutes'
  ) THEN
    INSERT INTO lingoleaf.reading_sessions (id, user_id, started_at, ended_at, minutes, book_id)
    VALUES
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-09T18:00:00.000Z', '2025-06-09T18:30:00.000Z', 30, '11111111-1111-4111-8111-111111111101'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-08T07:15:00.000Z', '2025-06-08T07:40:00.000Z', 25, '11111111-1111-4111-8111-111111111101'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-07T20:00:00.000Z', '2025-06-07T20:45:00.000Z', 45, '11111111-1111-4111-8111-111111111101'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-05T21:00:00.000Z', '2025-06-05T21:20:00.000Z', 20, '11111111-1111-4111-8111-111111111102'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-06-03T09:00:00.000Z', '2025-06-03T09:25:00.000Z', 25, '11111111-1111-4111-8111-111111111101'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0006'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-05-28T21:30:00.000Z', '2025-05-28T22:00:00.000Z', 30, '11111111-1111-4111-8111-111111111102'::uuid),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0007'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '2025-05-27T06:30:00.000Z', '2025-05-27T07:00:00.000Z', 30, '11111111-1111-4111-8111-111111111101'::uuid)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

