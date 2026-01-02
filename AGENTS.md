# AGENTS.md - LinguaLeaf Development Guidelines

## Code Style & Conventions

### General Principles
- **Concise over verbose**: Prefer clear, minimal code
- **Type-safe**: Use TypeScript strictly, avoid `any`
- **Functional patterns**: Prefer hooks, pure functions, and immutability
- **Single responsibility**: Each file/function does one thing well

### File Organization
- One component per file
- Co-locate types with their usage
- Group related utilities in single files
- Keep files under 200 lines when possible

### Naming Conventions
```typescript
// Components: PascalCase
LibraryScreen.tsx
BookListItem.tsx

// Hooks: camelCase with 'use' prefix
useSettingsStore.ts
useBookDownload.ts

// Utils/helpers: camelCase
normalize.ts
cache.ts

// Types: PascalCase with descriptive names
Book, StudyWord, TranslationResponse

// Constants: SCREAMING_SNAKE_CASE
MAX_SELECTION_LENGTH = 40
```

### TypeScript Style
```typescript
// Prefer interfaces for objects
interface Book {
  id: string;
  title: string;
  author?: string;
}

// Prefer type for unions/intersections
type BookStatus = 'downloading' | 'cached' | 'error';

// Use strict null checks - no optional chaining abuse
const title = book?.title ?? 'Untitled';

// Explicit return types for functions
async function fetchBooks(): Promise<Book[]> {
  // ...
}
```

### React/React Native Patterns
```typescript
// Functional components with typed props
interface Props {
  bookId: string;
  onPress: (id: string) => void;
}

export function BookListItem({ bookId, onPress }: Props) {
  // Early returns for loading/error states
  if (!bookId) return null;
  
  // Hooks at top
  const [loading, setLoading] = useState(false);
  
  // Handlers below hooks
  const handlePress = useCallback(() => {
    onPress(bookId);
  }, [bookId, onPress]);
  
  // Render
  return <TouchableOpacity onPress={handlePress}>...</TouchableOpacity>;
}
```

### Supabase Patterns
```typescript
// Centralize queries in /supabase/queries.ts
export async function fetchUserBooks(userId: string) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId);
    
  if (error) throw error;
  return data;
}

// Use service role only in Edge Functions
// Client uses anon key + RLS
```

### Error Handling
```typescript
// Explicit error handling, no silent failures
try {
  const books = await fetchBooks();
  return books;
} catch (error) {
  logger.error('Failed to fetch books', error);
  throw new Error('Could not load library');
}

// Show user-friendly errors in UI
if (error) {
  return <EmptyState message="Could not load books" />;
}
```

### State Management
```typescript
// Zustand for global state (settings, auth)
interface SettingsStore {
  targetLang: string;
  setTargetLang: (lang: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  targetLang: 'en',
  setTargetLang: (lang) => set({ targetLang: lang }),
}));

// Local state for component-specific data
const [selection, setSelection] = useState<Selection | null>(null);
```

### Styling
```typescript
// Use StyleSheet.create for performance
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
});

// Reference theme tokens, never hardcode colors
import { colors, spacing, typography } from '@/theme';
```

### Comments
```typescript
// Only comment WHY, not WHAT
// Good:
// Cache normalized term to reduce API calls
const normalized = term.toLowerCase().trim();

// Bad:
// Set the term to lowercase
const normalized = term.toLowerCase();

// Document complex logic
/**
 * Restores highlights from CFI ranges.
 * CFI (Canonical Fragment Identifier) anchors highlights to specific
 * positions in the EPUB regardless of rendering.
 */
function restoreHighlights(cfiRanges: string[]) {
  // ...
}
```

### Testing Strategy (MVP)
- Manual testing for MVP
- Add error boundaries for crash prevention
- Log errors for debugging
- Test on real iOS device before considering done

### Git Commits
- Small, atomic commits
- Present tense: "Add translation cache" not "Added translation cache"
- Reference task numbers when applicable

### Performance
- Memoize expensive computations
- Use `useCallback` for callbacks passed to children
- Lazy load screens with React Navigation
- Cache downloaded EPUBs aggressively

### Security
- Never commit API keys or secrets
- Use environment variables for config
- Trust RLS policies, not client-side checks
- Validate all user input

### MVP Constraints
- iOS-first: test on iOS, Android nice-to-have
- No premature optimization
- Ship working > ship perfect
- Defer non-essential features ruthlessly

## Documentation Philosophy

### Single Source of Truth
- **README.md** is the primary documentation file
- Update README.md as features are added or changed
- **DO NOT** create new markdown files (SETUP.md, DEPLOYMENT.md, etc.)
- Keep README concise with clear sections

### README Structure
```markdown
# Project Name
Brief description

## Features
- List of key features

## Setup
Quick setup instructions

## Development
How to run locally

## Deployment
How to deploy to production

## Architecture
High-level overview

## Contributing
Code style and patterns (link to AGENTS.md)
```

### When to Create New Files
- **NEVER** create documentation files like:
  - SETUP.md, DEPLOYMENT.md, QUICKSTART.md
  - IMPLEMENTATION_SUMMARY.md, STATUS.md, PROJECT_OVERVIEW.md
  - Any other .md files except README.md
- **ONLY** acceptable markdown files:
  - README.md (primary documentation)
  - AGENTS.md (code style guidelines)
  - CHANGELOG.md (change history)
  - MVP plan or spec documents (if provided by user)

### Updating Documentation
- When adding features: Update relevant section in README.md
- When changing architecture: Update Architecture section in README.md
- When adding setup steps: Update Setup section in README.md
- Keep it concise - aim for scannable, actionable content

### Changelog Tracking
- **CHANGELOG.md** tracks all changes with metadata
- Add entry for every feature, fix, or significant change
- Format: `[YYYY-MM-DD] [TYPE] Description (files affected)`
- Types: FEAT, FIX, REFACTOR, PERF, STYLE, DOCS, TEST, CHORE, DB, FUNC, BREAKING
- Example: `[2025-12-27] [FEAT] Add dark mode (src/theme/colors.ts, src/screens/SettingsScreen.tsx)`
- Keep entries concise (one line per change)

## Development Workflow

1. **Start with types**: Define interfaces before implementation
2. **Build incrementally**: Follow milestone order in MVP plan
3. **Test as you go**: Don't accumulate untested code
4. **Refactor immediately**: Don't defer obvious improvements
5. **Document in README**: Update README.md as the app develops, don't create new MD files

## File Header Template
```typescript
/**
 * ComponentName
 * 
 * Brief description of purpose.
 * Key behaviors or constraints.
 */
```

## Dependencies Philosophy
- Prefer Expo-compatible packages
- Minimize dependencies
- Use proven libraries (React Navigation, Zustand)
- Avoid experimental packages for core features

---

**Last updated**: 2025-12-27
**Applies to**: LinguaLeaf MVP (Expo + Supabase + EPUB Reader)

