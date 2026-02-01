# Changelog

All notable changes to LingoLeaf will be documented in this file.

Format: `[Date] [Type] Description (Files affected)`

## 2026-01-28

- [2026-01-28] [FEAT] Flashcards: 3-category progress (unseen/learning/learned), completion modal when all learned with options: continue free studying, come back tomorrow, add words by reading; i18n for new strings (`src/screens/FlashcardsScreen.tsx`, `src/supabase/queries.ts`, `src/i18n/translations.ts`)
- [2026-01-28] [FEAT] Reader i18n: ReaderScreen alerts/snackbars, BookNavigationSheet, ReaderSettingsModal (fonts, highlight colors) in English/Spanish (`src/screens/ReaderScreen.tsx`, `src/components/BookNavigationSheet.tsx`, `src/components/ReaderSettingsModal.tsx`, `src/i18n/translations.ts`)
- [2026-01-28] [FEAT] App language: English/Spanish i18n, toggle in Settings (`src/i18n/translations.ts`, `src/state/useAppLangStore.ts`, `supabase/migrations/020_app_language.sql`)
- [2026-01-28] [FEAT] Study all: Anki-style rating system for "Study all" (fetchFlashcardQueueAll, session key __all__)
- [2026-01-28] [FEAT] Flashcard interval settings: Again (within N cards), Hard/Good/Easy (user-configurable), increase-on-repeat multiplier (`src/state/useFlashcardSettingsStore.ts`, `src/components/FlashcardSettingsModal.tsx`, `src/supabase/queries.ts`, `supabase/migrations/019_flashcard_interval_settings.sql`)
- [2026-01-28] [FEAT] Anki-style flashcard retention: flip → rate (Again/Hard/Good/Easy) → next; spaced repetition with DB storage; resume/restart on quit (`src/screens/FlashcardsScreen.tsx`, `src/components/FlashcardSettingsModal.tsx`, `src/supabase/queries.ts`, `src/utils/flashcardSessionStorage.ts`, `supabase/migrations/018_study_word_reviews.sql`)
- [2026-01-28] [FEAT] Flashcard 3-dots settings: term/translation first (`src/components/FlashcardSettingsModal.tsx`)
- [2026-01-28] [FEAT] Reader settings: 3-dot menu with highlight-on-translate toggle, font size, font, highlight color (`src/components/ReaderSettingsModal.tsx`, `src/state/useReaderSettingsStore.ts`, `supabase/migrations/016_reader_settings.sql`)
- [2026-01-28] [FEAT] Auto-highlight when translating (toggle in Reader Settings)
- [2026-01-28] [FIX] SelectionToolbar: center on selection with reader offset, 10px gap above
- [2026-01-28] [FIX] Edge selection: remove overlay, detect quick tap vs long-press in WebView (tap=page turn, long-press=select)
- [2026-01-28] [FEAT] App loading splash: centered icon with soft shadow and spinner during auth init (`src/components/AppLoadingSplash.tsx`, `src/navigation/index.tsx`)
- [2026-01-28] [FIX] Library/History loading flicker: single initial load, skip useFocusEffect/search effect on mount (`src/screens/LibraryScreen.tsx`, `src/screens/HistoryScreen.tsx`)
- [2026-01-28] [FIX] MainTabs: default to Library tab immediately, remove async hasReadingHistory delay (`src/navigation/index.tsx`)
- [2026-01-28] [FIX] Auth network error: retry with backoff, show AuthErrorScreen with Retry when connection fails (`src/state/useAuthStore.ts`, `src/components/AuthErrorScreen.tsx`)

## 2026-01-09

### Latest Updates

- [2026-01-09] [FIX] Migration 401 error: wait for session with retry logic (no arbitrary timeouts), verify session before Edge Function invocation (`src/supabase/migrateUserData.ts`, `src/screens/AuthScreen.tsx`)
- [2026-01-09] [FIX] Language picker modal: fix nested modal rendering issue, make language picker work correctly (`src/components/LibraryHeader.tsx`)
- [2026-01-09] [FEAT] Email confirmation deep linking: handle email confirmation links in-app, auto-redirect from web to app (`App.tsx`, `app.json`, `public/auth-redirect.html`, `EMAIL_CONFIRMATION_SETUP.md`)
- [2026-01-09] [FIX] Auth logging: EMAIL_CONFIRMATION_REQUIRED logged as info (expected behavior) not error (`src/screens/AuthScreen.tsx`)
- [2026-01-09] [FIX] Auth flow: always use signUp() for new accounts (sends proper welcome email), migrate guest data after account creation (`src/screens/AuthScreen.tsx`, `src/state/useAuthStore.ts`)
- [2026-01-09] [FIX] Snackbar positioning: render in Modal above navbar, add tap-to-dismiss (`src/components/Snackbar.tsx`)
- [2026-01-09] [FEAT] Onboarding flow: guided 4-step journey for first-time users (native language, goal languages, feature tour) (`src/components/OnboardingModal.tsx`, `src/components/OnboardingWrapper.tsx`, `App.tsx`)
- [2026-01-09] [FEAT] Flashcard enhancements: toggle term/translation order, slide animations for page turns, 3D flip animation (`src/screens/FlashcardsScreen.tsx`)
- [2026-01-09] [FEAT] Library language filter: autocomplete picker with search, defaults to user's goal languages (`src/components/LibraryHeader.tsx`, `src/screens/LibraryScreen.tsx`, `src/state/useSettingsStore.ts`, `src/constants/languages.ts`)
- [2026-01-09] [FEAT] Translate/save word improvements: snackbar notifications, inline list creation in translate sheet (`src/screens/ReaderScreen.tsx`, `src/components/TranslateSheet.tsx`, `src/components/Snackbar.tsx`)
- [2026-01-09] [FEAT] Password validation: min 8 chars, uppercase, lowercase, number, special char with inline feedback (`src/screens/AuthScreen.tsx`, `src/utils/passwordValidation.ts`)
- [2026-01-09] [FEAT] Apple sign-in display name: show user's full name or "Apple User" instead of privaterelay email (`src/screens/ProfileScreen.tsx`)
- [2026-01-09] [FEAT] Auth UX improvements: snackbar for success/errors, only show confirm password on sign-up (`src/screens/AuthScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/components/Snackbar.tsx`)

