---
trigger: always_on
# For Antigravity
---

# PinPoint Non‑Negotiables

**Last Updated**: November 25, 2025
**Version**: 2.0 (Greenfield)

## Overview

**Purpose:** Define strict rules for secure, consistent, maintainable code.

**Scope:** All contributors and AI agents. Applies to application, server, and infrastructure code.

**Enforcement:** Lint rules, CI checks, PR blocking for critical violations.

## Quick Start Checklist

1. Import reusable types from `~/lib/types`; do not duplicate types
2. Keep DB types (snake_case) in schema; convert to camelCase at boundaries
3. Use Supabase SSR wrapper `~/lib/supabase/server`, call `auth.getUser()` immediately
4. Ensure Next.js middleware for Supabase SSR token refresh is present
5. Use database trigger for auto-profile creation (OAuth-proof, atomic)
6. Wrap server data access with React 19 `cache()` to prevent duplicate queries
7. Use `~/` path aliases, avoid deep relative imports
8. Never use `any`, non‑null `!`, or unsafe `as`; write proper type guards
9. Default to Server Components, minimal Client Components
10. Map data to minimal shapes before passing to Client Components (CORE-SEC-006)
11. Forms work without JavaScript (progressive enhancement)
12. Use Drizzle migrations for schema changes (no ad-hoc `push` to production/preview)
13. Keep auth host consistent: use `localhost` everywhere (Supabase site_url, Next dev, Playwright baseURL) to prevent cookie host mismatches
14. E2E interaction coverage: if you add a clickable element, click it in a test
15. Email addresses never displayed outside admin views and user's own settings page
16. Permissions matrix (`matrix.ts`) must match actual server action enforcement (CORE-ARCH-008)

---

## Type System & Data Layers

**CORE-TS-001:** Declare reusable types in `src/lib/types`

- **Severity:** Critical
- **Why:** Single source of truth for type definitions
- **Do:** Define shared types under `src/lib/types`, re‑export from `~/lib/types`
- **Don't:** Define shared types in feature files or duplicate shapes

**CORE-TS-002:** No duplicate domain types

- **Severity:** High
- **Why:** Divergent shapes cause bugs
- **Do:** Reuse domain types from `~/lib/types`
- **Don't:** Declare look‑alike types in multiple places

**CORE-TS-003:** DB vs App boundary

- **Severity:** High
- **Why:** Prevents snake_case leaking into application code
- **Do:** Keep snake_case in schema, convert to camelCase at boundaries
- **Don't:** Export snake_case DB types to components

**CORE-TS-004:** Drizzle naming (snake_case schema)

- **Severity:** Required
- **Why:** SQL and Drizzle convention
- **Do:** Keep all schema/table/column identifiers snake_case
- **Don't:** Use camelCase in database schema

**CORE-TS-005:** Zod inferred types re‑export

- **Severity:** Required
- **Why:** Shared access to validated shapes
- **Do:** Keep Zod schemas local, re‑export `z.infer` types from `~/lib/types`
- **Don't:** Recreate inferred types elsewhere

**CORE-TS-006:** Explicit return types for complex functions

- **Severity:** Required
- **Why:** Prevents inference errors, clarifies APIs
- **Do:** Add return types to public functions and exported utilities
- **Don't:** Rely on inference for complex signatures

---

## Supabase SSR & Auth

**CORE-SSR-001:** Use SSR wrapper and cookie contract

- **Severity:** Critical
- **Why:** Prevents session desync and random logouts
- **Do:** Use `~/lib/supabase/server`'s `createClient()` with `getAll()`/`setAll()` cookies
- **Don't:** Import `createClient` from `@supabase/supabase-js` directly on server

**CORE-SSR-002:** Call `auth.getUser()` immediately

- **Severity:** High
- **Why:** Workaround for timing issues, avoids token invalidation
- **Do:** Call `supabase.auth.getUser()` right after creating SSR client
- **Don't:** Run logic between client creation and `getUser()`

**CORE-SSR-003:** Middleware is required

- **Severity:** Critical
- **Why:** Enables token refresh and SSR session continuity
- **Do:** Keep Supabase middleware in place and configured
- **Don't:** Remove or bypass middleware

**CORE-SSR-004:** Auth callback route required

- **Severity:** Critical
- **Why:** OAuth flows cannot complete without callback handler
- **Do:** Maintain `app/auth/callback/route.ts` with proper Supabase callback
- **Don't:** Remove or bypass auth callback route

