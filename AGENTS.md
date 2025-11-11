# PinPoint Agent Guidelines

## About the User

The user's name is Tim and his GitHub account is "timothyfroehlich".

Tim is vibecoding this app by himself to learn about website design and experiment with agentic coding. Tim has never coded in Java/TypeScript before. When a decision is needed, the agent should provide some explanation about the options, pros and cons. Review comments on GitHub PRs can be assumed to have been written by coding agents. Their comments must be taken as suggestions and with a grain of salt. Don't assume that the agent who wrote the comment had the full context to fully understand the problem.

## Critical Context Files

Read these immediately before starting work:

- **`docs/NON_NEGOTIABLES.md`** - Forbidden patterns and critical constraints
- **`docs/PATTERNS.md`** - Project-specific code patterns (MUST reference when coding)
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Type safety patterns
- **`docs/PRODUCT_SPEC.md`** - What we're building (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture specification
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`package.json`** - Available scripts, dependencies, configuration

## Archived v1 Codebase (`.archived_v1/`)

The `.archived_v1/` directory contains the complete production multi-tenant PinPoint v1 application (version 0.2). This is **reference material only** - do not copy code directly from it.

### What's in the Archive

- **Complete Next.js 16 app** - Pages Router with tRPC API layer
- **Multi-tenant architecture** - Organization scoping, RLS policies, complex auth flows
- **617-line ESLint config** - 5 custom rules, multiple security plugins, architectural enforcement
- **Comprehensive testing** - Vitest, Playwright, PGlite, RLS tests
- **Production patterns** - Error boundaries, loading states, structured logging
- **96 package.json scripts** - Database management, security scanning, multi-environment support

### How to Use the Archive

**✅ DO:**

- Look at it for **inspiration** - "How did v1 solve this problem?"
- Compare **patterns** - "Should we use a similar approach?"
- Learn from **decisions** - "Why did v1 evolve this complexity?"
- Reference **configurations** - "What ESLint rules did they add and why?"
- Understand **what problems you'll eventually face** - "When should we add security plugins?"

**❌ DON'T:**

- Copy code blindly - v1 is multi-tenant, v2 is single-tenant
- Add v1's complexity prematurely - those patterns evolved from real pain points
- Implement v1's abstraction layers - DAL, tRPC, service layers aren't needed yet
- Port v1's custom ESLint rules - wait until you see the same violation 3+ times
- Replicate v1's 96 scripts - add scripts when you actually need them

### Key Differences v1 → v2

| Aspect          | v1 (Archived)               | v2 (Current)                                |
| --------------- | --------------------------- | ------------------------------------------- |
| **Tenancy**     | Multi-tenant with RLS       | Single-tenant, no RLS                       |
| **API Layer**   | tRPC procedures             | Direct Drizzle in Server Components/Actions |
| **Data Access** | DAL + repository pattern    | Direct queries (Rule of Three)              |
| **Auth**        | Supabase SSR + RLS policies | Supabase SSR only                           |
| **Router**      | Pages Router                | App Router                                  |
| **Testing**     | 150+ tests with RLS         | Building progressively (PR 5)               |
| **ESLint**      | 617 lines, 5 custom rules   | 20 high-value rules (grows as needed)       |
| **Complexity**  | Production-ready enterprise | MVP greenfield simplicity                   |

### Example: ESLint Evolution

**v1 has:**

- Custom rule: `no-duplicate-auth-resolution` (catches calling getUser() twice)
- Custom rule: `no-missing-cache-wrapper` (enforces React cache() on fetchers)
- Security plugins detecting eval(), SQL injection, XSS patterns
- Architectural boundary rules preventing DAL cross-imports

**v2 starts with:**

- Core type safety (no any, explicit return types)
- Promise handling (prevents fire-and-forget bugs)
- Unused imports cleanup

**When to add v1's rules to v2:** After you've encountered the problem 3+ times and established the pattern to enforce.

### Using Archive for Decision Making

When facing a decision, ask:

1. **Did v1 solve this?** Look in archive for reference
2. **Why did v1 do it that way?** Understand the context (multi-tenant, production scale)
3. **Do we need that complexity now?** Usually no - MVP first, complexity later
4. **What's the v2 equivalent?** Adapt for single-tenant, simpler architecture

