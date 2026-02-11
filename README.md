# LingoLeaf

A React Native app for reading EPUBs with integrated translation and vocabulary learning. Read books in foreign languages with instant translation and build your vocabulary list.

## Features

- 📚 EPUB reader with text selection
- 🌍 Real-time translation with aggressive caching
- ✨ Text highlighting with persistence
- 📝 Study word list with context
- 🎯 Multi-language support
- 🔐 Secure authentication and data isolation

## Tech Stack

- **Frontend**: React Native (Expo), TypeScript, React Navigation, Zustand
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **Reader**: @epubjs-react-native
- **Translation**: Google Translate API

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file in the root directory with your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://gowffgtxpqxabtskbqdo.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
GOOGLE_TRANSLATE_API_KEY=your-google-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get your service role key from: [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/gowffgtxpqxabtskbqdo/settings/api)

**Note**: Expo automatically loads environment variables from `.env` in the root directory

**Google Sign-In**: To fix "Authorization Error / deleted_client" (401), create **new** OAuth 2.0 Client IDs in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (APIs & Services → Credentials): one **iOS** (bundle ID `com.lingoleaf.app`), one **Android** (package `com.lingoleaf.app` + your signing SHA-1), one **Web application**. Copy the three client IDs into `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. In Supabase Dashboard → Authentication → Providers → Google, set the **Web** client ID and its **secret** (from the same Web client).

### 3. Setup Database

Run the migration in Supabase SQL Editor:

```bash
# Copy and paste contents of: supabase/migrations/001_initial_schema.sql
```

### 4. Setup Storage

1. Go to Supabase Dashboard → Storage
2. Create bucket named `books` (set to Private)
3. Upload an EPUB file

### 5. Add Book to Database

```sql
INSERT INTO books (title, author, storage_path, source_lang)
VALUES ('Book Title', 'Author Name', 'filename.epub', 'es');
```

### 6. Deploy Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref gowffgtxpqxabtskbqdo

# Deploy function
supabase functions deploy translate --no-verify-jwt

# Set API key
supabase secrets set GOOGLE_TRANSLATE_API_KEY=your-key
```

### 7. Run the App

**Custom Development Client (Required for EPUB reader):**

```bash
# Build and run iOS
npx expo run:ios

# Build and run Android
npx expo run:android
```

