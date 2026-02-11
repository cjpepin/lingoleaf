# Changelog

All notable changes to LingoLeaf will be documented in this file.

Format: `[Date] [Type] Description (Files affected)`

## 2026-02-01

- [2026-02-01] [REFACTOR] Profile: move all settings onto profile page — App language, Account, Admin, Legal in card-style sections; remove Settings button (`src/screens/ProfileScreen.tsx`)
- [2026-02-01] [FIX] TranslateSheet list picker: keep new-list input visible above keyboard — keyboardVerticalOffset 220 when input shown, pickerCardWithInput minHeight (`src/components/TranslateSheet.tsx`)
- [2026-02-01] [FIX] Profile: skip first auto-save run on load; assign save ref after handleSave to fix declaration order (`src/screens/ProfileScreen.tsx`)
- [2026-02-01] [FEAT] Reader: Kindle-style zoom-out navigation — center tap scales reader to 55% and reveals navigation panel with horizontal page strip, scrub slider, and chapters/highlights tabs; replaces Navigate button and BookNavigationSheet (`src/components/ReaderNavigationOverlay.tsx`, `src/screens/ReaderScreen.tsx`, `src/components/ReaderOverlays.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Profile: i18n for language level labels (knownLevel, goalLevel) in es, de, fr, ru (`src/i18n/translations.ts`)
- [2026-02-01] [FIX] Flashcards: Prev button no longer disabled on first card so users can wrap to last card (`src/screens/FlashcardsScreen.tsx`)
- [2026-02-01] [STYLE] Header settings/menu icons and sliders: opaque background and fixed-height slider containers for consistent look on liquid glass iOS (`src/screens/ReaderScreen.tsx`, `src/screens/FlashcardsScreen.tsx`, `src/components/ReaderSettingsModal.tsx`, `src/components/FlashcardSettingsModal.tsx`)
- [2026-02-01] [FIX] Flashcards: free study "Study all" now loads words on first open — always call loadBrowse() in initial load so words are populated for free mode when listId is null (`src/screens/FlashcardsScreen.tsx`)
- [2026-02-01] [STYLE] Flashcards: merge spaced-repetition completion into one line — "Congrats, you learned X words. Now you can:" (`src/screens/FlashcardsScreen.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Profile: "Languages you know" and "Languages you're learning" with fluency/CEFR levels; row layout (language left, level right); known levels Native/Fluent/Advanced/Intermediate/Beginner; learning levels A1–C2 with labels (e.g. C1 – Advanced); onboarding and backend support (`supabase/migrations/028_user_settings_lang_levels.sql`, `src/supabase/types.ts`, `src/screens/ProfileScreen.tsx`, `src/components/OnboardingWrapper.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Books: "Save for later" from book details; History shows "Saved for later" and "Recently read" sections; start reading from saved moves book to normal history (`supabase/migrations/027_user_books_status.sql`, `src/supabase/types.ts`, `src/supabase/queries.ts`, `src/screens/BookDetailsScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/ads/buildAdRows.ts`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Reader: improve highlight readability — use saturated annotation colors at 0.4 opacity so text is clearly visible through highlights (`src/theme/colors.ts`, `src/screens/ReaderScreen.tsx`, `src/state/useReaderSettingsStore.ts`)
- [2026-02-01] [FEAT] Reader: replace native Alert with positioned HighlightActionPopup (3 color circles + delete) that floats near the tapped highlight (`src/components/HighlightActionPopup.tsx`, `src/screens/ReaderScreen.tsx`, `src/reader/readerInjectedJavascript.ts`)
- [2026-02-01] [FEAT] Reader: add ability to change highlight color after creation (`src/supabase/queries.ts`, `src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Flashcards: starred state now persists — added missing UPDATE RLS policy on study_words table; detect silent 0-row updates in setStudyWordStarred (`supabase/migrations/023_study_words_update_policy.sql`, `src/supabase/queries.ts`, `src/screens/FlashcardsScreen.tsx`)
- [2026-02-01] [STYLE] Flashcard settings: card order is now a single on/off toggle switch instead of two buttons (`src/components/FlashcardSettingsModal.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Flashcards: remember last study UI state (mode, filter, index, front side) per deck when reopening Flashcards screen; improved Study Settings modal layout with clearer interval descriptions and inline "Reset progress" action (`src/screens/FlashcardsScreen.tsx`, `src/components/FlashcardSettingsModal.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Flashcards: unified study screen with toggle between spaced repetition and free study; card counter shows between card and buttons in free study mode; removed separate browse/spaced tabs (`src/screens/FlashcardsScreen.tsx`, `src/state/useFlashcardSettingsStore.ts`, `src/i18n/translations.ts`)
- [2026-02-01] [FIX] Flashcards: cards with short intervals (within 1 hour / hard/difficult rating) now count as "learning" instead of "learned" (`src/supabase/queries.ts`)
- [2026-02-01] [FIX] Reader: toolbar only appears after selection complete (committed flag); horizontal position now follows selection rect with iframe offset fix (`src/reader/readerInjectedJavascript.ts`, `src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FEAT] Reader: show highlight/translate toolbar only after selection is complete (on touchend/mouseup); position from selection rect (above/below, horizontally centered, clamped to screen) (`src/reader/readerInjectedJavascript.ts`, `src/screens/ReaderScreen.tsx`, `src/components/SelectionToolbar.tsx`)
- [2026-02-01] [FIX] Reader: improve native text selection — LongPress minDuration(800) so WebView selection (~400–500ms) wins over epubjs longPress; Pan activeOffsetX 70→95 so selection drag is less likely to trigger page turn; throttle selectionchange→RN to 80ms during drag (`scripts/patch-epubjs-bounces.js`, `src/reader/readerInjectedJavascript.ts`, node_modules GestureHandler)
- [2026-02-01] [FIX] Reader: revert overflow-y: hidden and native contentOffset.y clamp — they broke epub.js pagination (blank pages after next/link navigation, odd horizontal scroll); vertical lock now relies on scrollEnabled: false and bounces: false only (`src/reader/readerInjectedJavascript.ts`, `scripts/patch-webview-edit-menu.js`, `node_modules/.../RNCWebViewImpl.m`)
- [2026-02-01] [FIX] Flashcards: spaced queue returns only due words (no re-showing all when all learned); show congrats modal immediately when opening deck and all cards are learned (`src/supabase/queries.ts`, `src/screens/FlashcardsScreen.tsx`)
- [2026-02-01] [FIX] Flashcards: reset progress asks confirmation “Are you sure… all X cards?” and actually deletes reviews; categories (unseen/learning/learned) refresh after reset (`src/supabase/queries.ts`, `src/screens/FlashcardsScreen.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Flashcards: Next in browse mode wraps to start (start over); Shuffle button randomizes order (`src/screens/FlashcardsScreen.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Flashcards: starred on study words; filter by All / Starred / Unstarred in browse; star button on card (`supabase/migrations/022_study_words_starred.sql`, `src/supabase/types.ts`, `src/supabase/queries.ts`, `src/screens/FlashcardsScreen.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FIX] Reader: suppress native Writing tools/Speak menu on text selection — patch returns NO in canPerformAction and empty UIMenu in editMenuInteraction; postinstall script adds delegate early-return (`patches/react-native-webview+13.12.5.patch`, `scripts/patch-webview-edit-menu.js`, `package.json`)
- [2026-02-01] [FIX] Reader: no vertical drag/bounce — postinstall sets bounces: false and patches epubjs View (`scripts/patch-epubjs-bounces.js`, `package.json`)
- [2026-02-01] [FIX] Reader: page swipe only turns page if finger moves ≥70px horizontally (cancel short swipes); Pan with activeOffsetX/failOffsetY in epubjs GestureHandler via postinstall (`scripts/patch-epubjs-bounces.js`)
- [2026-02-01] [FIX] Snackbar: passThrough prop so reader page turns work while "Saved to list" is visible (`src/components/Snackbar.tsx`, `src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] TranslateSheet list picker: scroll to new-list input when shown, higher KeyboardAvoidingView offset, keyboardShouldPersistTaps (`src/components/TranslateSheet.tsx`)
- [2026-02-01] [FIX] Reader highlights: darker text and stronger text-shadow so text is readable on top of highlight (`src/reader/readerInjectedJavascript.ts`)
- [2026-02-01] [FEAT] Flashcards: refresh unseen/learning/learned after each rating; completion modal "Congrats you learned X words!" with Continue free studying, Reset and start over, Go back to reading (History) (`src/screens/FlashcardsScreen.tsx`, `src/i18n/translations.ts`)
- [2026-02-01] [FEAT] Library/History: genre/category filter options prefilled by selected language (subjects only for books in that language) (`src/components/LibraryHeader.tsx`, `src/supabase/queries.ts`, `supabase/migrations/021_book_subjects_by_language.sql`)
- [2026-02-01] [FIX] Reader: no native popup on text highlight (stop passing menuItems so WebView gets nil; existing patch suppresses menu) (`src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Reader: clear WebView selection after highlight/translate/close so user can select other text (`src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Reader: make highlights more visible (opacity 0.4 → 0.7) (`src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Snackbar: auto-dismiss after duration (use ref for onDismiss so parent re-renders don’t clear timeout) (`src/components/Snackbar.tsx`)
- [2026-02-01] [FIX] Flashcards: rating row no longer flashes and disappears — remove unstable `t` from load deps so effect does not re-run every render and reset flipped (`src/screens/FlashcardsScreen.tsx`)
- [2026-02-01] [FIX] ReaderScreen: stop infinite reload loop — remove unstable `t` from mount effect deps so it runs once per book (`src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Reader: edge tap/long-press — put tap strips beside reader (not on top) so full reader area is selectable; words at left/right margin can be selected on long-press (`src/components/ReaderEdgeTapOverlay.tsx`, `src/screens/ReaderScreen.tsx`)
- [2026-02-01] [FIX] Reader: force displayed page to match cached initialLocation when ready (fixes page counter correct but content on cover) (`src/screens/ReaderScreen.tsx`)

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
