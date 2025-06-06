**File Structure Document – Language Learning Book Reader**

---

## 1. Frontend (Vite + React)

```
/src
├── pages
│   ├── Index.tsx (home)
│   ├── Account.tsx
│   ├── Upload.tsx
│   ├── Vocab.tsx
│   ├── Study.tsx
│   ├── ReadBook.tsx
│   ├── Admin.tsx
│   └── Upgrade.tsx
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
├── integrations
│   └── supabase
│       ├── client.ts
│       └── types.ts
├── lib
│   ├── supabaseClient.ts
│   ├── api.ts (wrapper for API calls)
├── types
│   ├── book.ts
│   ├── vocab.ts
│   ├── user.ts
├── utils
│   └── translate.ts
├── App.tsx
├── main.tsx
├── styles
│   └── globals.css
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
