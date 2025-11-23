# PinPoint Agent Guidelines

## About the User

The user's name is Tim and his GitHub account is "timothyfroehlich".

Tim is vibecoding this app by himself to learn about website design and experiment with agentic coding. Tim has never coded in Java/TypeScript before. When a decision is needed, the agent should provide some explanation about the options, pros and cons. Review comments on GitHub PRs can be assumed to have been written by coding agents. Their comments must be taken as suggestions and with a grain of salt. Don't assume that the agent who wrote the comment had the full context to fully understand the problem.

## CRITICAL: BEFORE SUBMITTING

**ALWAYS run `npm run preflight` before submitting your changes.**
This script runs type checking, linting, formatting, and tests. Pushing broken code wastes time.
If you cannot run the full preflight (e.g., due to missing Supabase in your environment), you MUST run:
`npm run typecheck && npm run lint && npm test && npm run build`

## Critical Context Files

Read these immediately before starting work:

- **`docs/NON_NEGOTIABLES.md`** - Forbidden patterns and critical constraints
- **`docs/PATTERNS.md`** - Index of project-specific code patterns (see `docs/patterns/`)
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Type safety patterns
- **`docs/PRODUCT_SPEC.md`** - What we're building (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture specification
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`docs/E2E_BEST_PRACTICES.md`** - E2E testing patterns with Playwright
- **`package.json`** - Available scripts, dependencies, configuration

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

## Multi-Worktree Development Setup

PinPoint uses parallel git worktrees so multiple assistants can work without stepping on each other. Each worktree runs its own Supabase instance on unique ports; changes to `supabase/config.toml` are kept local via `git update-index --skip-worktree`.

### Port Allocation

| Worktree    | Next.js | Supabase API | PostgreSQL | Shadow DB | Inbucket | project_id           |
| ----------- | ------- | ------------ | ---------- | --------- | -------- | -------------------- |
| Main        | 3000    | 54321        | 54322      | 54320     | 54324    | pinpoint             |
| Secondary   | 3100    | 55321        | 55322      | 55320     | 55324    | pinpoint-secondary   |
| Review      | 3200    | 56321        | 56322      | 56320     | 56324    | pinpoint-review      |
| AntiGravity | 3300    | 57321        | 57322      | 57320     | 57324    | pinpoint-antigravity |

### How It Works

- Each non-main worktree edits its own `supabase/config.toml` (ports + `project_id`) and marks it `skip-worktree` so git ignores local changes.
- `.env.local` (gitignored) holds worktree-specific ports/keys.
- CI stays on the main config/ports; no CI changes required.

### Starting Development

```bash
cd ~/Code/PinPoint-Secondary
supabase start   # uses this worktree's config.toml ports/project_id
npm run dev      # uses PORT in .env.local
```

All worktrees can run Supabase + Next.js simultaneously with no port collisions.

**Host consistency:** Keep auth callbacks, Next dev server, Playwright `baseURL`, and Supabase `site_url` on the same host (`localhost`) to avoid cookie host mismatches. When adding new worktrees or updating `.env.local`, stick to `localhost` and only change the ports.

### Adding a New Worktree

1. `git worktree add ../PinPoint-<Name> -b feature/<name>` from main repo.
2. Edit `supabase/config.toml`: bump all Supabase ports by +1000 per slot, set unique `project_id`, update auth `site_url` to the new Next.js port.
3. Apply skip flag: `git update-index --skip-worktree supabase/config.toml`.
4. Copy `.env.example` → `.env.local`, set `PORT`, `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` to the new ports, then run `npm install`.

### Updating Base Config

When `supabase/config.toml` changes in the main worktree, manually refresh others:

```bash
git update-index --no-skip-worktree supabase/config.toml
git restore supabase/config.toml   # or pull latest
# re-apply worktree-specific ports/project_id
git update-index --skip-worktree supabase/config.toml
```

### Checking Skip-Worktree Status

- `git ls-files -v supabase/config.toml` → prefix `S` means skip-worktree.
- Remove skip (before deleting a worktree): `git update-index --no-skip-worktree supabase/config.toml`.

### Troubleshooting

- **Port already in use:** `lsof -i :55321` then `supabase stop` in that worktree.
- **Git shows config.toml modified:** re-apply skip-worktree.
- **Supabase keys changed after restart:** run `supabase start`, copy new `PUBLISHABLE_KEY/SERVICE_ROLE_KEY` into `.env.local`.

### Available Commands

- **Testing**: `npm test` (unit tests), `npm run test:integration` (Supabase tests), `npm run test:watch`, `npm run smoke` (E2E)
- **Development**: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- **Quality Gate**: `npm run preflight` (comprehensive validation - REQUIRED before pushing)
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

**IMPORTANT**: When implementing features, always reference `docs/PATTERNS.md` (and its sub-files in `docs/patterns/`) for established patterns.

**Contributing New Patterns**:

- **When**: You implement the same approach 2+ times
- **What**: Add it to a new or existing file in `docs/patterns/` and link it in `docs/PATTERNS.md`
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

**Authority**: `docs/TESTING_PLAN.md` for detailed patterns, examples, and anti-patterns. See `docs/E2E_BEST_PRACTICES.md` for E2E-specific guidance (selector strategy, test organization, debugging).

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
- **`docs/PATTERNS.md`** - Index of project patterns (living document, see `docs/patterns/`)
- **`docs/PRODUCT_SPEC.md`** - Feature specifications (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`docs/E2E_BEST_PRACTICES.md`** - E2E testing patterns with Playwright
- **`docs/V2_ROADMAP.md`** - Deferred features parking lot
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Practical TypeScript patterns
- **`docs/tech-updates/INDEX.md`** - Tech stack reference

## Commit Guidelines

- **Style**: Conventional commits (`feat:`, `fix:`, `chore:`)
- **Before pushing**: ALWAYS run `npm run preflight` (runs typecheck, lint, format, test, build, test:integration)
- **PRs**: Clear description, screenshots for UI changes
- **No migrations**: Schema changes via direct modification only

## Quality Gates

- All tests pass before commits
- Pre-commit hooks (Husky + lint-staged)
- Server-first principles for new development
- Progressive enhancement (forms work without JS)
- Input validation with Zod for all user inputs

## Production Bug Testing (TDD Required)

**Critical**: When a bug is discovered in preview/production deployments that wasn't caught by tests, follow TDD:

### RED-GREEN-REFACTOR Process

1. **RED - Write failing test**
   - Reproduce the bug locally
   - Write a test that fails due to the bug
   - Verify the test actually fails (don't skip this!)
   - Commit the failing test

2. **GREEN - Fix the bug**
   - Make minimal changes to make the test pass
   - Verify the test now passes
   - Verify original bug is fixed in deployment preview

3. **REFACTOR - Clean up if needed**
   - Improve code quality without changing behavior
   - Ensure tests still pass
   - Document pattern in `docs/NON_NEGOTIABLES.md` if it's a common mistake

**Examples**:

- Cookie modification in Server Components → Add unit test verifying readFlash() doesn't call cookies.set()
- Type errors in production → Add integration test for that code path
- Runtime errors on specific routes → Add E2E test for that route

**Exceptions** - Skip TDD only if:

- Bug is environment-specific (e.g., deployment platform configuration)
- Test would be flaky or unreliable
- Already covered by existing tests (test just needs to be fixed)

**Usage**: This file provides essential context for AI agents working on PinPoint. Follow all constraints in `docs/NON_NEGOTIABLES.md`.
