# LinguaLeaf MVP Build Plan (Expo + Supabase + EPUB Reader + Translation)
_Last updated: 2025-12-26_

This doc is optimized as **Cursor context**: clear decisions, file structure, concrete steps, and acceptance criteria.
It describes how to build an MVP iOS-first React Native (Expo) app that lets users:
- Browse a **pre-uploaded EPUB library** stored in **Supabase Storage**
- Open an EPUB in a reader
- Select text → **Highlight / Translate / Save to Study Words**
- Review saved words in a Study list
- Translation is **server-side** via **Supabase Edge Function** with **aggressive caching** to reduce cost

---

## 0) Key decisions (locked)
**Client**
- Expo (managed)
- React Navigation
- Theming: simple “leaf green” token set
- Reader: `@epubjs-react-native/core` (WebView-based rendering, **RN-first API**, no giant multiline HTML strings)
  - Use `@epubjs-react-native/expo-file-system` for Expo integration

**Backend**
- Supabase Auth (email OTP/magic link is fine for MVP)
- Supabase Storage hosts a pre-uploaded library of EPUBs (`books` bucket)
- DB tables: `books`, `highlights`, `study_words`, `translation_cache`
- RLS on user data tables
- Translation: Supabase Edge Function `translate`:
  - Normalize selection → lookup in `translation_cache` → if miss call translation provider → store cache → return translation

**Highlight anchoring**
- Store EPUB CFI range (`cfi_range`) for highlights/selection. Use it to restore highlights on reopen.

**Cost-first translation**
- Cache by `(source_lang, target_lang, term_normalized)`.

---

## 1) MVP scope & acceptance criteria
### MVP features
1. **Library**
   - Shows list of available books (pre-uploaded, from DB `books`)
   - Tap a book → downloads/caches EPUB from Supabase Storage → opens Reader

2. **Reader**
   - Opens an EPUB
   - User selects text
   - Shows a small action UI: **Highlight**, **Translate**, **Save**
   - Highlights persist (restored on reopen)
   - Translation is server-side and returned quickly (from cache ideally)
   - “Save” stores term + translation into Study Words

3. **Study Words**
   - List of saved words with translation and context snippet
   - Filter by book and/or language (optional MVP, recommended)
   - Remove a word (recommended)

4. **Settings**
   - Target language selection (e.g. `en`, `es`, etc.)
   - Store per-user preference

### Out of scope (explicitly not MVP)
- SRS scheduling (Anki-like), quizzes
- Lemmatization / morphological normalization beyond lowercase+trim
- Offline translation
- Collaborative notes
- Full-text search across books
- Readium migration

### Definition of Done
- A new user can sign in, open a pre-uploaded EPUB, highlight text, translate it, save it, and see it in their Study list across app restarts.

---

## 2) Architecture overview
### Data flow: Open → Select → Translate → Save
1. Library lists books from DB.
2. On open, client requests a **signed URL** for EPUB (if bucket is private).
3. Client downloads EPUB to device cache; reuses cached file.
4. Reader loads local file path.
5. On selection, Reader provides:
   - `cfiRange`
   - `selectedText`
   - optional: `contextSnippet`
6. “Highlight”:
   - Add highlight annotation in reader
   - Persist to `highlights` table
7. “Translate”:
   - Invoke Edge Function `translate`
   - Show translation in bottom sheet
8. “Save”:
   - Write to `study_words` table
   - (Optional) auto-highlight if not highlighted yet

### Why this reader choice
- Avoids hand-writing a massive injected HTML string.
- Provides React Native interface (props + hooks) while still using proven EPUB.js engine.

---

## 3) Recommended project structure (Expo)
```
/src
  /app
    App.tsx
  /navigation
    index.tsx
    types.ts
  /screens
    LibraryScreen.tsx
    ReaderScreen.tsx
    StudyScreen.tsx
    SettingsScreen.tsx
  /components
    BookListItem.tsx
    LeafButton.tsx
    SelectionToolbar.tsx
    TranslateSheet.tsx
    EmptyState.tsx
  /reader
    ReaderView.tsx
    readerTheme.ts
    selection.ts
  /supabase
    client.ts
    queries.ts
    storage.ts
    rlsNotes.md
  /state
    useSettingsStore.ts (zustand or context)
  /theme
    colors.ts
    spacing.ts
    typography.ts
  /utils
    cache.ts
    language.ts
    normalize.ts
```

---