**Expo Go (Limited - EPUB reader won't work):**

```bash
npm start
# Press 'i' for iOS or 'a' for Android
```

## Development

### Project Structure

```
src/
├── screens/          # 5 main screens
├── components/       # Reusable UI components
├── navigation/       # React Navigation setup
├── supabase/         # DB queries & storage
├── state/            # Zustand stores
├── theme/            # Design tokens
└── utils/            # Helper functions
```

### Running Locally

```bash
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
```

### Code Style

Follow guidelines in [AGENTS.md](./AGENTS.md):
- TypeScript strict mode
- Functional components with hooks
- Centralized Supabase queries
- Theme tokens (no hardcoded colors)
- Explicit error handling

## Architecture

### Data Flow

```
User selects text in Reader
    ↓
Selection toolbar appears (Highlight | Translate)
    ↓
Translate calls Edge Function
    ↓
Edge Function checks translation_cache
    ↓
If cached: Return immediately
If not: Call Google Translate → Cache → Return
    ↓
Show translation in modal
    ↓
User saves to study_words table
```

### Database Schema

- **books** - EPUB metadata (public read)
- **highlights** - User highlights with CFI ranges (user-owned)
- **study_words** - Saved vocabulary (user-owned)
- **translation_cache** - Shared translation cache (service role)
- **user_settings** - User preferences (user-owned)

All user tables protected by Row Level Security (RLS).

## Book Catalog & Content Sourcing (US-first)

### Recommended sources (best UX + legal + scalable)

- **Project Gutenberg (via Gutendex API)**: Primary source for a large, automated, public-domain catalog with usable metadata (authors, languages, subjects/bookshelves, formats).
- **Standard Ebooks**: Secondary “preferred edition” source (smaller catalog, higher-quality EPUBs + cleaner metadata). When the same work exists in both places, prefer Standard Ebooks for reading experience.

### Metadata strategy (for filters/search)

Gutendex gives you:
- **Author(s)**, **language(s)** (ISO codes), **subjects**, **bookshelves**, and format links.

For app UX, plan to normalize into:
- **Authors**: normalize display/sort forms (e.g., “Twain, Mark” → display “Mark Twain”).
- **Genres/Subjects**: map Gutenberg **subjects/bookshelves** into a curated, stable genre taxonomy (so filters don’t explode into thousands of near-duplicates).
- **Language**: treat as first-class filter (users can browse by language, not just translate target).
- **Source attribution**: store `source` + `source_id` (e.g., Gutenberg ID) to support dedupe and attribution.

### Terms / legality notes (US launch)

For a US-first release, the simplest and safest posture is:
- **Only ingest public-domain works intended for US distribution** (e.g., Project Gutenberg / Standard Ebooks).
- **Include clear attribution** in the app/library (e.g., “Source: Project Gutenberg”) and link back when appropriate.
- **State that availability is US-focused** and that public-domain status can vary by jurisdiction.
- **Provide a takedown/contact process** for rights concerns (even if you only ingest PD sources).
- **Disallow user-uploaded copyrighted books** unless you later add explicit licensing workflows.

### If you release outside the US (future restrictions)

Public-domain status varies by country. Before expanding internationally, plan for one of:
- **Geo-restriction** (only show/download books in supported jurisdictions), or
- **Per-country rights rules** (store `rights_region` / `rights_status` per book), or
- **Separate catalogs** by region (US catalog vs international catalog).

At minimum, update Terms + product behavior to:
- **Explain jurisdictional differences** and what regions are supported.
- **Restrict access by region** if needed to stay compliant.
- **Track sources and rights metadata** per book to support auditing and removals.

### Cost Optimization

Translation caching reduces API costs:
- Cache key: `(source_lang, target_lang, normalized_term)`
- Cache hit = $0.00
- Cache miss ≈ $0.00002 per character
- Target: >80% cache hit rate

## Deployment

### Prerequisites

- **Apple Developer account** (iOS) — paid membership required for App Store distribution
- **Google Play Developer account** (Android)
- **Expo account** — [expo.dev](https://expo.dev) (tied to EAS)
- **EAS CLI** — `npm install -g eas-cli`
- **Xcode** (for local iOS builds) — from Mac App Store; command-line tools: `xcode-select --install` if needed
- **Fastlane** (for local iOS builds) — EAS local build uses it to run the iOS build. Install: `brew install fastlane` or `sudo gem install fastlane`
- **CocoaPods** (for local iOS builds) — required for iOS native dependencies. Install: `sudo gem install cocoapods` or `brew install cocoapods`

### One-time setup (EAS + iOS credentials)

1. **Log in to EAS:**  
   `eas login`

2. **Configure the project for EAS Build** (if not already):  
   `eas build:configure`  
   This ensures `eas.json` and native project config exist.

3. **Bundle identifier and team:**  
   Set your iOS **bundle identifier** in `app.json` under `expo.ios.bundleIdentifier` (e.g. `com.yourcompany.yourapp`).  
   Your **Apple Team ID** and signing credentials are managed by EAS. On first build, EAS will prompt to create or select credentials; choose **production** (App Store) distribution when building for release.

4. **Credentials (recommended: let EAS manage):**  
   For local builds, EAS will use credentials stored in your EAS project. Run a build once (e.g. `npm run ios:build:prod`); if credentials are missing, EAS will guide you through generating or uploading a distribution certificate and provisioning profile. No need to manually create them in Apple Developer Portal unless you prefer.

### Local iOS production builds (no cloud queue)

You can build the same production-quality iOS binary locally on your Mac and then submit it to App Store Connect. Output is equivalent to EAS cloud builds; the only difference is that the build runs on your machine (no queue, no cloud build time).

**Scripts (run from repo root):**

| Command | Description |
|--------|-------------|
| `npm run ios:build:prod` | Run EAS local iOS production build. Writes the `.ipa` to `./build/ios/` and records its path in `./build/ios/latest.txt`. Prints the IPA path at the end. |
| `npm run ios:submit:prod` | Submit the IPA from `./build/ios/latest.txt` to App Store Connect (production profile). Requires `ascAppId` in `eas.json` (see below) or run once interactively so EAS can prompt. |
| `npm run ios:release:prod` | Build then submit (build + submit in one go). |

**Requirements:** Xcode, EAS CLI, **Fastlane**, and EAS credentials configured for the project (see one-time setup above). The build uses the `production` profile in `eas.json` (`distribution: "store"`), so the resulting IPA is for App Store distribution, not simulator or ad-hoc.

**Common pitfalls:**

- **Fastlane not installed** — Local EAS iOS builds require Fastlane. Install with `brew install fastlane` (or `sudo gem install fastlane`). If you see `spawn fastlane ENOENT`, Fastlane is missing from your PATH.
- **CocoaPods not installed** — If you see `Cocoapods is not available` or `pod --version exited with non-zero code`, install CocoaPods: `sudo gem install cocoapods` (or `brew install cocoapods`). Ensure `pod` is on your PATH (e.g. after `gem install`, the bin may be in `$(gem environment gemdir)/bin`).
- **Missing or wrong Apple credentials** — EAS will prompt on first build; ensure you select/store a **distribution** certificate and App Store provisioning profile, not development.
- **Wrong bundle ID** — Must match the app in App Store Connect and in `app.json` → `expo.ios.bundleIdentifier`.
- **Wrong team** — If you have multiple teams, EAS may ask which one to use; pick the one that owns the App Store app.
- **Keychain access** — During local build, Xcode may prompt for keychain access; allow so the code signing step can run.
- **Managed workflow** — This setup works without an `ios/` folder in the repo; EAS generates the native project when building.
- **Submission: "Set ascAppId in the submit profile"** — EAS Submit needs your App Store Connect app ID. In **App Store Connect → Your App → App Information**, copy the **Apple ID** (numeric). Set it in `eas.json` under `submit.production.ios.ascAppId` (e.g. `"ascAppId": "1234567890"`). Alternatively, run `npm run ios:submit:prod` without setting it; EAS will run in interactive mode and prompt you to select the app.
- **Libtool / ARCHIVE FAILED (Exit status 65)** — If the archive step fails with a "fatal error" in the Xcode toolchain or "Libtool" in the failed commands, clear Xcode DerivedData and retry: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`. Then run `npm run ios:build:prod` again. Using the latest stable Xcode (and matching iOS SDK) also helps avoid toolchain issues.

### Build & Deploy (cloud)

```bash
# Configure EAS
eas build:configure

# Build for iOS (cloud)
eas build --platform ios --profile production

# Build for Android
eas build --platform android

# Submit to stores (use --path for a specific IPA/APK, or --latest to submit last cloud build)
eas submit --platform ios --profile production --path ./build/ios/your.app.ipa
eas submit --platform android
```

### Pre-Deployment Checklist

- [ ] Database migration run
- [ ] Storage bucket created
- [ ] Edge Function deployed
- [ ] Test book uploaded
- [ ] Book record in database
- [ ] End-to-end testing complete
- [ ] App icons created (replace placeholders)
- [ ] Service role key secured

## Troubleshooting

### "Missing Supabase environment variables"
→ Ensure `.env.local` exists with all 4 variables

### "Failed to load library"
→ Check database migration ran and book records exist

### "Failed to open book"
→ Verify storage bucket exists and EPUB uploaded
→ Check `storage_path` matches uploaded filename

### "Translation failed"
→ Verify Edge Function deployed
→ Check Google API key set as secret

### Reader blank screen
→ Ensure EPUB file is valid
→ Try a different EPUB from [Project Gutenberg](https://www.gutenberg.org/)

## Known Limitations

1. **Highlight Rendering**: Highlights saved to DB but not yet rendered in reader (CFI ranges stored correctly)
2. **Context Snippets**: Currently saved as null (needs text extraction)
3. **Assets**: Placeholder images for icon/splash screen

## Admin Panel

### Overview
The Admin Panel allows designated users to upload EPUB files to the global library, making them available to all users.

### Setup

#### 1. Run Database Migration
Execute in Supabase SQL Editor:
```sql
-- File: supabase/migrations/024_add_admin_and_global_library.sql
```

This adds:
- `admin` column to `user_settings` table
- `is_global` column to `books` table
- Necessary indexes

#### 2. Create Storage Bucket
In Supabase Dashboard → Storage:
1. Click **New bucket**
2. Name: `general-library`
3. Set **Public bucket** to OFF (we'll use RLS policies)
4. Click **Create bucket**

#### 3. Configure Storage Policies (REQUIRED)
Execute in Supabase SQL Editor:
```sql
-- File: supabase/migrations/004_general_library_storage_policies.sql

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to general-library"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'general-library');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read from general-library"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'general-library');

-- Allow public read access (optional - for public books)
CREATE POLICY "Public can read from general-library"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'general-library');

