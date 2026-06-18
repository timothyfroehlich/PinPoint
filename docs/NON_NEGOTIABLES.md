---
trigger: always_on
# For Antigravity
---

# PinPoint Non‑Negotiables

**Last Updated**: 2026-06-18
**Version**: 2.3 (PinballMap API conduct added — CORE-PBM-001)

> **Sync contract**: `AGENTS.md` §2.1 is a one-line index of these rules. Every §2.1 entry cites the canonical `CORE-*` ID(s) here. When a rule changes, update both.

## Overview

**Purpose:** Define strict rules for secure, consistent, maintainable code.

**Scope:** All contributors and AI agents. Applies to application, server, and infrastructure code.

**Enforcement:** Lint rules, CI checks, PR blocking for critical violations.

## Quick Start Checklist

1. Import reusable types from `~/lib/types`; do not duplicate types (CORE-TS-001/002)
2. Keep DB types (snake_case) in schema; convert to camelCase at boundaries (CORE-TS-003/004)
3. Use Supabase SSR wrapper `~/lib/supabase/server`, call `auth.getUser()` immediately (CORE-SSR-001/002)
4. Ensure Next.js middleware for Supabase SSR token refresh is present (CORE-SSR-003)
5. Use database trigger for auto-profile creation (OAuth-proof, atomic) (CORE-SSR-006)
6. Wrap server data access with React 19 `cache()` (CORE-PERF-001)
7. Use `~/` path aliases, avoid deep relative imports (CORE-TS-008)
8. Never use `any`, non-null `!`, or unsafe `as` (CORE-TS-007)
9. Default to Server Components, minimal Client Components (CORE-ARCH-001)
10. Map data to minimal shapes before passing to Client Components (CORE-SEC-006)
11. Forms work without JavaScript (CORE-ARCH-002)
12. Drizzle migrations only — no `drizzle-kit push` (CORE-ARCH-009)
13. Use `localhost`, never `127.0.0.1`, for local URLs (CORE-SEC-008)
14. Pick the cheapest test layer that catches the bug class (CORE-TEST-005)
15. Email addresses never displayed outside admin / settings (CORE-SEC-007)
16. Permissions go through `checkPermission()`; matrix must match enforcement (CORE-ARCH-008)
17. Mock third-party SDKs at their boundary; no live external services in E2E (CORE-TEST-006)
18. Rule of Three before abstracting (CORE-ARCH-010)
19. Baseline Widely available is the browser-support floor; look up patterns via the modern-web-guidance catalog (CORE-UI-005/006)
20. Forms ship with the correct input `type`, `autocomplete` token, `:user-invalid` styling, and visible required indicators (CORE-FORM-001..006)
21. Accessibility floor: skip link, semantic table markup, `motion-reduce:` paired with animations, no `<div role="button">`, `title` is not a tooltip (CORE-A11Y-001..006)
22. Image priority and preconnect discipline: `priority` is for the LCP candidate only; preconnect to known image origins (CORE-PERF-003)
23. External side effects (HTTP, email, Discord, blob, Vault RPC) never run inside a DB transaction; deliver them post-commit (CORE-ARCH-011)

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

**CORE-TS-007:** No TypeScript safety escapes

- **Severity:** Critical
- **Why:** `any`, non-null `!`, and unsafe `as` defeat ts-strictest and hide real bugs
- **Do:** Use proper type guards, narrowing, and Zod-validated shapes. Reach for `unknown` + a guard instead of `any`.
- **Don't:** Use `any`, non-null assertions (`x!`), or unsafe casts (`as Foo`) to silence the type checker

**CORE-TS-008:** Always use `~/` path aliases

- **Severity:** Required
- **Why:** Deep relative imports (`../../../lib/foo`) break under file moves and obscure module boundaries
- **Do:** Import from `~/` (e.g. `import { foo } from "~/lib/foo"`)
- **Don't:** Use `../../..` or longer relative paths for cross-feature imports

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

**CORE-SEC-008:** Use `localhost`, never `127.0.0.1`, for local dev URLs