## 4) Supabase: Storage + DB + RLS

### 4.1 Storage
- Bucket: `books`
  - Contains `.epub` files
  - Recommended path pattern: `public_library/{bookId}.epub` (or `{slug}.epub`)
- Optional: bucket `covers`
  - `covers/{bookId}.jpg`

**Access**
- If the library is public: storage objects can be public.
- If you want controlled access: keep bucket private + use signed URLs.

**MVP default**: private bucket + signed URL for downloading.

---

### 4.2 Database tables (MVP)
#### `books`
Stores library metadata and storage path.
- `id` (uuid pk)
- `title` (text)
- `author` (text, nullable)
- `storage_path` (text) e.g. `public_library/<id>.epub`
- `cover_path` (text, nullable)
- `source_lang` (text, nullable, e.g. `es`)
- `created_at` (timestamptz default now)

Notes:
- `books` can be readable by all authenticated users (or public).
- Editing is admin-only.

#### `highlights`
Anchored to EPUB CFI range.
- `id` (uuid pk)
- `user_id` (uuid references auth.users)
- `book_id` (uuid references books)
- `cfi_range` (text) ✅ used to restore highlights
- `selected_text` (text)
- `context_snippet` (text, nullable)
- `color` (text, nullable; default mint)
- `created_at` (timestamptz default now)

Indexes:
- `(user_id, book_id)`
- Unique optional: `(user_id, book_id, cfi_range)` to prevent duplicates

#### `study_words`
Saved study items per user.
- `id` (uuid pk)
- `user_id` (uuid)
- `book_id` (uuid)
- `source_lang` (text)
- `target_lang` (text)
- `term` (text)  // exact selection
- `term_normalized` (text) // lowercase trimmed
- `translation` (text)
- `context_snippet` (text, nullable)
- `created_at` (timestamptz default now)

Indexes:
- `(user_id, created_at desc)`
- `(user_id, book_id)`
- Unique optional: `(user_id, book_id, source_lang, target_lang, term_normalized)` to avoid duplicates

#### `translation_cache`
Shared cache.
- `source_lang` (text)
- `target_lang` (text)
- `term_normalized` (text)
- `translation` (text)
- `created_at` (timestamptz default now)

Indexes:
- Unique: `(source_lang, target_lang, term_normalized)`

---

