# PinPoint Non‑Negotiables (Core)

**Last Updated**: September 5, 2025
**Last Reviewed**: September 5, 2025

**Status:** Successfully resolved authentication infrastructure over-engineering. Authentication cleanup complete with 53% ESLint improvement through parallel agent strategy. Document updated to reflect infrastructure complexity lessons learned.

## Overview

**Purpose:** Define strict rules that keep our codebase secure, consistent, and maintainable.

**Scope:** All contributors and agents. Applies to application code, server code, and infrastructure integrations.

**Enforcement:** Lint rules, CI checks, and PR blocking for critical violations. Exceptions require explicit approval.

**How to use:** Skim the Quick Start, then reference the relevant section. Each rule includes rationale, do/don'ts, references, and enforcement notes.

## Quick Start Checklist

1) Import reusable types from `~/lib/types`; do not duplicate types.
2) Keep DB types (snake_case) in DB modules/services via `Db.*`; convert at the boundary.
3) Expose only camelCase domain/API types (declared in `src/lib/types`) to routers/components.
4) Use `DrizzleToCamelCase` and/or `transformKeysToCamelCase` at DB→app boundaries.
5) Use Supabase SSR wrapper `~/lib/supabase/server` (`createClient()`), call `auth.getUser()` immediately.
6) Ensure Next.js middleware for Supabase SSR token refresh is present.
7) Always scope queries by `organizationId` (RLS-compatible org scoping). Exception: global/root pages may only query public/global data and must not attempt org-scoped queries.
8) Wrap server data access with `cache()` to prevent duplicate queries.
9) Avoid deep relative imports; use `~/` aliases.
10) Never use `any`, non‑null `!`, or unsafe `as`; write proper guards.

---

## Type System & Data Layers

**CORE-TS-001:** Declare reusable types in `src/lib/types`
- **Severity:** Critical (CORE‑TS‑001)
- **Why:** Single source of truth; improves reuse and discoverability.
- **Do:** Define domain/API/DTO/shared types under `src/lib/types` and re‑export from `~/lib/types`.
- **Don’t:** Define shared types in feature files; don’t duplicate shapes.
- **Reference:** `src/lib/types/*`, `~/lib/types`

**CORE-TS-002:** No duplicate domain types
- **Severity:** High (CORE‑TS‑002)
- **Why:** Divergent shapes cause bugs.
- **Do:** Reuse `IssueFilters`, `MachineForIssues`, `RoleResponse`, etc. from `~/lib/types`.
- **Don’t:** Declare look‑alike types in DAL/services/components.
- **Reference:** `src/lib/types/api.ts`, `src/lib/types/filters.ts`

**CORE-TS-003:** DB vs App boundary
- **Severity:** High (CORE‑TS‑003)
- **Why:** Prevents snake_case leaking and clarifies ownership.
- **Do:** Use `import type { Db } from "~/lib/types"` in DB modules/services only; convert at boundary.
- **Don’t:** Export `Db.*` types to routers/components.
- **Reference:** `~/server/db/**`, `~/lib/types/db.ts`

**CORE-TS-004:** Drizzle naming (snake_case schema)
- **Severity:** Required (CORE‑TS‑004)
- **Why:** Consistency with Drizzle and SQL conventions.
- **Do:** Keep schema/table/column identifiers snake_case.
- **Don’t:** Introduce camelCase in DB schema.
- **Reference:** `src/server/db/schema/*`

**CORE-TS-005:** Zod inferred types re‑export
- **Severity:** Required (CORE‑TS‑005)
- **Why:** Ensures shared access to validated shapes.
- **Do:** Keep schemas local; re‑export `z.infer` types from `~/lib/types`.
- **Don’t:** Recreate inferred types elsewhere.
- **Reference:** `src/lib/search-params/*`, `~/lib/types/search.ts`

**CORE-TS-006:** Explicit return types for complex functions
- **Severity:** Required (CORE‑TS‑006)
- **Why:** Prevents inference errors and clarifies public APIs.
- **Do:** Add explicit return types to complex/public functions and exported utilities.
- **Don’t:** Rely on inference for complex function signatures.
- **Reference:** Shared coding standards

---

## Supabase SSR & Auth

**CORE-SSR-001:** Use SSR wrapper and cookie contract
- **Severity:** Critical (CORE‑SSR‑001)
- **Why:** Prevents session desync and random logouts.
- **Do:** Use `~/lib/supabase/server`’s `createClient()`; provide `getAll()`/`setAll()` cookie handlers.
- **Don’t:** Import `createClient` from `@supabase/supabase-js` on the server.
- **Reference:** `src/lib/supabase/server.ts`

