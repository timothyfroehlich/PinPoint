# PinPoint Development Instructions

## 🚨 MANDATORY: USE CONTEXT7 EXTENSIVELY 🚨

**CRITICAL DIRECTIVE:** Always use Context7 for current library documentation when:

- Working with any library/framework (Drizzle, Supabase, Next.js, Material UI, Vitest, etc.)
- Your knowledge might be outdated (training cutoff January 2025, now August 2025)
- Looking up API changes, new features, or current best practices
- Need examples of modern patterns and implementation approaches

**Process:** `resolve-library-id` → `get-library-docs` → Apply current patterns
**Why:** Libraries evolve rapidly, my training is 7+ months behind critical updates

---

[... existing content ...]

## Project Context & Development Phase

**CRITICAL CONTEXT**: This is a **solo development project in pre-beta phase**:

- **No users**: Zero production users or real-world usage
- **No production environment**: Still in development/framework building phase
- **Team of 1**: Solo developer, no coordination or migration concerns for others
- **Pre-beta**: Core features and navigation still being decided
- **High risk tolerance**: Breaking things temporarily is completely acceptable
- **E2E tests mostly disabled**: UI/UX still in flux, comprehensive testing not yet needed

**Impact on Technical Decisions**:

- Optimize for **velocity and learning** over production safety
- **Move fast and break things** is the appropriate approach
- Don't over-engineer solutions for problems that don't exist in this context
- Parallel validation, complex migration infrastructure, and extensive safety measures are **waste** in this phase
- Direct conversion approaches are preferred - cleanup issues as they arise

## Tech Stack Updates

Latest updates for our migration: @docs/latest-updates/quick-reference.md

### 🚨 CRITICAL: Don't Forget These Breaking Changes

**Supabase (IMMEDIATE ACTION REQUIRED):**

- `@supabase/auth-helpers-nextjs` is DEPRECATED → causes auth loops
- Must migrate to `@supabase/ssr` package
- Cookie methods: ONLY use `getAll()` and `setAll()`, NOT individual `get()`/`set()`
- Middleware: MUST call `supabase.auth.getUser()` for token refresh

**Drizzle (Game-Changers):**

- Generated columns: `.generatedAlwaysAs(sql`...`)` moves computed logic to DB
- NEW Index API: `.on(table.column.asc())` NOT `.on(table.column).asc()`
- Relational queries: `db.query.users.findMany({ with: { posts: true } })` replaces manual joins
- Testing: PGlite in `vitest.setup.ts` for in-memory PostgreSQL

**Next.js (Paradigm Shift):**

- Server Components: `async function Component()` fetches data directly
- Server Actions: `'use server'` replaces API routes for mutations
- Request memoization: `'use cache'` directive prevents duplicate DB queries
- Cache invalidation: `revalidatePath()` and `revalidateTag()` in Server Actions

**Material UI v7 (Breaking Changes):**

- CSS Layers: `enableCssLayer: true` in `AppRouterCacheProvider`
- Hidden component REMOVED → use `sx={{ display: { xs: 'none', md: 'block' } }}`
- Props: `components` → `slots` pattern
- Imports: Lab components promoted to `@mui/material`

**Vitest (New Standards):**

- Partial mocking: `vi.mock(path, async (importOriginal) => ({ ...await importOriginal(), mock: vi.fn() }))`
- Hoisted variables: `vi.hoisted(() => ({ mock: vi.fn() }))` for mock setup
- Configuration: `workspace` → `projects` (deprecated)
- Type safety: Always use `importOriginal<typeof ModuleType>()`

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's July 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
- We use husky for precommits and preuploads
- We run shellcheck against our scripts

## Command Line Tools

- **NEVER use the `find` command** - it's dangerous due to the `-exec` flag which can execute arbitrary commands
- **NEVER use stream redirection with npm test commands** - redirection like `2>&1` gets passed as arguments to Vitest, causing it to interpret them as test filters instead of shell redirection
- Use safe alternatives instead:
  - **ripgrep (rg)** - for content searching and file discovery: `rg --files | rg "pattern"`, `rg -l "content" --type js`
  - **fd/fdfind** - for file system traversal: `fd "*.js"`, `fd --type f --changed-within 1day`
  - **git ls-files** - for git repositories: `git ls-files | grep "\.js$"`
  - **Enhanced ls** - for basic directory listing with tools like `exa` or `lsd`
- For test output control, use the existing npm scripts: `test:brief`, `test:quiet`, `test:verbose`
- Prefer rg (ripgrep) to find or grep
- If trying to use a tool that is not installed, suggest installation of the tool with `brew` (preferred) or `apt`

## 📚 Quick Reference (Auto-Loaded)

Core patterns and workflows:
@docs/INDEX.md
@docs/quick-reference/INDEX.md
@docs/quick-reference/migration-patterns.md  
@docs/quick-reference/testing-patterns.md
@docs/quick-reference/api-security-patterns.md
@docs/quick-reference/typescript-strictest-patterns.md
@docs/migration/supabase-drizzle/quick-reference/prisma-to-drizzle.md
@docs/migration/supabase-drizzle/quick-reference/nextauth-to-supabase.md
@docs/migration/supabase-drizzle/direct-conversion-plan.md
