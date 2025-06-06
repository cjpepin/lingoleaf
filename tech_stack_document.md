**Tech Stack Document – LinguaLeaf**

---

## 1. Frontend

* **Framework**: Vite + React
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **State Management**: React Query + Zustand (or Context API for simple global state)
* **PDF/EPUB/TXT Viewer**: Custom implementation (not react-pdf)
* **Flashcards/Animations**: Framer Motion

---

## 2. Backend

* **Database**: Supabase (PostgreSQL)
* **Auth**: Supabase Auth (email/password)
* **Storage**: Supabase Storage (for book files and cover images)
* **API Layer**: Supabase RPC or Edge Functions (Node-based)
* **Rate Limiting**: Via Supabase RLS + function logic

---

## 3. Translation API

* **Primary**: Google Translate API
* **Fallbacks (future optional)**: DeepL API, LibreTranslate
* **Translation Context**: Sentence-level request

---

## 4. Payments

* **Stripe**

  * Monthly recurring billing
  * Webhook listening for events
  * Secure tier management updates on payment success

---

## 5. Analytics

* Supabase table tracking for:

  * Book opens/completions
  * Vocabulary usage
  * Forum interactions
* Optional external layer: PostHog (if event-based tracking needed)

---

## 6. AI & Enhancements (Stretch Goals)

* OpenAI or Anthropic API for:

  * Chapter summarization
  * Auto flashcard generation
  * Quiz interactions

---

## 7. Mobile Roadmap

* **Framework**: Expo + React Native
* **Offline Support**: Local DB w/ syncing (SQLite, MMKV)

---

This tech stack balances developer velocity, cost-efficiency, and future AI extensibility.