- **Severity:** Critical
- **Why:** Browser cookies set on `localhost` are not sent to `127.0.0.1`. Mixing the two across Supabase site URL, Next.js dev server, and Playwright `baseURL` breaks SSR auth — Server Actions see anonymous users after a successful login.
- **Do:** Use `localhost` in `supabase/config.toml`, `.env*`, Playwright `baseURL`, health-check scripts, and any local HTTP endpoint.
- **Don't:** Use `127.0.0.1:NNNN` for any local URL agents or the dev stack will read. CSP rules and validation checks that intentionally cover both forms are the only exception.

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

**CORE-PERF-003:** Image priority and preconnect discipline

- **Severity:** Required
- **Why:** `priority` (which emits `fetchpriority="high"`, Baseline Widely available) is a zero-sum signal — every prioritized image deprioritizes every other resource. Marking non-LCP images as `priority` (e.g., the 32px header logo, a sidebar logo, an image inside a closed dialog) burns budget the browser can't reclaim. Likewise, the first request to a known image origin pays full DNS + TLS handshake cost unless preconnected.
- **Do:** Set `priority` on exactly one image per page — the LCP candidate — and only when you've confirmed it is above the fold for the dominant viewport. Always provide `sizes` for images that render at non-`100vw`. Add `<link rel="preconnect">` in the root layout for known image origins (e.g., Vercel Blob bucket).
- **Don't:** Sprinkle `priority` on logos, hero variants, or pre-mounted dialog images "just in case." Don't omit `sizes` on `priority` images.
- **Reference:** modern-web-guidance `optimize-image-priority`, `optimize-preload-priority`.

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
- **Do:** Reference the `pinpoint-testing` skill (`.agent/skills/pinpoint-testing/SKILL.md`) for bug-class-driven test layer selection
- **Don't:** Mix test types or create per-test database instances

**CORE-TEST-004:** Prefer Integration Tests for DB Logic

- **Severity:** Required
- **Why:** Mocking Drizzle/DB clients leads to brittle, over-mocked tests that don't verify actual behavior
- **Do:** Use integration tests (with PGlite) for service layer logic that primarily interacts with the database
- **Don't:** Write unit tests that require extensive mocking of `db.query`, `db.transaction`, or method chains

**CORE-TEST-005:** Interaction Coverage at the Cheapest Catching Layer