**Example:** v1 has a `createOrganizationContext()` function that wraps every data access. We don't need that in v2 because we're single-tenant - just query Drizzle directly.

**Remember:** The archive shows you what PinPoint **becomes** at production scale with multiple tenants. Start simple and evolve toward that complexity only when real needs demand it.

## Project Context

### Status

- **Phase**: Greenfield rewrite (v2), pre-beta
- **Users**: Zero production users
- **Development**: Solo passion project, high risk tolerance for breaking changes
- **Core Value**: "Allow the Austin Pinball Collective to log issues with pinball machines, track work and resolve them."

### Technology Stack

- **Frontend**: Next.js 16, React 19 Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: Drizzle ORM, PostgreSQL via Supabase
- **Authentication**: Supabase SSR (no RLS for single-tenant)
  - **Note**: Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new format: `sb_publishable_xxx`). Legacy `ANON_KEY` deprecated by July 2026.
- **Testing**: Vitest, Playwright, worker-scoped PGlite
- **Language**: TypeScript with strictest configuration

### Architecture Type

**Single-Tenant**: One organization (Austin Pinball Collective), no multi-tenant complexity, no organization scoping required, no RLS policies.

## Critical Constraints

### Non-Negotiable Patterns

- **Memory safety**: Worker-scoped PGlite instances only (per-test instances cause system lockups)
- **No migration files**: Pre-beta has zero users, schema changes via direct modification only
- **Schema lock**: Code adapts to schema, never modify schema to fix TypeScript errors
- **Server-first**: Default to Server Components, minimal Client Components
- **shadcn/ui only**: No MUI components for new development
- **Issues always per-machine**: Every issue must have exactly one machine (CHECK constraint)
- **Severity naming**: `minor` | `playable` | `unplayable` (player-centric language)
- **Progressive enhancement**: Forms must work without JavaScript

### Library Knowledge Gap

- **Training Cutoff**: January 2025, current date November 2025 - 10 months behind
- **Required Libraries**: Drizzle, Supabase, Next.js, shadcn/ui, Server Components, Server Actions, Vitest
- **Process**: Use Context7 (`resolve-library-id` → `get-library-docs`) before implementation

## Architecture Directives

### Server-First Principles

- **Default**: Server Components for all new development
- **Client Islands**: Minimal "use client" for specific interactivity only
- **Data Flow**: Server Components → Drizzle → PostgreSQL (direct queries, no DAL/repository layers)
- **Mutations**: Server Actions with progressive enhancement

### Direct Database Queries

- **Do**: Query Drizzle directly in Server Components and Server Actions
- **Don't**: Create DAL/repository/service layers (premature abstraction)
- **Why**: Single-tenant simplicity, follow the Rule of Three

### UI Framework

- **New Development**: shadcn/ui + Tailwind CSS v4 only
- **CSS**: Material Design 3 colors from globals.css

## Development Guidelines

### Command Recommendations

| Avoid           | Prefer             | Reason                                    |
| --------------- | ------------------ | ----------------------------------------- |
| `npm test 2>&1` | `npm test`         | Vitest treats redirection as test filters |
| `find`          | `rg --files`, `fd` | Safer/faster search                       |

### Available Commands

- **Testing**: `npm test` (unit tests), `npm run test:integration` (Supabase tests), `npm run test:watch`, `npm run smoke` (E2E)
- **Development**: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- **Quality Gate**: `npm run preflight` (runs all checks before commits)
- **Components**: `npx shadcn@latest add [component]`

### Testing Requirements

**Integration Tests Requiring Supabase:**

- **Location**: All integration tests requiring Supabase MUST be in `src/test/integration/supabase/`
- **Naming**: Files must end with `.test.ts` or `.test.tsx`
- **Purpose**: Easy filtering - integration tests can be skipped if Supabase isn't running
- **Commands**:
  - `npm test` - Runs unit tests only (excludes integration folder)
  - `npm run test:integration` - Runs integration tests only (requires `supabase start`)
  - `npm run preflight` - Runs both unit and integration tests

**Preflight Script:**

- **Purpose**: Comprehensive pre-commit validation (run before all commits)
- **Behavior**: Fail-fast (stops on first error)
- **Stage 1 (parallel)**: `typecheck`, `lint`, `format`, `test` (unit tests)
- **Stage 2 (parallel, after stage 1)**: `build`, `test:integration`
- **Output**: Minimal (`--silent` flags to avoid context spam)