**CORE-SSR-005:** Don't modify Supabase response object

- **Severity:** Required
- **Why:** Altering it breaks authentication
- **Do:** Return response object as‑is from middleware
- **Don't:** Mutate or rewrap the response

**CORE-SSR-006:** Use database trigger for auto-profile creation

- **Severity:** Critical
- **Why:** OAuth-proof (works for Google/GitHub login), atomic transaction, Supabase best practice
- **Do:** Create `handle_new_user()` trigger on `auth.users` table (AFTER INSERT)
- **Don't:** Create user profiles manually in signup Server Actions (won't work for OAuth)

**CORE-SSR-007:** Never query `auth.users` directly in application code

- **Severity:** Critical
- **Why:** Internal Supabase schema; breaks abstraction, couples to implementation details, may break with Supabase updates
- **Do:** Query `user_profiles` table (which mirrors necessary auth data via database triggers)
- **Don't:** Use raw SQL or Drizzle queries against `auth.users` in Server Actions or services
- **Exception:** Database triggers (`supabase/seed.sql`) and test setup (`pglite.ts`) may reference `auth.users` for bootstrapping

---

## Security

**CORE-SEC-001:** Protect APIs and Server Actions

- **Severity:** Critical
- **Why:** Prevent unauthorized access
- **Do:** Verify authentication in Server Actions and tRPC procedures
- **Don't:** Skip auth checks in protected routes

**CORE-SEC-002:** Validate all inputs

- **Severity:** Critical
- **Why:** Prevent injection attacks
- **Do:** Use Zod for all form data and user inputs
- **Don't:** Trust FormData or query params without validation

**CORE-SEC-003:** Security headers via middleware

- **Severity:** Critical
- **Why:** Defense-in-depth protection against XSS, clickjacking, and protocol downgrade attacks
- **Do:** Set security headers in `middleware.ts` (CSP with nonces) and `next.config.ts` (static headers)
- **Don't:** Remove or weaken Content-Security-Policy, rely on 'unsafe-inline' or 'unsafe-eval'
- **Reference:** `docs/SECURITY.md` for configuration and modification guidelines

**CORE-SEC-004:** Nonce-based CSP

- **Severity:** High
- **Why:** Prevents XSS by blocking unauthorized scripts
- **Do:** Generate unique nonce per request, use Web Crypto API in Edge Runtime
- **Don't:** Use 'unsafe-inline' or 'unsafe-eval' in script-src, hardcode nonces
- **Rationale:** Modern CSP with 'strict-dynamic' allows Next.js dynamic imports while blocking malicious scripts

**CORE-SEC-005:** No hardcoded hostnames or ports

- **Severity:** Critical
- **Why:** Prevents environment mismatches and "whack-a-mole" configuration bugs
- **Do:** Use `NEXT_PUBLIC_SITE_URL` and `PORT` environment variables
- **Don't:** Hardcode `localhost:3000` or specific domains in source code or tests

**CORE-SEC-006:** Minimal data at Server→Client boundary

- **Severity:** Critical
- **Why:** RSC payload is visible in page source; full domain objects leak sensitive fields (emails, roles, internal IDs) even on authenticated pages
- **Do:** Map data to a minimal shape before passing to Client Components — only include fields the component actually uses
- **Don't:** Pass full ORM/domain objects (UnifiedUser, full profile records, etc.) as props to "use client" components

**CORE-SEC-007:** Email addresses never displayed outside admin/settings

- **Severity:** Critical
- **Why:** Email addresses are PII; anonymous reporters providing email for follow-up do not consent to public display
- **Do:** Use name hierarchy: `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`
- **Don't:** Fall back to `reporterEmail` in any UI, timeline event, seed data, or client-serialized response

---

## Performance & Caching

**CORE-PERF-001:** Cache server fetchers

- **Severity:** Required
- **Why:** Prevents duplicate queries within a request
- **Do:** Wrap data access in React 19 `cache()`
- **Don't:** Re‑call uncached fetchers in same request

**CORE-PERF-002:** Use explicit fetch caching

- **Severity:** Required
- **Why:** Next.js 16 (since 15) defaults to uncached
- **Do:** Add `cache: "force-cache"` or appropriate options to fetch()
- **Don't:** Rely on implicit caching defaults

---

## Testing

**CORE-TEST-001:** Use correct test types