- **Severity:** Required
- **Why:** Tests that verify element existence without exercising the handler miss broken wiring (PR #894 pattern). But E2E is not always the cheapest layer that catches that bug class — see AGENTS.md §2.1 "Interaction Coverage at the Cheapest Layer" and the 2026-05 audit (`docs/testing/e2e-audit-2026-05.md`).
- **Do:** Every clickable user-facing element must be exercised by at least one test that actually invokes its handler. Pick the layer by bug class: multi-step journeys → E2E; Server Action wiring / permissions / DB queries → integration (PGlite + direct action call); pure form-state / UI logic → RTL unit.
- **Don't:** Only assert `toBeVisible()` without testing the interaction. Also don't reflexively write E2E for every clickable — integration or RTL is usually faster and more thorough for class-B / E / I bugs.

**CORE-TEST-006:** Test what we own (class-J)

- **Severity:** Critical
- **Why:** Synthesizing a third party's internal state (raw writes to `auth.identities`, OAuth handshake fakes, captcha-verification mocks, email-template regex extraction) means you're testing the third party, not PinPoint. Any production third-party hostname reachable from an E2E run can also exfiltrate test data or hit real rate limits.
- **Do:** Mock third-party SDKs at their boundary (`fetch` inside `src/lib/<sdk>/*.ts`, with a matching `*.test.ts`). Cover PinPoint's contribution with unit tests; cover "renders without 500" with smoke. Reserve integration/E2E for the contracted public API of owned services (Mailpit, PGlite, local Supabase including local Storage).
- **Don't:** Drive live Discord webhooks, real OAuth provider redirects, vendor email templates, or any production third-party endpoint from an E2E spec. Two-layer self-check before merging: (1) `rg 'https?://' e2e/path/spec.ts` returns only `localhost`/`127.0.0.1`/owned-domain hits; (2) any production URL reached indirectly via server actions lives inside an SDK client module with a `*.test.ts` mocking `fetch`. Casework: PP-e20, PP-uc8, PP-q9r.

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
- **Why:** The help page (`/help/permissions`) is auto-generated from `src/lib/permissions/matrix.ts`. If the matrix drifts from what server actions actually enforce, users see incorrect capability information. All permission checks MUST go through `checkPermission()` from `~/lib/permissions/helpers`; no standalone permission functions outside `src/lib/permissions/`.
- **Do:** When changing permission logic in server actions, update `matrix.ts` values and descriptions to match. Review both directions during PR review.
- **Don't:** Change server action authorization checks without updating the matrix (or vice versa). Don't add permission helpers outside `src/lib/permissions/`.

**CORE-ARCH-009:** Drizzle migrations only — no `drizzle-kit push`

- **Severity:** Critical
- **Why:** Production has real user data. `push` bypasses migration history, can drop columns silently, and corrupts the schema's relationship to `drizzle/meta` snapshots. Supabase migrations are disabled (`db.migrations.enabled = false`) — Drizzle is the single source of truth.
- **Do:** Use `pnpm run db:generate` to author migrations, then `pnpm run db:migrate` to apply. Treat `drizzle/meta` snapshots as authoritative; never edit them by hand (see also `AGENTS.md` §5 Migration conflicts).
- **Don't:** Run `drizzle-kit push` against any database (local, preview, prod). Don't use Supabase CLI migrations. Don't hand-edit `drizzle/meta/*.json`.

**CORE-ARCH-010:** Rule of Three before abstracting

- **Severity:** Required
- **Why:** Premature abstractions invented for the first or second use case usually fit one of those shapes badly and force the third to bend. Pre-beta code with no scale data can't predict the right shape.
- **Do:** Wait until you have three concrete instances before extracting a helper, hook, or service abstraction. Inline duplication is cheaper than the wrong abstraction.
- **Don't:** Build a DAL, service layer, error hierarchy, or shared hook because you "might need it later." Don't refactor on the second duplication.

**CORE-ARCH-011:** External side effects never run inside a DB transaction

- **Severity:** Critical
- **Why:** The "Doodle Bug" (PP-2053). A user reported an issue, got a confirmation email with a working link, but the issue was never persisted and no alert fired. Root cause: the confirmation email was sent from a Resend HTTP call executed _inside_ the issue-creation transaction, before COMMIT. When the request was killed mid-flight the transaction rolled back, but the email had already gone out — a silent write-loss. A transaction can roll back at any point; anything irreversible done before COMMIT can outlive a write that never lands.
- **Do:** Keep transaction callbacks to transactional DB work only. Fetch external inputs (e.g. the Discord Vault token via `getDiscordConfig()`) _before_ opening the transaction. Deliver external effects _after_ commit — use `after()` in a Server Action plus the two-phase `planNotification` (in-transaction writes) / `dispatchNotification` (post-commit fan-out) split. A runtime tripwire enforces this: `db.transaction` sets an in-transaction `AsyncLocalStorage` flag (`~/server/db/transaction-context`), and the email / Discord / blob / Vault-RPC client wrappers throw `SideEffectInTransactionError` if invoked while it is set — failing loudly in dev, test, and CI. A static ESLint backstop (`no-restricted-syntax`, options in `eslint-rules/no-side-effects-in-transaction.mjs`) catches the same violation at lint/CI time, before runtime: it flags calls to `sendEmail` / `sendDm` / `dispatchNotification` / `uploadToBlob` / `deleteFromBlob` / `getDiscordConfig` / `fetch` / `*.emails.send` inside a `db.transaction(...)` callback.
- **Don't:** Call `sendEmail`, `sendDm`, `uploadToBlob`/`deleteFromBlob`, `getDiscordConfig`, `fetch`, or any other HTTP/IO from inside a `db.transaction(...)` callback. Don't "optimize" by moving a pre-fetch into the transaction. Don't catch and swallow `SideEffectInTransactionError` — fix the call site to run post-commit.

---

## Integrations

**CORE-PBM-001:** Respect PinballMap's published API conduct

- **Severity:** High
- **Why:** PinballMap is a third-party community service we both read from and write to publicly. Their `llms.txt` sets explicit conduct (use bulk endpoints, don't poll in loops, store-and-reuse tokens, real-but-generous rate limits) and their `robots.txt` blocks AI crawlers from the website — the documented JSON API is the only sanctioned channel. Their FAQ requires attribution + a link back when displaying their data. Ignoring this risks rate-limit bans and violates their terms.
- **Do:** Route all PBM access through the `PinballMapClient` seam (`~/lib/pinballmap`). Use the documented JSON API per the vendored `docs/external/pinballmap-llms.txt`; one location call per hour for sync; store and reuse tokens in Supabase Vault; send a descriptive User-Agent with a contact URL; back off on 429; render attribution + a link back to pinballmap.com wherever PBM data appears. Re-read the vendored `docs/external/pinballmap-*` files (kept current by the drift GHA) before changing integration code.
- **Don't:** Crawl or scrape pinballmap.com HTML; poll the API in loops to detect changes; call `auth_details` per request; use undocumented/web-only routes; or reach pinballmap.com from any test (that is also CORE-TEST-006 — mock at the client seam).

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

## Responsive Framework

**CORE-RESP-001:** Two-layer responsive system

- **Severity:** Critical
- **Why:** Mixing viewport and container queries for the same layout decision creates unpredictable behavior and debugging complexity
- **Do:** Viewport breakpoints (`md:`, `lg:`) for page structure; container queries (`@lg:`, `@xl:`) for component internals
- **Don't:** `md:flex-row` on a component inside a variable-width container (use `@xl:flex-row`)

**CORE-RESP-002:** No JavaScript viewport detection

- **Severity:** High
- **Why:** JS viewport checks create hydration mismatches, add resize listeners, and duplicate CSS's job
- **Do:** Use Tailwind breakpoint classes or container queries
- **Don't:** `window.innerWidth`, `window.matchMedia`, `useMediaQuery` hooks

**CORE-RESP-003:** sm: is padding only

- **Severity:** High
- **Why:** `sm:` (640px) is too narrow for reliable layout shifts; `md:` (768px) is the primary pivot
- **Do:** `sm:px-8`, `sm:gap-4`
- **Don't:** `sm:grid-cols-2`, `sm:flex-row`, `hidden sm:block`

**CORE-RESP-004:** Overflow testing required

- **Severity:** High
- **Why:** Horizontal overflow is invisible to Playwright visibility assertions but breaks the user experience
- **Do:** Add route to `e2e/smoke/responsive-overflow.spec.ts` when creating a new page
- **Don't:** Ship a new page without overflow coverage at both mobile and desktop viewports

---

## Browser Support

**CORE-UI-005:** Baseline Widely available is the browser-support floor

- **Severity:** Critical
- **Why:** Pinning a clear floor is what makes a "modern web" basis useful — every UI decision is anchored to the set of HTML / CSS / JS features the browser platform considers cross-browser stable. **Baseline Widely available** means a feature has been available in all major engines for ~2.5 years and is safe without fallbacks. Aim higher and Safari users break; aim lower and the bundle bloats with polyfills for features already shipping natively.
- **Do:** Reach for Baseline Widely available primitives directly: `<dialog>`, container queries, `:has()`, `:user-invalid`, `inert`, `aspect-ratio`, native form validation, `fetchpriority`, CSS Grid `auto-fit/minmax`. (`text-wrap: balance` / `text-pretty` are Newly available — see `pinpoint-design-bible` §19 deferred list; the existing §9 typography rule uses them selectively, which predates and is grandfathered into this policy.) No feature detection or polyfill needed.
- **Don't:** Adopt Baseline Newly available features (Popover API, View Transitions, anchor positioning, scroll-driven animations, `interestfor`, the `closedby` attribute) without a per-feature opt-in documented in `pinpoint-design-bible` §19. Don't add a polyfill for any Widely-available feature.
- **Reference:** `pinpoint-design-bible` §19 Browser Support Policy. To check a feature's status, search the modern-web-guidance catalog (CORE-UI-006) — every guide notes its Baseline status.

**CORE-UI-006:** Use the modern-web-guidance catalog for pattern lookup

- **Severity:** Required
- **Why:** Web platform features evolve faster than LLM training data refreshes. Memorizing patterns produces stale code. The Google Chrome `modern-web-guidance` plugin ships ~90 prescriptive guides — searchable by use case, each with Baseline status — and is the canonical reference for "what's the right way to do X today."
- **Do:** At the start of any non-trivial UI work, search the catalog: `npx -y modern-web-guidance@latest search "<query>"`. Retrieve specific guides by id with `retrieve "<id>,<id2>"`. Check the guide's Browser Support section against CORE-UI-005 before adopting any recommendation.
- **Don't:** Implement ad-hoc patterns when a Widely-available primitive exists for the same job. Don't pre-emptively pull every guide into context; search per task.
- **Reference:** Plugin is installed at `~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/`.

---

## Accessibility

**CORE-A11Y-001:** Skip-to-main-content link

- **Severity:** Required
- **Why:** WCAG 2.4.1 Level A. Without it, keyboard users tab through the AppHeader navigation on every single page load before reaching content. PinPoint's header has 6+ tab stops; that's a hard daily-driver cost for any keyboard-first user.
- **Do:** The first child of `<body>` (in `src/app/layout.tsx`) must be `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>`. The `<main>` element in `MainLayout.tsx` must carry `id="main-content"` and `tabIndex={-1}`.
- **Don't:** Ship a layout that puts content behind the header in tab order with no skip affordance.
- **Status:** Not yet implemented; implementation tracked under beads epic PP-kqbk (child PP-kqbk.3). New layouts must satisfy this rule.

**CORE-A11Y-002:** `motion-reduce:` pairs with every animation utility

- **Severity:** Required
- **Why:** Users with vestibular disorders need to suppress motion. The `prefers-reduced-motion` media query is Baseline Widely available, and Tailwind exposes the `motion-reduce:` variant out of the box. Adding `motion-reduce:animate-none` costs one utility and removes the motion entirely for users who request it.
- **Do:** Every `animate-*` or `transition-*` utility that drives non-essential motion is paired with `motion-reduce:animate-none` (or `motion-reduce:transition-none` where appropriate). Loading spinners use `animate-spin motion-reduce:animate-none` — the static icon remains and is still recognizable as "loading."
- **Don't:** Ship bare `animate-spin`, `animate-pulse`, or `animate-bounce`. Don't write JS feature-detection for `prefers-reduced-motion` — use the CSS variant.
- **Reference:** modern-web-guidance `accessibility` § Motion.

**CORE-A11Y-003:** Data tables ship with semantic structure

- **Severity:** Required
- **Why:** WCAG 1.3.1 Level A. Without `scope="col"` on header cells, screen readers can't announce the column header for each data cell. Without `aria-sort`, sort state is invisible to AT. Without `<caption>` or `aria-label`, the table has no accessible name in the page outline.
- **Do:** Every `<th>` carries `scope="col"`. Sortable columns expose `aria-sort="ascending" | "descending" | "none"` synced to the active sort. The `<table>` has either a visible `<caption>` or an `aria-label` describing its contents. The table at `src/components/issues/IssueList.tsx` is the reference implementation — match its semantics for new tables.
- **Don't:** Render a `<th>` without `scope`. Don't ship a sortable table with no `aria-sort`. Don't rely on column header text alone — that's not what AT uses.

**CORE-A11Y-004:** No `<div role="button">` — use real `<button>`

- **Severity:** Critical
- **Why:** WCAG 4.1.2 Level A. `<button>` is the platform primitive: implicit keyboard semantics (Enter + Space), focus ring, role, name, and default form-submission behavior. `<div role="button" tabIndex={0} onKeyDown={...} onClick={...}>` reimplements these and almost always misses one (typically Space key, the accessible name, or focus return). When in doubt, the answer is `<button type="button">`.
- **Do:** Use `<button type="button">` for any clickable that isn't a form-submit or a navigation. Style it to look like whatever it needs to (a card, a row, a chip) — `<button>` is fully restylable. For navigation, use `<Link>`/`<a>`.
- **Don't:** Reach for `<div onClick>` or `<div role="button" tabIndex={0}>`. If you find one, replace it.

**CORE-A11Y-005:** `title` attribute is not a tooltip

- **Severity:** Required
- **Why:** The `title` attribute is unreliable on touch (never fires) and not consistently surfaced by screen readers on non-interactive elements. Using `title="explanation of what this does"` as a tooltip leaves both screen-reader users and touch users with no affordance.
- **Do:** For supplemental hover/focus information, use the shadcn `<Tooltip>` (which wires `aria-describedby`) plus an `aria-label` on the trigger if the visible label is missing. For interactive elements that are disabled, surface the "why disabled" as visible text or as the button's accessible name — never tooltip-only.
- **Don't:** Ship `title="..."` as the only place a piece of information lives. Don't put `title` on disabled controls expecting touch users to see it.

**CORE-A11Y-006:** `inert` for non-interactive background regions

- **Severity:** Required
- **Why:** The `inert` global attribute (Baseline Widely available) removes an element and all its descendants from the tab order, click handling, and the accessibility tree in one declarative step. `aria-hidden` alone is weaker — it removes from the AT tree but not from the tab order, so keyboard focus can still tab into background content. When a modal opens, the background should be `inert`.
- **Do:** When opening a modal that doesn't use native `<dialog>.showModal()` (Radix Dialog, Sheet, AlertDialog, Drawer), set `inert` on the page root or the sibling containing background content. Wire `anyModalOpen` state once in `ClientProviders.tsx` (the same place that hosts the existing `<TooltipProvider>`) and consume it via React context — don't track open state per modal. Radix's `onOpenChange` callback feeds this context. Native `<dialog>` handles this automatically via top-layer.
- **Don't:** Rely on `aria-hidden="true"` + pointer-events tricks alone. Don't manually manage focus trapping when `inert` does it for you.
- **Status:** Not yet implemented; tracked under PP-kqbk.8.

---

## Forms

**CORE-FORM-001:** Use the specific input `type`

- **Severity:** Required
- **Why:** `type="email"` triggers the email keyboard on mobile and enables free native format validation; `type="tel"` triggers the numeric keypad; `type="url"` adds URL hints. `type="text"` is the wrong default for typed identity inputs — it loses the keyboard hint and the validation.
- **Do:** `type="email"` for any email field (login, signup, anonymous-reporter contact, password reset). `type="tel"` for phone. `type="url"` for URLs. `type="password"` for any secret. `type="number"` only when the value is a number you'll do math on — for postal codes, IDs, and similar, use `type="text" inputMode="numeric"`.
- **Don't:** Ship `<input type="text">` for an email field. Don't suppress the type to bypass a mobile keyboard quirk — fix the quirk.

**CORE-FORM-002:** Autocomplete tokens on every credential/identity input

- **Severity:** Critical
- **Why:** Password managers and browser autofill key on the `autocomplete` attribute. Wrong or missing tokens mean credentials don't autofill, generated passwords aren't offered, and the confirm-password field gets autofilled with the user's existing password — silently breaking the flow.
- **Do:** Sign-in form: `autocomplete="username"` on email + `id="current-password"` on the password field with `autocomplete="current-password"`. Sign-up form: `autocomplete="username"` on email, `autocomplete="new-password"` on the new password field, `autocomplete="off"` on the confirm-password field. Anonymous-reporter forms get `autocomplete="given-name"`, `autocomplete="family-name"`, `autocomplete="email"`. Domain-specific pickers that should NOT be autofilled (e.g., machine selector) set `autocomplete="off"` explicitly.
- **Don't:** Put `autocomplete="new-password"` on the confirm field. Don't share an `id` between login and signup password fields. Don't omit the attribute on anonymous-reporter forms.
- **Reference:** modern-web-guidance `autofill-sign-in-form`, `autofill-sign-up-form`, `autofill-address-form`.

**CORE-FORM-003:** `:user-invalid` styling on the shared Input primitive

- **Severity:** Required
- **Why:** `:user-invalid` (Baseline Widely available) flips a CSS pseudo-class on form controls only **after** the user has interacted with them — no premature red rings on page load, no JS state mirroring, no event listeners. The shared `<Input>` already has `aria-invalid:` styling; pair it with `:user-invalid:` and the browser does the rest.
- **Do:** `src/components/ui/input.tsx` (and `textarea.tsx`, `select.tsx`) must carry the equivalent of `[&:user-invalid]:border-destructive [&:user-invalid]:ring-destructive/40` so every input automatically picks up post-interaction invalid styling. Add to the primitive once — don't copy this per form.
- **Don't:** Hand-roll `useState` + `onBlur` to mirror invalid state. Don't paint inputs red on initial render.
- **Reference:** modern-web-guidance `validate-input-after-interaction`.
- **Status:** Not yet implemented; tracked under PP-kqbk.2.

**CORE-FORM-004:** `aria-invalid` synced for screen readers

- **Severity:** Required
- **Why:** `:user-invalid` is a CSS pseudo-class — visual only. Screen readers need `aria-invalid="true"` to announce "invalid" alongside the field label. Without it, AT users get only the form-level alert after a server round-trip.
- **Do:** Add the `onBlur` listener to `src/components/ui/input.tsx` (and `textarea.tsx`, `select.tsx`) **once** so every form picks it up automatically — same primitive that hosts CORE-FORM-003 styling. The listener sets `aria-invalid="true"` on inputs that fail `checkValidity()` after first interaction, and `aria-invalid="false"` when the value becomes valid again. Do not copy the listener per form.
- **Don't:** Set `aria-invalid="true"` on initial render. Don't rely solely on the form-level `<Alert>` to communicate per-field errors.
- **Reference:** modern-web-guidance `accessible-error-announcement`, `required-field-feedback`.
- **Status:** Not yet implemented; tracked under PP-kqbk.2 (bundled with CORE-FORM-003).

**CORE-FORM-005:** Required fields are visually marked before interaction

- **Severity:** Required
- **Why:** Without a visual cue, users only learn a field is required by failing to submit. That's a low-grade frustration that compounds across multi-field forms. Required-field indicators are standard form hygiene and a WCAG-recommended practice.
- **Do:** Append a `*` (or `<span aria-hidden="true">*</span>` with a form-level legend explaining "\* required") to the `<Label>` of every `required` field. Or use the project's `<RequiredLabel>` helper if/when one exists.
- **Don't:** Rely on the post-submit error message to teach the user which fields are required.

**CORE-FORM-006:** `enterkeyhint` on sequential mobile fields

- **Severity:** Required
- **Why:** On mobile, the default "return" key offers no cue about flow. `enterkeyhint="next"` → "next" → "done" walks the user through the form with the correct keyboard action label at each step. Baseline Widely available. One attribute per field; high payoff.
- **Do:** Multi-field forms set `enterkeyhint="next"` on every field except the last, which gets `enterkeyhint="done"` (or `"send"`/`"search"` per intent).
- **Don't:** Ship a multi-field form with no `enterkeyhint`.

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

- CORE‑TS‑001..008: Type system
- CORE‑SSR‑001..007: Supabase SSR and auth
- CORE‑SEC‑001..008: Security
- CORE‑PERF‑001..003: Performance (incl. image priority + preconnect)
- CORE‑TEST‑001..006: Testing
- CORE‑ARCH‑001..010: Architecture (003 retired)
- CORE‑RESP‑001..004: Responsive framework
- CORE‑UI‑001..006: UI & styling + Browser support / MWG catalog (005, 006)
- CORE‑A11Y‑001..006: Accessibility floor
- CORE‑FORM‑001..006: Form correctness
- CORE‑PBM‑001: PinballMap API conduct

**Cross-References:**

- Testing patterns: `pinpoint-testing` skill (`.agent/skills/pinpoint-testing/SKILL.md`)
- Product features: `docs/PRODUCT_SPEC.md`
- Technical architecture: `docs/TECH_SPEC.md`
- Discipline guidelines: `docs/DISCIPLINE.md`