**CORE-SSR-003:** Middleware is required
- **Severity:** Critical (CORE‑SSR‑003)
- **Why:** Enables token refresh and SSR session continuity.
- **Do:** Keep the Supabase middleware in place and configured.
- **Don’t:** Remove or bypass middleware in environments that need SSR auth.
- **Reference:** `middleware.ts`

**CORE-SSR-005:** Auth callback route required
- **Severity:** Critical (CORE‑SSR‑005)
- **Why:** OAuth flows cannot complete without a callback handler.
- **Do:** Maintain `app/auth/callback/route.ts` with proper Supabase callback handling.
- **Don’t:** Remove or bypass the auth callback route.
- **Reference:** `app/auth/callback/route.ts`

**CORE-SSR-002:** Call `auth.getUser()` immediately
- **Severity:** High (CORE‑SSR‑002)
- **Why:** Workaround for timing issues; avoids token invalidation.
- **Do:** Call `supabase.auth.getUser()` right after creating the SSR client.
- **Don’t:** Run logic between client creation and `getUser()` in the same request scope.
- **Reference:** `src/lib/supabase/server.ts`

**CORE-SSR-004:** Don’t modify Supabase response object
- **Severity:** Required (CORE‑SSR‑004)
- **Why:** Altering it breaks auth.
- **Do:** Return the response object as‑is from middleware where applicable.
- **Don’t:** Mutate or rewrap the response.
- **Reference:** Middleware implementation

---

## Security

**CORE-SEC-001:** Always scope queries by organization
- **Severity:** Critical (CORE‑SEC‑001)
- **Why:** Prevents cross‑tenant data leakage.
- **Do:** Pass and enforce `organizationId` at the boundary; leverage RLS.
- **Don’t:** Run unscoped selects in multi‑tenant contexts.
- **Reference:** DAL/services, RLS utilities

**CORE-SEC-002:** Protect APIs
- **Severity:** Critical (CORE‑SEC‑002)
- **Why:** Prevent unauthorized access.
- **Do:** Use protected procedures; mask errors.
- **Don’t:** Expose sensitive routes as public.
- **Reference:** TRPC routers, auth helpers

**CORE-SEC-003:** Don’t mix RLS tracks
- **Severity:** High (CORE‑SEC‑003)
- **Why:** Avoids false positives/negatives in tests.
- **Do:** Keep pgTAP RLS tests separate; don’t bypass RLS unintentionally.
- **Don’t:** Use PGlite in ways that circumvent RLS checks.
- **Reference:** `supabase/tests/*`

**CORE-SEC-004:** Server Components must receive organization context (unless in global context)
- **Severity:** High (CORE‑SEC‑004)
- **Why:** Ensures multi‑tenant scoping is preserved in UI data fetches.
- **Do:** Pass/derive `organizationId` for Server Components via context/props and bind RLS at the boundary. For root/apex (global) pages, org context is intentionally absent; components must treat that as global scope and MUST NOT perform org-scoped queries.
- **Don’t:** Render Server Components that fetch org-scoped data without org context. For global pages, do not attempt org membership or org-scoped queries.
- **Reference:** Organization context utilities, RLS binding helpers
## Global Context Clarification

**Global (Root/Apex) Context:**
- Pages/routes rendered at the root domain (no subdomain) operate in global context. These must not invoke org-scoped fetchers or attempt org membership resolution. Org-scoped functions must assert presence of `organizationId` and fail loudly if absent.


---

## Performance & Caching

**CORE-PERF-001:** Cache server fetchers
- **Severity:** Required (CORE‑PERF‑001)
- **Why:** Prevents duplicated queries within a request.
- **Do:** Wrap data access in `cache()`; collocate caching with fetchers.
- **Don’t:** Re‑call uncached fetchers across the same request.
- **Reference:** React 19 patterns

**CORE-PERF-002:** Use explicit fetch caching
- **Severity:** Required (CORE‑PERF‑002)
- **Why:** Controls network behavior in Next.js 15.
- **Do:** Add `cache: "force-cache"` or appropriate options.
- **Don’t:** Rely on implicit defaults.
- **Reference:** Next.js fetch docs

---

## Testing

