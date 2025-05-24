**Backend Structure Document – LinguaLeaf**

---

## 1. Platform

* **Database**: Supabase (PostgreSQL)
* **API Layer**: Supabase functions (RPC, row-level security)
* **Auth**: Supabase Auth (email + password)
* **Payments**: Stripe integration via secure webhook endpoints
* **Translation**: Google Translate API (with caching logic)

---

## 2. Core Tables

### 2.1 Users

* `id`: UUID (primary key)
* `email`: string
* `role`: enum (admin, customer)
* `tier`: enum (free, paid)
* `points`: int
* `streak`: int
* `created_at`, `updated_at`

### 2.2 Books

* `id`: UUID
* `owner_id`: UUID (nullable for admin books)
* `title`: string
* `file_path`: string
* `cover_image_url`: string (nullable)
* `notes`: string (nullable, max 256)
* `access_level`: enum (free, paid, personal)
* `created_at`, `updated_at`

### 2.3 Highlights

* `id`: UUID
* `book_id`: UUID
* `user_id`: UUID
* `text`: string
* `translated_text`: string
* `translation_source`: enum (cache, api)
* `created_at`

### 2.4 VocabularyLists

* `id`: UUID
* `user_id`: UUID
* `name`: string
* `note`: string (nullable)
* `created_at`, `updated_at`

### 2.5 VocabularyEntries

* `id`: UUID
* `list_id`: UUID
* `text`: string
* `translation`: string
* `note`: string (nullable)
* `created_at`

### 2.6 ForumPosts

* `id`: UUID
* `book_id`: UUID
* `user_id`: UUID
* `content`: text
* `is_flagged`: boolean
* `created_at`

### 2.7 Messages

* `id`: UUID
* `sender_id`: UUID
* `recipient_id`: UUID
* `content`: string
* `is_flagged`: boolean
* `created_at`

### 2.8 AdminActions

* `id`: UUID
* `admin_id`: UUID
* `target_type`: enum (user, post, message, book)
* `target_id`: UUID
* `action_type`: enum (delete, lock, warn, ban)
* `timestamp`

---

## 3. API Endpoints (Supabase RPC/Edge Functions)

### Books

* `upload_book`
* `delete_book`
* `get_books_by_user`
* `get_admin_library`

### Highlights & Translations

* `translate_and_cache`
* `get_highlights_by_book`
* `save_highlight`

### Vocabulary

* `create_vocab_list`
* `add_vocab_entry`
* `delete_vocab_entry`
* `get_vocab_for_user`

### Forum & Messaging

* `create_post`
* `moderate_post`
* `send_message`
* `report_message`

### Gamification

* `increment_points`
* `update_streak`

### Stripe Integration

* `webhook_payment_success`
* `upgrade_user_tier`

---

## 4. Caching Layer (Optional / Stretch Goal)

* Translation cache could use Postgres or Redis depending on load

---

## 5. Security

* Row-level security policies for each table
* Role-based access controls
* Auth guards for endpoints

---

Future expansions may introduce: OCR pipeline, AI quiz engines, or socket-based real-time chat.
