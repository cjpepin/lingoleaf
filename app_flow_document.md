**App Flow Document – Language Learning Book Reader**

---

## 1. Onboarding Flow

1. User lands on `/home`
2. Prompt to log in or sign up
3. If new, user chooses Free or Paid Tier (link to Stripe checkout)
4. Redirect to `/upload` or `/home` after account creation

---

## 2. Book Upload & Library

* From `/upload`, user:

  1. Adds book metadata (title, notes, optional image)
  2. Uploads PDF/EPUB/TXT file
  3. Gets redirect to `/read/[bookId]`
* From `/home`, user can:

  * Browse internal free/premium library
  * Click to read any book they own or have access to

---

## 3. Book Reader Flow

1. User navigates to `/read/[bookId]`
2. Book is rendered
3. User highlights a word/phrase
4. Popup appears:

   * Shows translation
   * Allows adding to vocab list
5. Data saved to highlights + vocab list
6. Points awarded

---

## 4. Vocabulary Flow

* From `/vocab`, user:

  1. Views general list and any folders
  2. Creates, renames, or deletes folders
  3. Adds/removes/edit vocab entries
  4. Accesses `study` mode from any list

---

## 5. Study Flow

* On `/study`:

  1. Select vocab list
  2. Launch flashcard interface
  3. Flip card to reveal translation
  4. Optional: Track correctness

---

## 6. Gamification Flow

1. Points added when:

   * Reading sessions occur
   * Vocab is saved
   * Book is completed
2. Daily goal popup (e.g., “You’ve read 15 minutes today!”)
3. Streak updates at midnight

---

## 7. Forum Flow

* From `/forum/[bookId]`:

  1. User sees post feed for current book
  2. Writes or replies to threads
  3. Can report or flag content
  4. Admins can moderate

---

## 8. Messaging Flow

* Optional access via navbar dropdown or `/messages`

  1. User selects contact or starts new thread
  2. Sends text (min 2 characters)
  3. Can mute, block, or report other users

---

## 9. Admin Flow

* Admin Dashboard (future):

  * Upload internal books
  * View flagged posts/messages
  * Moderate or ban accounts

---

This flow defines the user's journey through reading, learning, and engaging within the app.