- **Severity:** Required
- **Why:** Reliable, fast tests
- **Do:** Pure functions → unit tests; DB queries → integration with PGlite; Full flows → E2E
- **Don't:** Spin per‑test PGlite instances (causes lockups)

**CORE-TEST-002:** Server Components via E2E

- **Severity:** Required
- **Why:** Async Server Components are integration concerns
- **Do:** Use Playwright E2E for end‑to‑end validation
- **Don't:** Unit test async Server Components directly

**CORE-TEST-003:** Follow testing patterns

- **Severity:** Required
- **Why:** Consistent structure
- **Do:** Reference `docs/TESTING_PLAN.md` for test types and placement
- **Don't:** Mix test types or create per-test database instances

**CORE-TEST-004:** Prefer Integration Tests for DB Logic

- **Severity:** Required
- **Why:** Mocking Drizzle/DB clients leads to brittle, over-mocked tests that don't verify actual behavior
- **Do:** Use integration tests (with PGlite) for service layer logic that primarily interacts with the database
- **Don't:** Write unit tests that require extensive mocking of `db.query`, `db.transaction`, or method chains

**CORE-TEST-005:** E2E Interaction Coverage for Clickable Elements

- **Severity:** Required
- **Why:** Tests that verify element existence without clicking miss broken handlers (PR #894 pattern)
- **Do:** If you add a clickable element (button, link, icon), write an E2E test that clicks it and verifies the outcome
- **Don't:** Only assert `toBeVisible()` without testing the actual interaction

---

## Architecture

**CORE-ARCH-001:** Server-first development

- **Severity:** Required
- **Why:** Better performance, SEO, reduced bundle size
- **Do:** Default to Server Components, use "use client" only for interactivity
- **Don't:** Make entire pages Client Components unnecessarily

**CORE-ARCH-002:** Progressive enhancement

- **Severity:** Required
- **Why:** Forms work without JavaScript
- **Do:** Use Server Actions with `<form action={serverAction}>`
- **Don't:** Require client-side JavaScript for core functionality

**CORE-ARCH-004:** Issues always per-machine

- **Severity:** Critical
- **Why:** Core product requirement
- **Do:** Enforce `machine_id` foreign key with CHECK constraint
- **Don't:** Allow issues without machines

**CORE-ARCH-005:** Direct Server Action references in forms

- **Severity:** Critical
- **Why:** Inline wrappers break Next.js form submission handling
- **Do:** Use Server Actions directly: `<form action={serverAction}>`
- **Don't:** Wrap in inline async functions: `action={async () => { await serverAction(); }}`
- **Rationale:** Next.js serializes Server Actions automatically; wrappers create client-side functions that can't be serialized

**CORE-ARCH-006:** Server Actions in dropdown menus

- **Severity:** Critical
- **Why:** Forms inside dropdowns get unmounted before submission completes
- **Do:** Use `onSelect` event: `<DropdownMenuItem onSelect={async () => { await serverAction(); }}>`
- **Don't:** Use form submission inside `DropdownMenuItem`
- **Rationale:** Radix UI dropdowns auto-close and unmount content, causing "Form submission canceled because the form is not connected" errors

**CORE-ARCH-007:** Use useActionState for form feedback

- **Severity:** Required
- **Why:** Modern React 19 pattern, simpler than cookie-based flash messages, instant feedback
- **Do:** Use `useActionState` hook with Server Actions returning state objects
- **Don't:** Use flash messages (`setFlash`/`readFlash`) for form validation or success feedback
- **Rationale:** `useActionState` provides instant, state-based feedback without cookies or redirects, aligning with React 19 Server Actions architecture

**CORE-ARCH-008:** Permissions matrix must match server action enforcement

- **Severity:** Critical
- **Why:** The help page (`/help/permissions`) is auto-generated from `src/lib/permissions/matrix.ts`. If the matrix drifts from what server actions actually enforce, users see incorrect capability information.
- **Do:** When changing permission logic in server actions, update `matrix.ts` values and descriptions to match. Review both directions during PR review.
- **Don't:** Change server action authorization checks without updating the matrix (or vice versa)

---

## UI & Styling

**CORE-UI-001:** No global resets

- **Severity:** Critical
- **Why:** Breaks component internals, causes "spooky action at a distance"
- **Do:** Use Tailwind's built-in Preflight
- **Don't:** `* { margin: 0; padding: 0; }`

**CORE-UI-002:** No hardcoded spacing in reusable components

- **Severity:** High
- **Why:** Makes components rigid and hard to compose
- **Do:** Allow `className` prop to control margins
- **Don't:** Add `m-4` to the root of a Button or Input component

**CORE-UI-003:** Always use `cn()` for class merging

- **Severity:** Critical
- **Why:** Ensures parent styles properly override default styles
- **Do:** `className={cn("default-classes", className)}`
- **Don't:** `className={`default-classes ${className}`}`

**CORE-UI-004:** No inline styles

- **Severity:** High
- **Why:** Bypasses the design system, hard to maintain
- **Do:** Use Tailwind utility classes or CSS variables
- **Don't:** `style={{ marginTop: '10px' }}` (unless dynamic coordinates)

---

## Forbidden Patterns

**Never Do These:**

- **Memory safety**: Per‑test PGlite instances (causes system lockups)
- **Schema changes (legacy approach)**: Do not rely on ad-hoc `push`/schema resets to evolve production databases. Use Drizzle migrations instead.
- **Schema lock**: Code adapts to schema, never modify schema to fix TypeScript errors
- **Deprecated imports**: `@supabase/auth-helpers-nextjs` (use `@supabase/ssr`)
- **Supabase SSR misuse**: No wrapper, wrong cookie contract, logic before `getUser()`
- **Missing auth callback**: OAuth flows require callback route
- **Response mutation**: Don't modify Supabase response object
- **Weak CSP**: No 'unsafe-inline' or 'unsafe-eval' in script-src (use nonces)
- **Missing security headers**: Middleware must set CSP, next.config.ts must set static headers
- **TypeScript safety defeats**: No `any`, non-null `!`, or unsafe `as`
- **Deep relative imports**: Use `~/` aliases
- **Uncached fetch()**: Next.js 16 (since 15) requires explicit caching
- **Tailwind v4 misconfiguration**: No `tailwind.config.js` (use CSS-based config)
- **Client Component overuse**: Default to Server Components
- **SQL injection**: No raw string interpolation in SQL
- **Over-abstraction**: Don't create layers for single use cases (Rule of Three)
- **Enterprise patterns in pre-beta**: No complex error hierarchies or monitoring before scale demands it
- **Infrastructure fighting TypeScript**: Complex patterns generating `exactOptionalPropertyTypes` violations indicate wrong complexity level
- **Inline Server Action wrappers**: Don't wrap Server Actions in inline async functions in forms
- **Forms in dropdown menus**: Don't use `<form>` inside `DropdownMenuItem` (dropdown closes before submission completes)
- **Flash messages**: Don't use `setFlash()`/`readFlash()` for form feedback (use `useActionState` instead)
- **Playwright arbitrary waits**: No `page.waitForTimeout()` in tests; assert on real UI state (add `data-testid` hooks if needed)
- **Direct auth.users queries**: Never query Supabase's internal `auth.users` table in application code (use `user_profiles` instead)
- **Over-serialization to client**: Don't pass full domain objects to Client Components; map to minimal shapes at the server→client boundary (especially user/account data)
- **Email display outside admin**: Never display `reporterEmail` in non-admin UI, timeline text, or seed data (use names or "Anonymous")
- **Permissions matrix drift**: Never change server action auth checks without updating `matrix.ts` (help page auto-generates from it)

---

## Scope Creep Prevention

**The Scope Firewall (3 Questions):**

1. Does this solve a problem we have RIGHT NOW?
2. Does this block a user from achieving the core value proposition?
3. Can we ship MVP without this?

If answers are No/No/Yes → defer to MVP+/1.0/2.0 roadmap.

**The "Done Enough" Standard:**

1. Does it work for the happy path?
2. Does it handle the most common error case?
3. Is it tested with at least one test?
4. Is it secure (input validation, auth checks)?
5. Is the code readable by someone else?

If all Yes → ship it. Perfect is the enemy of done.

---

## Appendices

**Rule IDs:**

- CORE‑TS‑001..006: Type system
- CORE‑SSR‑001..006: Supabase SSR and auth
- CORE‑SEC‑001..007: Security
- CORE‑PERF‑001..002: Performance
- CORE‑TEST‑001..005: Testing
- CORE‑ARCH‑001..008: Architecture

**Cross-References:**

- Testing patterns: `docs/TESTING_PLAN.md`
- Product features: `docs/PRODUCT_SPEC.md`
- Technical architecture: `docs/TECH_SPEC.md`
- Discipline guidelines: `docs/DISCIPLINE.md`