-- Allow updates and deletes
CREATE POLICY "Authenticated users can update general-library"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'general-library')
WITH CHECK (bucket_id = 'general-library');

CREATE POLICY "Authenticated users can delete from general-library"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'general-library');
```

**Important**: Without these policies, you'll get "row-level security policy" errors when uploading.

#### 4. Add Books Table INSERT Policy (REQUIRED)
Execute in Supabase SQL Editor:
```sql
-- File: supabase/migrations/005_books_insert_policy.sql

-- Allow authenticated users to insert books
CREATE POLICY "Authenticated users can insert books"
ON books FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow updates and deletes
CREATE POLICY "Authenticated users can update books"
ON books FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete books"
ON books FOR DELETE
TO authenticated
USING (true);
```

**Important**: Without this policy, you'll get "new row violates row-level security policy for table books" error.

#### 5. Grant Admin Access
```sql
UPDATE user_settings
SET admin = true
WHERE user_id = 'YOUR_USER_UUID';
```

Find your user UUID:
```sql
SELECT id, email FROM auth.users;
```

### Using the Admin Panel
1. Log in with admin account
2. Go to **Settings**
3. Tap **🔧 Admin Panel** (only visible to admins)
4. Upload EPUB files to global library

### Book Metadata
- **Title**: Extracted from filename
- **Language**: Defaults to English (`en`)
- **Author/Cover**: Can be updated in database

## Roadmap

### Current (MVP)
- ✅ EPUB reader
- ✅ Text selection & translation
- ✅ Vocabulary saving
- ✅ Study list
- ✅ Admin panel for global library

### Future
- [ ] Spaced repetition system
- [ ] Highlight rendering in reader
- [ ] Context snippet extraction
- [ ] Multiple highlight colors
- [ ] Reading progress tracking
- [ ] Offline translation support
- [ ] Dark mode
- [ ] Export vocabulary
- [ ] Admin: Book metadata editor
- [ ] Admin: User management

## Contributing

See [AGENTS.md](./AGENTS.md) for code style guidelines and development patterns.

All changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

## Security

- Service role key only used in Edge Functions (never exposed to client)
- RLS policies enforce data isolation
- Signed URLs for private storage access
- Environment variables for all secrets

## License

MIT

---

**Status**: ✅ MVP Complete - Ready for setup and testing  
**Last Updated**: December 27, 2025
