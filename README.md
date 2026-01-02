# LinguaLeaf

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

- Apple Developer account (iOS)
- Google Play Developer account (Android)
- EAS CLI: `npm install -g eas-cli`

### Build & Deploy

```bash
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
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
-- File: supabase/migrations/add_admin_and_global_library.sql
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