### Project Structure

- **Source**: `src/app` (App Router), `src/components`, `src/lib`, `src/server`
- **Tests**: `src/test` (unit/integration), `e2e/` (Playwright)
- **Docs**: `docs/` (specs), `docs/tech-updates/` (tech reference)

## Coding Standards

### TypeScript

- **Strictest configuration**: No `any`, no non-null `!`, no unsafe `as`
- **Explicit return types**: Required for public functions
- **Path aliases**: Use `~/` instead of relative imports

### Naming Conventions

- **Components**: PascalCase files (`IssueCard.tsx`)
- **Client Components**: Use `"use client"` directive at top
- **Hooks**: `useThing.ts`
- **Utilities**: kebab-case or snake_case files

### Database

- **Schema**: snake_case for all table/column names
- **Boundary**: Convert to camelCase at application boundaries
- **Types**: Keep snake_case DB types separate from camelCase app types

## Pattern Discovery & Documentation

**IMPORTANT**: When implementing features, always reference `docs/PATTERNS.md` for established patterns.

**Contributing New Patterns**:

- **When**: You implement the same approach 2+ times
- **What**: Add it to `docs/PATTERNS.md` with a working code example
- **Why**: Future agents need to follow the same conventions
- **How**: Keep examples concise, focus on PinPoint-specific patterns (not general Next.js knowledge)

**Example**: If you create two Server Actions with similar structure, add that pattern to PATTERNS.md so the third one follows the same approach.

## Testing Strategy

**Philosophy**: Confidence, not perfection.

**The Testing Pyramid**:

```
        /\
       /E2E\      ← 5-10 tests (critical flows only)
      /------\
     /  Intg  \   ← 25-35 tests (DB + auth)
    /----------\
   /    Unit    \ ← 70-100 tests (pure logic)
  /--------------\
```

**Distribution & Targets**:

- **70% Unit Tests** (~70-100 tests) - Pure functions, utilities, validation
- **25% Integration Tests** (~25-35 tests) - Database queries with worker-scoped PGlite
- **5% E2E Tests** (5-6 tests) - Critical user journeys only (Playwright)
- **Total Target**: ~100-150 tests (not thousands)

**Key Constraints**:

- Worker-scoped PGlite only (per-test instances cause lockups)
- No testing Server Components directly (use E2E instead)
- Test behavior, not implementation details

**Authority**: `docs/TESTING_PLAN.md` for detailed patterns, examples, and anti-patterns

## Scope Creep Prevention

### The Scope Firewall (3 Questions)

1. Does this solve a problem we have RIGHT NOW?
2. Does this block a user from achieving the core value proposition?
3. Can we ship MVP without this?

If answers are No/No/Yes → defer to `docs/V2_ROADMAP.md`

### The "Done Enough" Standard

1. Does it work for the happy path?
2. Does it handle the most common error case?
3. Is it tested with at least one test?
4. Is it secure (input validation, auth checks)?
5. Is the code readable by someone else?

If all Yes → ship it. Perfect is the enemy of done.

## Essential Documentation

- **`docs/NON_NEGOTIABLES.md`** - Critical patterns and forbidden practices
- **`docs/PATTERNS.md`** - Project-specific code patterns (living document)
- **`docs/PRODUCT_SPEC.md`** - Feature specifications (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`docs/V2_ROADMAP.md`** - Deferred features parking lot
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Practical TypeScript patterns
- **`docs/tech-updates/INDEX.md`** - Tech stack reference

## Commit Guidelines

- **Style**: Conventional commits (`feat:`, `fix:`, `chore:`)
- **Before pushing**: `npm run pre-flight` (runs typecheck, test, smoke, lint, format)
- **PRs**: Clear description, screenshots for UI changes
- **No migrations**: Schema changes via direct modification only

## Quality Gates

- All tests pass before commits
- Pre-commit hooks (Husky + lint-staged)
- Server-first principles for new development
- Progressive enhancement (forms work without JS)
- Input validation with Zod for all user inputs

**Usage**: This file provides essential context for AI agents working on PinPoint. Follow all constraints in `docs/NON_NEGOTIABLES.md`.
