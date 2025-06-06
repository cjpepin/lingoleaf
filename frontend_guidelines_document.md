**Frontend Guidelines Document – LinguaLeaf**

---

## 1. Framework & Tools

* **Framework**: Vite + React (React Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Animation**: Framer Motion
* **Forms**: React Hook Form
* **State Management**:

  * Local UI: Zustand
  * Async data: React Query (TanStack)

---

## 2. Page Structure

### Layout

* Shared components:

  * Navigation bar
  * Sidebar (optional mobile toggle)
  * Footer
* Layout wrapper used for protected routes

### Key Routes

* `/home`
* `/account`
* `/vocab`
* `/study`
* `/upload`
* `/read/[bookId]`
* `/forum/[bookId]`

---

## 3. Component Guidelines

* **Atomic design**: Break into atoms (buttons), molecules (cards), organisms (book list)
* **Reusable logic**: Extract hooks (`useBookReader`, `useTranslation`) where needed
* **Accessibility**: All components should follow basic a11y practices
* **Dark mode**: Optional, but components should use tailwind classes to support it (e.g., `dark:bg-gray-900`)

---

## 4. Reader Component Guidelines

* Custom-built PDF/EPUB/TXT reader
* Features:

  * Page navigation with swiping or arrows
  * Highlight text by click & drag
  * Non-obstructive popup after highlight for translation
* Stretch goal: adjustable font size and background color

---

## 5. Vocabulary Features

* Flashcard UI

  * One word per card
  * Show/hide translation
  * Flip interaction with Framer Motion
* List view for editing folders and words

---

## 6. API Interaction

* Use `React Query` for fetching, caching, and mutations
* Global error handling with toasts or alert modals
* Type-safe API types using Supabase client auto-generation

---

## 7. UX Goals

* Fast, mobile-first interactions
* Instant feedback on actions (vocab saved, point awarded, etc.)
* Friendly but not gamified cartoon UI (unless expanded later)

---

## 8. Testing

* Unit: Jest + React Testing Library
* E2E: Cypress (optional for MVP)

This setup ensures a modular, responsive, and user-centric UI architecture.