### 4.3 RLS policies (high-level)
Enable RLS on `highlights`, `study_words`.
Policies:
- SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`.

`books`:
- SELECT allowed for authenticated users (or public).
- INSERT/UPDATE/DELETE admin-only (service role).

`translation_cache`:
- If you want to allow Edge Function to manage: keep RLS on and allow only service role.
- Edge Function uses service role key (server-only) to read/write.

---

## 5) Translation Edge Function (cost-first)
### 5.1 Function contract
Name: `translate`
Input JSON:
```json
{
  "source_lang": "es",
  "target_lang": "en",
  "text": "asombroso"
}
```

Output JSON:
```json
{
  "term": "asombroso",
  "term_normalized": "asombroso",
  "translation": "amazing",
  "from_cache": true
}
```

### 5.2 Behavior
1. Validate languages
2. Normalize:
   - `term = text.trim()`
   - `term_normalized = term.toLowerCase()`
   - Optionally strip punctuation for cache key (MVP optional)
3. Query `translation_cache` by `(source_lang, target_lang, term_normalized)`
4. If hit → return cached translation
5. If miss → call translation provider
6. Insert into `translation_cache`
7. Return response

### 5.3 Cost controls
- Cache aggressively
- Rate-limit per user/ip (optional)
- Limit max input length (e.g. <= 40 chars for MVP)

---

## 6) Client implementation plan (step-by-step)
### Milestone 1 — Skeleton + auth
- Create Expo app
- Add navigation
- Add Supabase client + auth screen
- Store session in state

**Done when**
- User can sign in and reach Library screen.

---

### Milestone 2 — Library from DB + download/cache EPUB
**LibraryScreen**
- Query `books` from Supabase
- Render list

**On tap book**
- Get signed URL if private storage
- Download to cache directory (e.g. `${FileSystem.cacheDirectory}/books/<bookId>.epub`)
- If file exists, reuse
- Navigate to Reader screen with local filepath

**Done when**
- You can open Reader screen with a local EPUB path (even if reader not yet working).

---

### Milestone 3 — Reader open + selection callback
**ReaderScreen**
- Render `<Reader />` with `src` pointing to local file path
- Enable text selection
- On selection:
  - collect `cfiRange`
  - read selected text
  - show `SelectionToolbar` (RN UI)

**Done when**
- Selecting text triggers your RN toolbar showing the selection text.

---

### Milestone 4 — Highlight + restore
**On highlight**
- Call reader hook method to create highlight annotation using `cfiRange`
- Insert row into `highlights` table

**On reader load**
- Fetch highlights for `(user_id, book_id)`
- Pass to reader as `initialAnnotations` (or apply after load)

**Done when**
- Highlight persists after app restart and book reopen.

---

### Milestone 5 — Translate + Save Study Word
**On translate**
- Call `supabase.functions.invoke("translate", { body })`
- Show translation in `TranslateSheet`

**On save**
- Upsert into `study_words`:
  - term, term_normalized, translation, context
- Optional: auto-highlight if not highlighted

**Done when**
- “Save” shows items in Study list.

---

### Milestone 6 — Study list
**StudyScreen**
- Query `study_words` for user
- Render list
- Delete action (recommended)
- Optional filtering by book / language

**Done when**
- Saved words are visible and removable.

---

## 7) UI: LinguaLeaf theme tokens
### Design goals
- Simple, elegant
- Natural “leaf green” palette
- Minimal chrome in reader
- Bottom-sheet translate UI

### Token suggestion
- Primary: leaf green
- Background: warm off-white
- Surface: white
- Text: near-black
- Highlight tint: mint/pale green

Implementation:
- Centralized tokens in `/src/theme/colors.ts`
- Use consistent spacing scale

---

## 8) Reader UX patterns (recommended)
### Selection toolbar
- Appears near selection or as a bottom sheet
- Actions:
  - Highlight
  - Translate (opens TranslateSheet)
  - Save (after translation or combined)

### TranslateSheet
- Shows:
  - term (large)
  - translation (large)
  - Save button
  - optional “Also highlight” toggle

### Selection limits (MVP constraints)
- Prefer 1 word or short phrase
- Hard cap selection length: 40 chars
- If longer: show “Select a shorter phrase”

---

## 9) Context snippet capture (MVP)
Goal: save “term in context” for better study.

Approach (MVP):
- When selection occurs, also capture a short snippet around it:
  - 10–20 words around selection if accessible
- If not easily accessible, store:
  - selected text only + book + cfiRange

---

## 10) Debugging strategy (reduce WebView pain)
Even though rendering is WebView-based:
- Keep UI and business logic in React Native
- Use `onWebViewMessage` to pipe debug info into RN logs
- Add a small “reader debug mode” flag:
  - logs selection events, cfiRange, annotation operations, and reader load state

Recommended:
- Build a `logger.ts` that can log to console + optionally persist last N logs in memory for a Debug screen.

---

## 11) Implementation notes / pitfalls
- EPUB files are zipped; prefer **download-to-local-file** for stability.
- Signed URLs expire; caching avoids re-downloading.
- Avoid storing full paragraphs in cache keys; keep cache keyed by normalized term.
- CFI ranges can differ if you switch to a different EPUB build/version—use stable library files for MVP.
- Use unique constraints to prevent duplicate study words and duplicate highlights.

---

## 12) Cursor execution plan (copy into tasks)
### Task list
1. Create Expo app + navigation + Supabase auth
2. Create Supabase tables + RLS policies
3. Implement LibraryScreen (DB list)
4. Implement storage download + caching
5. Integrate epubjs-react-native Reader (open file)
6. Implement selection callback + toolbar UI
7. Implement highlight add + DB persist + restore
8. Implement Edge Function `translate` + DB `translation_cache`
9. Implement TranslateSheet UI + Save to `study_words`
10. Implement StudyScreen list + delete
11. Theme polish (leaf green)
12. Add basic error handling + loading states

### Acceptance tests
- Select text → highlight persists after restart
- Select text → translate uses cache on second request
- Save study word → visible in study list after restart

---

## 13) Defaults (for MVP)
- Source language: stored per book in `books.source_lang` (manual admin entry ok)
- Target language: per-user setting (default: `en`)
- Normalization: `term_normalized = trim(lower(term))`
- Translation max length: 40 chars

---

## 14) Next steps after MVP (v1+)
- Spaced repetition scheduling
- Lemmatization/word forms
- Phrase saving & flashcards
- Offline support
- Readium migration if needed
- Search study words + tags
