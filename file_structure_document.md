**File Structure Document – Language Learning Book Reader**

---

## 1. Frontend (Next.js w/ App Router)

```
/src
├── app
│   ├── layout.tsx
│   ├── page.tsx (home)
│   ├── account
│   │   └── page.tsx
│   ├── upload
│   │   └── page.tsx
│   ├── vocab
│   │   └── page.tsx
│   ├── study
│   │   └── page.tsx
│   ├── read
│   │   └── [bookId]
│       └── page.tsx
│   └── forum
│       └── [bookId]
│           └── page.tsx
├── components
│   ├── common (Navbar, Sidebar, etc.)
│   ├── book (BookCard, BookUploader, etc.)
│   ├── reader (TextHighlighter, Popup, etc.)
│   ├── vocab (VocabCard, FolderList, etc.)
│   ├── forum (PostEditor, CommentList, etc.)
├── hooks
│   ├── useAuth.ts
│   ├── useTranslation.ts
│   ├── useBookReader.ts
├── lib
│   ├── supabaseClient.ts
│   ├── api.ts (wrapper for API calls)
├── types
│   ├── book.ts
│   ├── vocab.ts
│   ├── user.ts
├── styles
│   └── globals.css
├── utils
│   └── formatter.ts
```

---

## 2. Backend (Supabase)

```
supabase/
├── sql/
│   ├── tables.sql
│   ├── functions.sql
├── functions/
│   ├── uploadBook/index.ts
│   ├── translateAndCache/index.ts
│   ├── webhookStripe/index.ts
├── storage/
│   ├── books/
│   ├── covers/
```

---

This structure ensures modularity, readability, and clear separation of concerns for a scalable language learning app.
