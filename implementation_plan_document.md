**Implementation Plan – Language Learning Book Reader (Full Feature Set)**

---

## Phase 1: Infrastructure & Authentication (Weeks 1–2)

* Set up Supabase project

  * Tables: users, books, highlights, vocabulary lists, vocabulary entries, forum posts, messages
  * Storage: buckets for book files and cover images
  * Row-level security (RLS) and access policies
* Initialize Next.js project (App Router) with TypeScript

  * Install and configure: Tailwind, Zustand, React Query
  * Create Supabase client utility
* Implement Supabase Auth

  * Email + password login
  * Role & tier (free/paid) management
* Set up Stripe for billing

  * Create product tiers and webhooks

---

## Phase 2: Book Upload & Reader Experience (Weeks 3–4)

* Build `/upload` page for users to upload books

  * Support: PDF, EPUB, TXT formats
  * Fields: title, file, optional image, optional notes
  * Free users: limit to 3 uploads; paid: unlimited (rate-limited)
* Build custom reader `/read/[bookId]`

  * Render content by file type
  * Chapter/page navigation
  * Text selection and highlighting system
  * Popup UI for translations and save-to-vocab

---

## Phase 3: Translation & Vocabulary (Weeks 5–6)

* Integrate Google Translate API (primary)

  * Context-aware translations
  * Caching results in internal DB
  * Fallback logic for missing data
* Build vocabulary management interface `/vocab`

  * General list + user folders
  * Folder management: create, rename, delete, move
  * Entry: add/remove words, add notes
  * Limits: Free (3 folders), Paid (unlimited with rate limit)
* Build `/study` flashcard UI

  * Flip interaction with translation toggle
  * Use React Query for vocab data

---

## Phase 4: Gamification & Points System (Week 7)

* Points tracking table and logic

  * Actions: reading time, vocab saved, book completed
  * Variable point values based on task difficulty
* Build streak tracker and daily goals

  * Scheduled check/reset via edge function or cron
* Points feedback component in UI (header, modal, etc.)

---

## Phase 5: Social & Community (Weeks 8–9)

* Implement book-based discussion forum `/forum/[bookId]`

  * Markdown, link, image support
  * Sort by latest/most liked
* Add user-to-user messaging system

  * Real-time or polling messages
  * Controls: block, mute, report
* Moderation tools for admins:

  * Delete/flag forum posts and messages

---

## Phase 6: Admin Panel & Public Library (Week 10)

* Internal book upload interface (admin only)
* Free/premium visibility toggle for each title
* Analytics dashboard (basic)

  * Books read, vocab growth, reading time
* User role/tier control panel

---

## Phase 7: AI & Insights (Week 11–12)

* Optional features:

  * AI-generated flashcards with context sentences
  * Chapter summarization via OpenAI
  * AI chatbot quiz companion for books
* Behavioral insights module

  * Track most-read titles, reading patterns, growth trends
  * Allow opt-out in profile settings

---

## Phase 8: QA, Docs, and Launch (Week 13)

* Full QA testing across all flows
* Write deployment and maintenance documentation
* Finalize onboarding flow and basic tutorial system
* Deploy MVP to production with tracking and feedback tools

---

## Stretch Goals (Post-Launch Sprints)

* Mobile app (React Native + Expo)
* Offline reading and vocab support
* Personalized learning dashboard
* Mini-games and advanced studying methods
* Community-contributed content moderation tools

---

This structured plan supports Lovable in building a robust, scalable, and engaging platform for language learners across reading, vocabulary, and community experiences.
