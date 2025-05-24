**Project Requirements Document – Language Learning Book Reader**

---

## 1. Project Objective

Build a web-based language learning app that allows users to read full books, highlight unknown words/phrases, translate them with contextual awareness, and save them into custom vocabulary lists for future study.

---

## 2. Core Functional Requirements

### 2.1 Authentication & Roles

* Email/password login via Supabase Auth
* Two roles:

  * **Admin**: Full content and user control
  * **Customer**:

    * Free Tier: Limited access
    * Paid Tier: Full access (rate-limited)

### 2.2 Book Management

* Upload PDF, EPUB, TXT
* Metadata: Title, file, optional cover image, optional notes (max 256 chars)
* Library types:

  * Personal (user-uploaded)
  * Internal (admin-provided)
* Free tier: 3 personal uploads max
* Paid tier: Unlimited (rate-limited)

### 2.3 Custom Reader

* Page and chapter navigation
* Highlighting
* Popup UI for translation + vocab saving

### 2.4 Translation & Vocab

* Translate using Google Translate API
* Store all translations in internal DB (with multi-variant support)
* Save to general list or user-created folders
* Vocabulary folder limits:

  * Free: 3 folders
  * Paid: Unlimited (rate-limited)

### 2.5 Study Tools

* Flashcard study interface

### 2.6 Gamification

* Points for reading, saving vocab, completing books
* Daily goals and streaks
* Redeemable rewards (vanity + utility)

### 2.7 Social Features

* Forum per book (markdown + image support)
* User messaging (with mute, block, report)

### 2.8 Admin Controls

* Manage users, books, reports, moderation

---

## 3. Non-Functional Requirements

* Secure and compliant user data handling
* Scalable infrastructure for book rendering and translation caching
* Fast search/filter on vocab, books
* Responsive and mobile-friendly UI
* Optional offline support (mobile priority)

---

## 4. Out-of-Scope (MVP)

* OCR for scanned books (future feature)
* In-app tutoring
* Voice-based learning

---

## 5. Target Users

* Language learners, starting with Romance languages (Spanish, French, Italian, etc.)
* Casual and committed readers
* Students and autodidacts

---

## 6. Success Metrics

* User retention beyond 14 days
* Vocabulary growth per user
* Daily reading time
* Forum engagement rates

---

This PRD sets the foundation for backend, frontend, and implementation docs.