## 2025-12-30

### Latest Updates (Consolidated)

- [2026-01-04] [FIX] Avoid startup crash when Supabase env vars are missing; show config error screen instead (`App.tsx`, `src/supabase/client.ts`)
- [2026-01-04] [FIX] Auth upgrade reliability: treat Apple/Google cancel/dismiss as no-op and merge guest data into signed-in account (incl. `user_books` PK-safe merge) (`src/screens/AuthScreen.tsx`, `src/state/useAuthStore.ts`, `src/supabase/migrateUserData.ts`, `supabase/functions/migrate-user-data/index.ts`)
- [2026-01-04] [FEAT] Reader navigation + progress: reliable location bridge, per-book cached page counter, Navigate modal (chapters/highlights/go-to-page/go-back), and more robust TOC href handling (`src/screens/ReaderScreen.tsx`, `src/components/ReaderOverlays.tsx`, `src/components/BookNavigationSheet.tsx`, `src/utils/readerProgressCache.ts`, `src/reader/readerInjectedJavascript.ts`)
- [2026-01-03] [FEAT] Improve library ranking with Gutendex popularity score (`supabase/migrations/014_books_popularity_score.sql`, `scripts/sync-gutendex.mjs`, `src/supabase/queries.ts`, `src/supabase/types.ts`)
- [2026-01-02] [FEAT] Guest-first auth + upgrade prompting and provider sign-in (Apple/Google) (`src/state/useAuthStore.ts`, `src/components/UpgradeAccountPrompt.tsx`, `src/state/useUpgradePromptStore.ts`, `src/screens/AuthScreen.tsx`, `supabase/migrations/012_user_prompt_state.sql`)
- [2026-01-02] [SEC] Harden guest security: lock down library writes + tighten RLS checks (`supabase/migrations/013_guest_security_hardening.sql`)
- [2026-01-02] [FEAT] Ads + grid feed improvements: banner ads and smoother search/filter UX (`src/components/ads/AdBanner.tsx`, `src/ads/`, `src/components/LibraryHeader.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/HistoryScreen.tsx`)
- [2026-01-01] [REFACTOR] UI primitives + reader component split + reusable Button (`src/components/ui/`, `src/screens/ReaderScreen.tsx`, `src/components/ReaderEdgeTapOverlay.tsx`, `src/components/ReaderOverlays.tsx`, `src/components/ReaderHighlightsModal.tsx`)
- [2026-01-01] [FEAT] Study experience overhaul: lists-first workflow + flashcards (`src/screens/StudyScreen.tsx`, `src/screens/FlashcardsScreen.tsx`, `src/supabase/queries.ts`)
- [2025-12-30] [FEAT] Library + catalog foundation: Gutendex ingestion, server-side pagination/filters, Book Details, and History tab (`scripts/sync-gutendex.mjs`, `src/screens/LibraryScreen.tsx`, `src/screens/BookDetailsScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/supabase/queries.ts`, `supabase/migrations/009_books_catalog_metadata.sql`, `supabase/migrations/010_books_source_unique.sql`, `supabase/migrations/011_books_description.sql`)
- [2025-12-30] [FEAT] Reader learning loop: per-user per-book progress (`user_books`), highlights persistence, vocab lists + flashcards, and improved selection/translate UX (`src/screens/ReaderScreen.tsx`, `src/supabase/queries.ts`, `src/supabase/types.ts`, `supabase/migrations/006_user_books.sql`, `supabase/migrations/007_vocab_lists.sql`, `supabase/migrations/008_user_books_highlights.sql`)
- [2025-12-30] [FEAT] Admin publishing: EPUB upload, metadata editing, and cover extraction (`src/screens/AdminScreen.tsx`, `src/utils/epubCover.ts`, `src/components/BookGridItem.tsx`, `src/supabase/queries.ts`)

## 2025-12-27

### Previous Updates (Consolidated)

- [2025-12-28] [FEAT] Admin + navigation foundation: Admin upload screen, Profile/Settings navigation, and library storage policies (`src/screens/AdminScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/navigation/`, `supabase/migrations/004_general_library_storage_policies.sql`, `supabase/migrations/005_books_insert_policy.sql`)
- [2025-12-27] [FEAT] Initial MVP: Expo app scaffold, theme, navigation, Supabase auth + queries, EPUB reader with selection + translation, and Study screen (`App.tsx`, `src/theme/`, `src/navigation/`, `src/supabase/`, `src/screens/ReaderScreen.tsx`, `src/screens/StudyScreen.tsx`)
- [2025-12-27] [DB] Initial schema + translation Edge Function (`supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_storage_policies.sql`, `supabase/functions/translate/index.ts`)
- [2025-12-27] [DOCS] Project docs + contributor guidelines (`README.md`, `AGENTS.md`, `CHANGELOG.md`)

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
