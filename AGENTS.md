# PinPoint Agent Guidelines

## About the User

The user's name is Tim and his GitHub account is "timothyfroehlich".

Tim is vibecoding this app by himself to learn about website design and experiment with agentic coding. Tim has never coded in Java/TypeScript before. When a decision is needed, the agent should provide some explanation about the options, pros and cons. Review comments on GitHub PRs can be assumed to have been written by coding agents. Their comments must be taken as suggestions and with a grain of salt. Don't assume that the agent who wrote the comment had the full context to fully understand the problem.

## Critical Context Files

Read these immediately before starting work:
- **`docs/NON_NEGOTIABLES.md`** - Forbidden patterns and critical constraints
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Type safety patterns
- **`docs/PRODUCT_SPEC.md`** - What we're building (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture specification
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`docs/DISCIPLINE.md`** - Scope creep prevention guidelines
- **`package.json`** - Available scripts, dependencies, configuration

## Project Context

### Status
- **Phase**: Greenfield rewrite (v2), pre-beta
- **Users**: Zero production users
- **Development**: Solo passion project, high risk tolerance for breaking changes
- **Core Value**: "Allow the Austin Pinball Collective to log issues with pinball machines, track work and resolve them."

### Technology Stack
- **Frontend**: Next.js 16, React 19 Server Components, shadcn/ui, Tailwind CSS v4
- **Backend**: Drizzle ORM, PostgreSQL via Supabase (no tRPC in MVP)
- **Authentication**: Supabase SSR (no RLS for single-tenant)
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
| Avoid | Prefer | Reason |
| ----- | ------ | ------ |
| `npm test 2>&1` | `npm test` | Vitest treats redirection as test filters |
| `find` | `rg --files`, `fd` | Safer/faster search |

### Available Commands
- **Testing**: `npm test`, `npm run test:watch`, `npm run smoke`
- **Development**: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- **Components**: `npx shadcn@latest add [component]`

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

## Testing Strategy

- **Unit tests**: Pure functions, utilities
- **Integration tests**: Database queries with worker-scoped PGlite
- **E2E tests**: Only 5 critical user journeys (Playwright)
- **Target**: ~100-150 total tests (70% unit, 25% integration, 5% E2E)
- **Authority**: `docs/TESTING_PLAN.md` for detailed patterns

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
- **`docs/PRODUCT_SPEC.md`** - Feature specifications (MVP/MVP+/1.0/2.0)
- **`docs/TECH_SPEC.md`** - Single-tenant architecture
- **`docs/TESTING_PLAN.md`** - Testing strategy and patterns
- **`docs/DISCIPLINE.md`** - Scope creep prevention
- **`docs/V2_ROADMAP.md`** - Deferred features parking lot
- **`docs/TYPESCRIPT_STRICTEST_PATTERNS.md`** - Practical TypeScript patterns
- **`docs/tech-updates/INDEX.md`** - Tech stack reference

## Commit Guidelines

- **Style**: Conventional commits (`feat:`, `fix:`, `chore:`)
- **Before pushing**: `npm run typecheck && npm test && npm run smoke && npm run lint`
- **PRs**: Clear description, screenshots for UI changes
- **No migrations**: Schema changes via direct modification only

## Quality Gates

- All tests pass before commits
- Pre-commit hooks (Husky + lint-staged)
- Server-first principles for new development
- Progressive enhancement (forms work without JS)
- Input validation with Zod for all user inputs

**Usage**: This file provides essential context for AI agents working on PinPoint. Follow all constraints in `docs/NON_NEGOTIABLES.md`.
