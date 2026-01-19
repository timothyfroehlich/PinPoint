# PinPoint v2 – GitHub Copilot Repository Instructions

> Source of truth lives in: `docs/NON_NEGOTIABLES.md`, `docs/UI_GUIDE.md`, `docs/PATTERNS.md`, `docs/TYPESCRIPT_STRICTEST_PATTERNS.md`, `docs/PRODUCT_SPEC.md`, `docs/TECH_SPEC.md`, `docs/TESTING_PLAN.md`, plus root `AGENTS.md` and active tasks in `TASKS.md`. Do NOT duplicate full lists of forbidden patterns here—reference them.

## Phase & Context

- Phase: Greenfield rewrite (v2) – single-tenant (Austin Pinball Collective) – pre-beta
- Users: 0 production users (high refactor tolerance, emphasize velocity + clarity)
- Core Value: Enable logging issues for pinball machines, tracking work, resolving them.
- Single-Tenant Impact: No organization scoping, no RLS, no multi-tenant isolation layers. Keep architecture lean.

## Architectural Pillars

1. Server-First: Prefer React Server Components. Client islands only for real interactivity (events, browser APIs, dynamic state).
2. Direct Data Access: Use Drizzle directly from Server Components & Server Actions. Avoid DAL/service abstractions until Rule of Three is met.
3. Progressive Enhancement: Forms must submit without JavaScript; enhance with client code optionally.
4. Strict TypeScript: Follow strictest patterns (no `any`, non-null `!`, unsafe `as`). Use narrow types + guards.
5. Schema Lock: Modify schema files directly (no migration files this phase). Never alter schema solely to appease TS errors.
6. Memory Safety: Worker-scoped PGlite for integration tests; NEVER per-test DB instantiation.
7. Consistent Domain Rules: Every issue belongs to exactly one machine (CHECK constraint). Severity uses `minor | playable | unplayable`.
8. UI Constraints: shadcn/ui + Tailwind CSS v4 + Material Design 3 color tokens in `globals.css`.

## What Changed From Archived (v1)

- Dropped multi-tenant & RLS concerns (remove orgId scoping logic from generation / reviews).
- Removed tRPC layer; now direct Drizzle + Server Actions.
- Simplified auth: Supabase SSR only; no RLS policies or pgTAP tests.
- Domain focus narrowed to machines + issues + comments (later navigation, auth pages, etc per `TASKS.md`).

## Forward-Looking (PR Sequence Guidance)

Referencing `TASKS.md` PR order:

- PR1 Foundation: Bootstrapping configs (TS, lint, format, CI). Copilot suggestions should not introduce app logic prematurely.
- PR2 Schema: Favor clear Drizzle definitions + relations; no premature indexes unless justified.
- PR3 Auth: Generate SSR Supabase helpers (`createClient` with immediate `auth.getUser()`). Avoid client-side auth hacks.
- PR4 UI + Landing: Server Component landing page; minimal client code.
- PR5 Testing: Ensure test helpers follow memory safety guideline.
  Subsequent PRs extend domain logic—keep suggestions incremental, referencing existing patterns.

## Critical Patterns (Summaries – Full Detail in Docs)

- Forbidden Patterns: See `docs/NON_NEGOTIABLES.md` (includes memory safety, schema mutation via migrations, unsafe TS escapes, non-progressive forms, introducing MUI, etc.).
- Type Boundaries: Keep snake_case in database layer; convert at boundary if/when needed—do not over-engineer conversions early.
- Server Actions: Use explicit return types; integrate validation (Zod) with smallest viable schemas.
- Testing Distribution: Aim eventually for pyramid described in `TESTING_PLAN.md`; early phase can start with minimal unit + one integration seed.

## Copilot Review Priorities

1. **GitHub Staging Files**: Any files in `.github-staging/` directory MUST be manually reviewed before moving to `.github/`. Never automatically move or activate these files. See `.github-staging/README.md` for review process.
2. **Release Notes**: Verify `CHANGELOG.md` has been updated with a brief description of changes for user-facing or significant technical updates. Skip only for CI plumbing, refactoring, test-only changes, and bot PRs (dependabot, Jules).
3. Security & Data Integrity: Input validation, single-tenant assumptions honored, issue-machine relationship enforced.
4. Server-First Compliance: Avoid unnecessary `"use client"`.
5. Type Safety: No forbidden escapes; proper narrowing.
6. Progressive Enhancement: `<form action={serverAction}>` patterns validated.
7. Memory Safety & Test Patterns: Worker-scoped DB setup; no per-test instances.
8. Domain Consistency: Issue severity vocabulary and one-machine rule.
9. **E2E Test Quality**: Follow `docs/E2E_BEST_PRACTICES.md` - semantic selectors (role + name), no hard-coded delays, independent tests, descriptive names, reusable actions extracted. Validate critical user journeys only, avoid testing implementation details or edge cases.

## Preferred Implementation Examples

> **Source of Truth**: See `docs/PATTERNS.md` (and `docs/patterns/*.md`) for detailed coding patterns and examples.

Refer to `docs/PATTERNS.md` index for:

- Minimal Server Component examples
- Server Actions with Zod validation
- Integration Test memory safety patterns

(See pattern-specific instruction files in `.github/instructions/` for scoped detail.)

## Auth Essentials

- SSR only: `src/lib/supabase/server.ts` wrapper creates client and immediately calls `auth.getUser()`.
- Middleware handles token refresh; do not mutate the response object.
- Auth pages use Server Components + forms posting to Server Actions.

## UI & Styling

- **Authority**: `docs/UI_GUIDE.md` - Follow this guide for all UI development.
- Tailwind CSS v4 using `@import "tailwindcss"` & `@config` in `globals.css`.
- Material Design 3 colors stored as CSS variables; prefer semantic tokens (`--color-primary-container`).
- Use shadcn/ui primitives; never introduce MUI.

## Testing Guidance (Condensed)

- Unit: Pure logic (status derivation, validation).
- Integration: Drizzle queries + Server Actions using worker-scoped PGlite.
- E2E: Playwright for full flows (landing load, auth, machine creation) after foundational PRs.
  - **Authority**: `docs/E2E_BEST_PRACTICES.md` - Follow selector strategy, test organization, and anti-patterns guide
- Avoid testing Server Components directly—validate via E2E.

## Commit & Quality Gates

Run (or ensure CI runs) before pushing:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run format
```

(Use eventual `preflight` script when added.) Conventional commit messages.

## Copilot Should Avoid Generating

- Organization scoping logic (obsolete in v2 single-tenant).
- tRPC routers / multi-tenant context wrappers.
- RLS policy tests / pgTAP usage.
- DAL/service abstraction layers prematurely.
- Client components where static server rendering suffices.

## Escalation / Uncertainty Handling

If Copilot cannot infer a pattern: reference the canonical docs first; prefer asking for clarification only when a direct pattern is absent and Rule of Three not met.

## Evolution Notes

As features stabilize (Machines CRUD, Issues workflow, Comments), patterns that repeat (≥2 implementations) MUST be documented in `docs/patterns/` before introducing abstractions.

---

Last Updated: 2025-12-09 (Reaffirmed release notes requirement and CI guard)