**CORE-TEST-001:** Use correct archetypes
- **Severity:** Required (CORE‑TEST‑001)
- **Why:** Ensures reliable, fast tests.
- **Do:** Pure functions → unit; DB → workerDb; tRPC → mocks; E2E for full flows.
- **Don’t:** Spin per‑test PGlite; mix RLS tracks.
- **Reference:** `src/test/**`, `e2e/**`, `supabase/tests/**`

**CORE-TEST-002:** Server components via E2E
- **Severity:** Required (CORE‑TEST‑002)
- **Why:** Async Server Components are integration concerns.
- **Do:** Use E2E for end‑to‑end validation.
- **Don’t:** Unit test async Server Components directly.
- **Reference:** Playwright config

**CORE-TEST-003:** Non‑manual test creation
- **Severity:** Required (CORE‑TEST‑003)
- **Why:** Keeps structure consistent.
- **Do:** Use the `/create-test` workflow.
- **Don’t:** Add ad‑hoc test files.
- **Reference:** Testing docs

---

## Forbidden Patterns (One‑Page Reference)

- Memory safety violations: per‑test PGlite instances.
- New SQL migration files in `supabase/migrations/` (initial snapshot only).
- Schema is locked. Code adapts to schema, not vice versa. Do not propose or apply schema changes unless explicitly authorized; even then, do not add new migration files — use the approved workflow.
- Deprecated imports: `@supabase/auth-helpers-nextjs`.
- Supabase SSR misuse: no wrapper, wrong cookie contract, logic before `getUser()`.
- Missing/removed auth callback route for OAuth flows.
- Modifying Supabase response object.
- TypeScript safety defeats: `any`, non‑null `!`, unsafe `as`.
- Deep relative imports; use `~/` aliases.
- Seed data ID changes (locked constants).
- Uncached fetch() in Next.js 15 where caching is required.
- Tailwind v4 projects adding v3 `tailwind.config.js`.
- Overuse of Client Components.
- New Material UI components (use shadcn/ui).
- **SQL injection patterns**: Raw string interpolation in SQL (`sql.raw(\`SET var = '${value}'\`)`).
- **Architectural SQL misuse**: Using `sql.raw()` when `sql` templates provide safe parameterization.
- **Session variable abuse**: Application code setting database session variables instead of explicit filtering.
- **Circular dependencies via dynamic imports**: `await import()` used to hide architectural boundary violations.
- **Infrastructure doing business logic**: Context/utility files performing direct database queries.
- **Over-abstraction**: Functions with single call sites that add no architectural value.
- **Multiple auth context systems**: Duplicate authentication resolution patterns instead of consolidated approach.
- **Enterprise infrastructure in pre-beta**: Complex error hierarchies, request context tracking, performance monitoring before operational scale demands it.
- **Infrastructure fighting TypeScript strictness**: Complex patterns that generate `exactOptionalPropertyTypes` violations indicate wrong complexity level.

---

## Appendices

- **Examples & Snippets:** See `docs/NON_NEGOTIABLES_EXAMPLES.md`.
- **Type System Reference:** See **[TYPE_INVENTORY.md](./TYPE_INVENTORY.md)** for comprehensive Type Ownership Matrix and import patterns.
- **Rule IDs Glossary:**
  - CORE‑TS‑001: Declare reusable types in `src/lib/types`
  - CORE‑TS‑002: No duplicate domain types
  - CORE‑TS‑003: DB vs App boundary with `Db.*`
  - CORE‑TS‑004: Drizzle naming (snake_case schema)
  - CORE‑TS‑005: Re‑export Zod inferred types
  - CORE‑SSR‑001: Supabase SSR wrapper
  - CORE‑SSR‑002: Immediate `auth.getUser()`
  - CORE‑SSR‑003: Middleware required
  - CORE‑SSR‑004: Don't modify Supabase response
  - CORE‑SEC‑001..003: Org scoping, API protection, RLS track separation
  - CORE‑PERF‑001..002: cache(), fetch caching
  - CORE‑TEST‑001..003: Archetypes, server components, non‑manual tests

- **Changelog:**
  - 2025‑09‑05: **Authentication cleanup success**: Eliminated ~500 lines of over-engineered infrastructure. Reduced ESLint errors from 87 to 41 (53% improvement) through parallel agent strategy. Added enterprise infrastructure anti-patterns. Confirmed authentication system was already well-architected with canonical `getRequestAuthContext()` resolver.
  - 2025‑09‑01: v2 restructure adopted; added TYPE_INVENTORY.md reference.
