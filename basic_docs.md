**Language Learning Book Reader App – MVP Specification**

---

## 1. Overview

Create a web-based application that enables users to read full-length books, highlight unknown words/phrases, receive contextual translations, and save them into personal vocabulary lists for study. The MVP will prioritize Spanish as the target language, but the system should be built with support for multiple languages in mind.

---

## 2. Core Features

### 2.1 User Roles

* **Admin**
* **Customer**

  * Free Tier
  * Paid Tier

### 2.2 Authentication

* Supabase Auth (Email + Password)

---

## 3. Reading Experience

### 3.1 Supported Formats

* PDF
* EPUB
* TXT

### 3.2 Uploading Books

* Users can upload books with:

  * Name
  * File (PDF/EPUB/TXT)
  * Optional Cover Image
  * Notes (max 256 characters)

* Upload Limits:

  * Free Tier: 3 books
  * Paid Tier: Unlimited (rate-limited)

### 3.3 Admin Library

* Admins can upload books into:

  * Free Tier Library
  * Premium Library

### 3.4 Custom Reader

* Implement a custom reader for all supported formats with:

  * Smooth page/chapter navigation
  * Highlighting capability
  * Popup translator UI that shows above/around selected text without obstructing reading

---

## 4. Vocabulary Features

### 4.1 Translation

* Contextual translation using Google Translate API
* Cache all translations in internal database
* Store multiple translations per word/phrase
* Character limit on long phrases

### 4.2 Vocabulary Lists

* General vocabulary list

* User-created folders:

  * Create, rename, delete
  * Add/remove/move vocab words
  * Add notes to words

* Limits:

  * Free Tier: 3 folders
  * Paid Tier: Unlimited (rate-limited)

### 4.3 Study Mode

* Basic flashcard interface for studying saved vocab

---

## 5. Points & Gamification

### 5.1 Point System

* Earn points for:

  * Reading time
  * Vocabulary saved
  * Books completed

* Point usage:

  * Vanity rewards (badges)
  * Utility features (e.g., themes, studying boosters)

### 5.2 Streaks & Goals

* Daily reading goals
* Weekly streak tracking

---

## 6. Social Features

### 6.1 Forum

* One discussion forum per book
* Supports:

  * Markdown formatting
  * Images/media
* Admin moderation: delete posts, lock threads

### 6.2 Messaging

* Direct messaging between users
* Features:

  * Minimum 2-character message limit
  * Mute, block, report functionality

---

## 7. Pages & Routing

### 7.1 Routes

* `/home`: Landing page with featured library, account, study links
* `/account`: Subscription management, settings
* `/vocab`: Vocabulary folders and entries
* `/study`: Flashcards and study features
* `/upload`: Upload and manage personal library

---

## 8. Payments

### 8.1 Subscription

* Free Tier: No cost
* Paid Tier:

  * Stripe monthly subscription
  * Billing based on initial payment date

---

## 9. Admin Features

* Manage users
* Upload/manage internal libraries
* Moderate forums/messages
* View user analytics:

  * Books read
  * Reading sessions
  * Vocabulary growth

---

## 10. Analytics

* Track and store:

  * Most-read books
  * Time spent reading
  * Vocabulary added
* Users can opt out of tracking in profile settings

---

## 11. Mobile App Plan

* Mirror full web app experience
* Add offline support for reading and vocab review

---

## 12. AI-Enhanced Features (Optional for MVP)

* Flashcard auto-generation from vocab list
* Chapter summarization
* AI tutors to quiz user on current book content

---

## 13. Terms & Data Use

* Public domain books to start
* Partner/licensed books possible via future agreements
* No sale of identifiable user data
* May sell anonymized usage data (disclosed in T\&Cs)

---

## 14. Stack

* **Frontend**: Next.js (TypeScript)
* **Backend/DB**: Supabase
* **Auth**: Supabase
* **Payments**: Stripe
* **Translation**: Google Translate API (with flexibility to swap in alternatives)

---

## 15. Stretch Goals (Post-MVP)

* OCR support for scanned PDFs
* AI-based contextual grammar suggestions
* Language challenges/mini games
* Community translation improvements/ratings

---

This spec is now optimized for Lovable or any AI product planner to generate tasks, flows, or mockups. Let me know if you'd like to break this into epics or user stories next.
