# Changelog

All notable changes to LinguaLeaf will be documented in this file.

Format: `[Date] [Type] Description (Files affected)`

## 2025-12-30

### Latest Updates

- `[2026-01-02]` `[FEAT]` Guest-first auth: auto anonymous sessions, optional upgrade prompt with milestones + anti-spam, and Create Account entry point (`src/state/useAuthStore.ts`, `src/navigation/index.tsx`, `src/navigation/types.ts`, `src/screens/AuthScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/screens/ReaderScreen.tsx`, `src/components/UpgradeAccountPrompt.tsx`, `src/state/useUpgradePromptStore.ts`, `src/utils/readingEngagement.ts`, `src/supabase/queries.ts`, `src/supabase/types.ts`, `supabase/migrations/012_user_prompt_state.sql`)
- `[2026-01-03]` `[FEAT]` Sort library by Gutendex popularity (download_count) (`supabase/migrations/014_books_popularity_score.sql`, `scripts/sync-gutendex.mjs`, `src/supabase/queries.ts`, `src/supabase/types.ts`)
- `[2026-01-02]` `[SEC]` Lock down library writes for guest-first auth (admins-only writes for `books` + `storage.objects` in `general-library`, add missing `WITH CHECK` on user-owned update policies) (`supabase/migrations/013_guest_security_hardening.sql`)
- `[2026-01-02]` `[PERF]` Smooth library/history search: draft filters applied only on Done; avoid full-screen reset during search and skip expensive cache cleanup while typing (`src/components/LibraryHeader.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/HistoryScreen.tsx`)
- `[2026-01-02]` `[FEAT]` Add Apple/Google sign-in (upgrade-friendly) and banner ads in Library/History (`src/screens/AuthScreen.tsx`, `src/supabase/migrateUserData.ts`, `supabase/functions/migrate-user-data/index.ts`, `src/components/ads/AdBanner.tsx`, `src/ads/adIds.ts`, `src/screens/LibraryScreen.tsx`, `src/screens/HistoryScreen.tsx`, `app.config.ts`)
- `[2026-01-02]` `[FEAT]` Insert banner ads every ~4 rows in Library/History grids (`src/ads/buildAdRows.ts`, `src/screens/LibraryScreen.tsx`, `src/screens/HistoryScreen.tsx`)
- `[2026-01-01]` `[REFACTOR]` Add reusable Button component and refactor common buttons to use it (`src/components/ui/Button.tsx`, `src/components/LibraryHeader.tsx`, `src/screens/FlashcardsScreen.tsx`, `src/screens/BookDetailsScreen.tsx`, `src/components/BookNavigationSheet.tsx`, `src/components/VocabListPickerModal.tsx`)
- `[2026-01-01]` `[REFACTOR]` Add reusable UI primitives (OverlayModal, CenteredLoader) and refactor common modal/loader patterns (`src/components/ui/OverlayModal.tsx`, `src/components/ui/CenteredLoader.tsx`, `src/components/LibraryHeader.tsx`, `src/components/VocabListPickerModal.tsx`, `src/components/ReaderHighlightsModal.tsx`, `src/components/BookNavigationSheet.tsx`, `src/screens/FlashcardsScreen.tsx`, `src/screens/BookDetailsScreen.tsx`, `src/screens/HistoryScreen.tsx`)
- `[2026-01-01]` `[REFACTOR]` Split ReaderScreen UI into smaller components (edge tap overlay, overlays, highlights modal) (`src/screens/ReaderScreen.tsx`, `src/components/ReaderEdgeTapOverlay.tsx`, `src/components/ReaderOverlays.tsx`, `src/components/ReaderHighlightsModal.tsx`)
- `[2026-01-01]` `[FEAT]` Redesign Study screen to lists-first UI (study all, per-list study, list detail words with move/delete) (`src/screens/StudyScreen.tsx`, `src/screens/FlashcardsScreen.tsx`, `src/navigation/types.ts`, `src/supabase/queries.ts`)
- `[2026-01-01]` `[STYLE]` Update app icon to LinguaLeaf leaf-book PNG (`app.json`, `assets/lingualeaf_icon.png`)
- `[2025-12-30]` `[FEAT]` Add History tab (previously read books) with search/filters/pagination and auto-default to History when user has reads (`src/screens/HistoryScreen.tsx`, `src/navigation/index.tsx`, `src/navigation/types.ts`, `src/supabase/queries.ts`, `src/components/LibraryHeader.tsx`)
- `[2025-12-30]` `[FEAT]` Ingest Gutendex book summaries into books.description for Book Details synopsis (`scripts/sync-gutendex.mjs`, `supabase/migrations/011_books_description.sql`)
- `[2025-12-30]` `[FEAT]` Add Book Details interstitial (cover/title/author/description) with Read Now button before opening reader (`src/screens/BookDetailsScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/navigation/index.tsx`, `src/navigation/types.ts`, `supabase/migrations/011_books_description.sql`, `src/supabase/types.ts`)
- `[2025-12-30]` `[FEAT]` Use minimalist Feather icons in bottom tab bar (`src/navigation/index.tsx`)
- `[2025-12-30]` `[FEAT]` Add Gutendex sync language filter flag (--lang/--language) to ingest Spanish (or other) catalogs (`scripts/sync-gutendex.mjs`)
- `[2025-12-30]` `[FEAT]` Add server-side paginated library loading (15 books per page) that applies after filters (`src/screens/LibraryScreen.tsx`, `src/supabase/queries.ts`)
- `[2025-12-30]` `[FIX]` Fix Gutendex upsert by adding non-partial unique index for (source, source_id) (`supabase/migrations/010_books_source_unique.sql`)
- `[2025-12-30]` `[FEAT]` Add Gutendex ingestion + library search/filter support (requires DB migration) (`supabase/migrations/009_books_catalog_metadata.sql`, `scripts/sync-gutendex.mjs`, `src/supabase/queries.ts`, `src/screens/LibraryScreen.tsx`, `src/components/LibraryHeader.tsx`, `src/supabase/storage.ts`, `src/components/BookGridItem.tsx`, `src/supabase/types.ts`)
- `[2025-12-30]` `[DOCS]` Document US-first public-domain sourcing strategy (Gutendex + Standard Ebooks) and Terms notes for future international release (`README.md`)
- `[2025-12-30]` `[FIX]` Fix reader page counter by using onLocationChange currentLocation.start.location instead of totalLocations (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Tap left/right edge to go previous/next page in reader (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Refresh Study list on tab focus and add pull-to-refresh so all saved study words show up (`src/screens/StudyScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Persist reading position per user/book and restore on open via `user_books` join table (`supabase/migrations/006_user_books.sql`, `src/supabase/queries.ts`, `src/supabase/types.ts`, `src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Remove translation target selection from Settings (managed in Profile) (`src/screens/SettingsScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Admin upload flow now supports editing book metadata (title/author/source language/bucket) before upload (`src/screens/AdminScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Switch library to 3-column grid and extract/cache EPUB embedded covers for display (best-effort for cached books) (`src/screens/LibraryScreen.tsx`, `src/components/BookGridItem.tsx`, `src/utils/epubCover.ts`)
- `[2025-12-30]` `[FEAT]` Extract EPUB cover during admin upload, store in books.cover_path, and prefer remote cover in library so all covers can display without downloading EPUBs (`src/screens/AdminScreen.tsx`, `src/supabase/queries.ts`, `src/components/BookGridItem.tsx`, `src/utils/epubCover.ts`)
- `[2025-12-30]` `[FEAT]` Add vocab lists (CRUD + move words) and list selection when saving from reader (requires DB migration) (`supabase/migrations/007_vocab_lists.sql`, `src/supabase/types.ts`, `src/supabase/queries.ts`, `src/screens/ReaderScreen.tsx`, `src/screens/StudyScreen.tsx`, `src/components/TranslateSheet.tsx`, `src/components/VocabListPickerModal.tsx`)
- `[2025-12-30]` `[FIX]` Allow creating and managing empty vocab lists even when there are no saved words (use in-list empty state instead of early return) (`src/screens/StudyScreen.tsx`)
- `[2025-12-30]` `[FIX]` Auto-close Manage Lists sheet after selecting or creating a list (`src/screens/StudyScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Add flashcard study mode for a vocab list (`src/screens/FlashcardsScreen.tsx`, `src/screens/StudyScreen.tsx`, `src/navigation/index.tsx`, `src/navigation/types.ts`)
- `[2025-12-30]` `[FEAT]` Persist reader highlights in user_books (JSONB), restore/apply as annotations, and add highlight list with jump/delete (requires DB migration) (`supabase/migrations/008_user_books_highlights.sql`, `src/supabase/types.ts`, `src/supabase/queries.ts`, `src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Add reader navigation overlay (center tap / button) with chapter list and page jump controls (`src/screens/ReaderScreen.tsx`, `src/components/BookNavigationSheet.tsx`)
- `[2025-12-30]` `[FIX]` Simplify reader navigation UI (combined view) and fix Go To Page by using locations.length readiness (`src/screens/ReaderScreen.tsx`, `src/components/BookNavigationSheet.tsx`)
- `[2025-12-30]` `[FIX]` Align Navigate page numbers with reader counter by deriving page index from currentLocation.start.cfi within locations[] (`src/screens/ReaderScreen.tsx`, `src/components/BookNavigationSheet.tsx`)
- `[2025-12-30]` `[STYLE]` Constrain library book cover tiles to exact 1/3 viewport width with padding (`src/screens/LibraryScreen.tsx`, `src/components/BookGridItem.tsx`)
- `[2025-12-30]` `[FIX]` Fixed selection toolbar not appearing - removed TouchableWithoutFeedback that was intercepting all touch events before Reader could process them (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Enable iOS scripted content + add selection debug bridge + RN fallback to show selection toolbar when epubjs onSelected fails (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Include 1-word-before/after selection context in translate requests and persist context to highlights/study words when available (`src/screens/ReaderScreen.tsx`, `src/supabase/types.ts`)
- `[2025-12-30]` `[FIX]` Simplified JS injection to only suppress menu, let epub.js handle selection (`src/screens/ReaderScreen.tsx`, `patches/react-native-webview+13.12.5.patch`)
- `[2025-12-30]` `[FIX]` Enhanced selection detection to trigger epub.js hooks directly from iframe (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Custom highlight/translate popup now shows on text selection (native menu suppressed) (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` ULTIMATE native menu suppression: patched react-native-webview + enhanced JS (`patches/react-native-webview+13.12.5.patch`, `src/screens/ReaderScreen.tsx`, `package.json`)
- `[2025-12-30]` `[DEBUG]` Added debug indicator and logging to diagnose selection callback issues (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Simplified menu suppression JavaScript (v3) with cleaner iframe patching (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Completely rewrote native iOS menu suppression with aggressive iframe patching (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Fixed native menu suppression to allow selection (removed -webkit-user-modify) (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FEAT]` Auto-refresh library on screen focus and cleanup orphaned cached files (`src/screens/LibraryScreen.tsx`, `src/supabase/storage.ts`)
- `[2025-12-30]` `[FIX]` Fixed AdminScreen EPUB upload to properly upload full file using FormData (`src/screens/AdminScreen.tsx`)
- `[2025-12-30]` `[FIX]` Fixed empty EPUB files causing infinite loading (validate file size, re-download if empty) (`src/supabase/storage.ts`)
- `[2025-12-30]` `[FIX]` Added file verification and better error logging to ReaderScreen (`src/screens/ReaderScreen.tsx`)
- `[2025-12-30]` `[FIX]` Fixed EPUB reader infinite loading by using proper Expo file system adapter (`src/screens/ReaderScreen.tsx`, `package.json`)
- `[2025-12-30]` `[FIX]` Fixed React Navigation version mismatch (downgraded bottom-tabs v7→v6) (`package.json`)
- `[2025-12-30]` `[FIX]` Removed invalid sceneContainerStyle prop from Tab.Navigator (`src/navigation/index.tsx`)
- `[2025-12-30]` `[FEAT]` Added TypeScript type checking to dev.sh startup script (`dev.sh`, `tsconfig.json`)
- `[2025-12-30]` `[FIX]` Fixed upsertUserSettings to accept partial updates (`src/supabase/queries.ts`)
- `[2025-12-30]` `[CHORE]` Excluded Supabase Deno functions from TypeScript checks (`tsconfig.json`)

## 2025-12-27

### Previous Updates

- `[2025-12-27]` `[FEAT]` Added page indicator in top right corner showing current/total pages (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Fixed page indicator to calculate pages from location index (location / 2) (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Redesigned SelectionToolbar as floating popup with arrow pointer (`src/components/SelectionToolbar.tsx`)
- `[2025-12-27]` `[FEAT]` Added intelligent positioning for toolbar (above/below selection with 16px buffer) (`src/components/SelectionToolbar.tsx`)
- `[2025-12-27]` `[FEAT]` Track touch position to dynamically position toolbar near selected text (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Suppress native context menu and iOS callout on text selection (`src/screens/ReaderScreen.tsx`)
- `[2025-12-28]` `[FEAT]` Add AdminScreen for uploading EPUBs to global library (`src/screens/AdminScreen.tsx`)
- `[2025-12-28]` `[FEAT]` Add admin check query and createBook mutation (`src/supabase/queries.ts`)
- `[2025-12-28]` `[FEAT]` Add Admin navigation route and button in Settings (`src/navigation/`, `src/screens/SettingsScreen.tsx`)
- `[2025-12-28]` `[DB]` Add admin column to user_settings and is_global to books (`supabase/migrations/add_admin_and_global_library.sql`)
- `[2025-12-28]` `[DOCS]` Move admin setup instructions to README.md (`README.md`)
- `[2025-12-28]` `[FEAT]` Add admin status chip to ProfileScreen (`src/screens/ProfileScreen.tsx`)
- `[2025-12-28]` `[FEAT]` Add Settings button to Library header navigation (`src/screens/LibraryScreen.tsx`)
- `[2025-12-28]` `[DB]` Add storage policies for general-library bucket (`supabase/migrations/004_general_library_storage_policies.sql`)
- `[2025-12-28]` `[DB]` Add INSERT/UPDATE/DELETE policies for books table (`supabase/migrations/005_books_insert_policy.sql`)
- `[2025-12-28]` `[DOCS]` Update README with detailed storage and books table policy setup instructions (`README.md`)
- `[2025-12-28]` `[FEAT]` Add pull-to-refresh functionality to LibraryScreen (`src/screens/LibraryScreen.tsx`)
- `[2025-12-28]` `[FEAT]` Implement bottom tab navigation with icons (Library, Study, Profile) (`src/navigation/`)
- `[2025-12-28]` `[FEAT]` Hide bottom tabs in Reader screen for full-screen reading (`src/navigation/index.tsx`)
- `[2025-12-28]` `[FEAT]` Move Settings to Profile screen, remove from main navigation (`src/screens/ProfileScreen.tsx`)
- `[2025-12-27]` `[FIX]` Added TouchableWithoutFeedback wrapper to ensure taps clear selection (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Adjusted PanGestureHandler activeOffsetX to allow taps to pass through (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Implemented custom PanGestureHandler for horizontal page swiping with paginated flow (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Fixed page counter to use currentLocation from useReader hook (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Added visual page swipe feedback with touch tracking and CSS transitions (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Enabled native swipe navigation with paginated flow and snap (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Removed custom swipe handlers to fix inconsistent page changes (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Disabled vertical scrolling and elastic bounce with injected CSS and touch-action (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Added ProfileScreen with language preferences and account management (`src/screens/ProfileScreen.tsx`)
- `[2025-12-27]` `[DB]` Added native_lang, known_langs, goal_langs to user_settings table (`supabase/migrations/003_language_preferences.sql`)
- `[2025-12-27]` `[FEAT]` Updated UserSettings type to support multiple languages (`src/supabase/types.ts`)
- `[2025-12-27]` `[FEAT]` Added Profile navigation and removed Sign Out from Library header (`src/screens/LibraryScreen.tsx`, `src/navigation/`)
- `[2025-12-27]` `[FIX]` Added onSingleTap handler to dismiss selection toolbar when tapping elsewhere (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Fixed native context menu appearing on subsequent selections with dummy menu item (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Fixed FileSystem adapter infinite loop by creating stable module-level object (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FIX]` Fixed FileSystem type compatibility with @epubjs-react-native/core (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Added language detection to translation Edge Function for graceful same-language handling (`supabase/functions/translate/index.ts`)
- `[2025-12-27]` `[FIX]` Updated Edge Function to use Supabase auto-provided environment variables (`supabase/functions/translate/index.ts`)
- `[2025-12-27]` `[CHORE]` Updated deploy script to handle all required secrets (`deploy-function.sh`)

### Initial MVP Implementation

- `[2025-12-27]` `[FEAT]` Expo app with TypeScript setup (`App.tsx`, `package.json`, `tsconfig.json`)
- `[2025-12-27]` `[FEAT]` Navigation with React Navigation (`src/navigation/`)
- `[2025-12-27]` `[FEAT]` Leaf green theme system (`src/theme/`)
- `[2025-12-27]` `[FEAT]` Supabase client and auth integration (`src/supabase/client.ts`)
- `[2025-12-27]` `[FEAT]` Auth state management with Zustand (`src/state/useAuthStore.ts`)
- `[2025-12-27]` `[FEAT]` Settings state management (`src/state/useSettingsStore.ts`)
- `[2025-12-27]` `[FEAT]` Email/password authentication screen (`src/screens/AuthScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Library screen with book list (`src/screens/LibraryScreen.tsx`)
- `[2025-12-27]` `[FEAT]` EPUB reader with text selection (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Study words list screen (`src/screens/StudyScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Settings screen with language selection (`src/screens/SettingsScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Selection toolbar component (`src/components/SelectionToolbar.tsx`)
- `[2025-12-27]` `[FEAT]` Translation sheet modal (`src/components/TranslateSheet.tsx`)
- `[2025-12-27]` `[FEAT]` Book list item component (`src/components/BookListItem.tsx`)
- `[2025-12-27]` `[FEAT]` Empty state component (`src/components/EmptyState.tsx`)
- `[2025-12-27]` `[FEAT]` Supabase storage utilities with caching (`src/supabase/storage.ts`)
- `[2025-12-27]` `[FEAT]` Centralized database queries (`src/supabase/queries.ts`)
- `[2025-12-27]` `[FEAT]` Database types (`src/supabase/types.ts`)
- `[2025-12-27]` `[FEAT]` Text normalization utilities (`src/utils/normalize.ts`)
- `[2025-12-27]` `[FEAT]` Debug logger utility (`src/utils/logger.ts`)
- `[2025-12-27]` `[DB]` Database schema with RLS policies (`supabase/migrations/001_initial_schema.sql`)
- `[2025-12-27]` `[FUNC]` Translation Edge Function with caching (`supabase/functions/translate/index.ts`)
- `[2025-12-27]` `[DOCS]` Code style guidelines (`AGENTS.md`)
- `[2025-12-27]` `[DOCS]` Comprehensive README (`README.md`)
- `[2025-12-27]` `[DOCS]` Changelog file (`CHANGELOG.md`)
- `[2025-12-27]` `[FIX]` Add esModuleInterop to TypeScript config (`tsconfig.json`)
- `[2025-12-27]` `[FIX]` Fix Reader component Theme and onSelected types (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[CHORE]` Organize environment files in env directory (`env/.env.example`, `env/.env.local`, `.gitignore`)
- `[2025-12-27]` `[FIX]` Fix duplicate policy name in user_settings table (`supabase/migrations/001_initial_schema.sql`)
- `[2025-12-27]` `[FIX]` Fix package.json main entry point (`package.json`)
- `[2025-12-27]` `[CHORE]` Add missing @dr.pogodin/react-native-fs dependency (`package.json`)
- `[2025-12-27]` `[CHORE]` Add missing react-native-gesture-handler dependency (`package.json`, `App.tsx`)
- `[2025-12-27]` `[FIX]` Update react-native-screens to compatible version (`package.json`)
- `[2025-12-27]` `[FIX]` Create .env file in root for Expo (`.env`, `.gitignore`, `README.md`, `babel.config.js`)
- `[2025-12-27]` `[FIX]` Use expo-file-system instead of react-native-fs (`src/screens/ReaderScreen.tsx`, `package.json`)
- `[2025-12-27]` `[FIX]` Downgrade react-native-screens to 3.29.0 for stability (`package.json`)
- `[2025-12-27]` `[CHORE]` Add detailed logging to storage download (`src/supabase/storage.ts`)
- `[2025-12-27]` `[FIX]` Disable new architecture to fix "large" error (`app.json`)
- `[2025-12-27]` `[FIX]` Add presentation: card to navigation to work around screens error (`src/navigation/index.tsx`)
- `[2025-12-27]` `[FIX]` Fix package versions to match Expo SDK requirements (`package.json`)
- `[2025-12-27]` `[CHORE]` Add .expo/ to gitignore (`.gitignore`)
- `[2025-12-27]` `[DB]` Add storage policies for books bucket (`supabase/migrations/002_storage_policies.sql`)
- `[2025-12-27]` `[FIX]` Add proper fileSystem wrapper for Reader component (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[CHORE]` Add Reader lifecycle logging (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[CHORE]` Build custom development client for native modules (`ios/`, `android/`)
- `[2025-12-27]` `[CHORE]` Generate placeholder assets for prebuild (`scripts/generate-assets.js`)
- `[2025-12-27]` `[DOCS]` Update README with custom dev client instructions (`README.md`)
- `[2025-12-27]` `[FIX]` Add ReaderProvider wrapper required by @epubjs-react-native/core (`App.tsx`)
- `[2025-12-27]` `[FIX]` Remove debug notice banner from ReaderScreen (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[CHORE]` Add dev.sh script for easy local development (`dev.sh`)
- `[2025-12-27]` `[FIX]` Enable text selection and suppress default menu in Reader (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[PERF]` Memoize Reader callbacks to prevent unnecessary re-renders (`src/screens/ReaderScreen.tsx`)
- `[2025-12-27]` `[FEAT]` Add intelligent language detection to translation (`supabase/functions/translate/index.ts`)
- `[2025-12-27]` `[FEAT]` Handle same-language translation gracefully (`src/screens/ReaderScreen.tsx`, `supabase/functions/translate/index.ts`)

---

## Change Types

- `[FEAT]` - New feature
- `[FIX]` - Bug fix
- `[REFACTOR]` - Code refactoring
- `[PERF]` - Performance improvement
- `[STYLE]` - UI/styling changes
- `[DOCS]` - Documentation changes
- `[TEST]` - Test additions/changes
- `[CHORE]` - Build/config changes
- `[DB]` - Database schema changes
- `[FUNC]` - Edge Function changes
- `[BREAKING]` - Breaking changes

## Format Guidelines

Each entry should follow this format:
```
[YYYY-MM-DD] [TYPE] One-line description (files affected)
```

Example:
```
[2025-12-27] [FEAT] Add dark mode toggle (src/theme/colors.ts, src/screens/SettingsScreen.tsx)
[2025-12-27] [FIX] Fix translation cache not working (supabase/functions/translate/index.ts)
[2025-12-27] [REFACTOR] Extract highlight logic to custom hook (src/screens/ReaderScreen.tsx, src/hooks/useHighlights.ts)
```
