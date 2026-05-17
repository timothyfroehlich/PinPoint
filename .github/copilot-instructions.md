# PinPoint -- GitHub Copilot Repository Instructions

> Detailed patterns live in `AGENTS.md`, skill files under `.agent/skills/`, and `docs/`. Reference those for deep dives.
>
> **Canonical rule sources** (read these for full rule text):
>
> - `docs/NON_NEGOTIABLES.md` — the CORE-\* rule catalog (TS, SSR, SEC, PERF, TEST, ARCH, RESP, UI families) with severities and rationale.
> - `AGENTS.md` §2.1 — 14 numbered implementation rules + casework.
> - `NON_NEGOTIABLES.md` (repo root) — three production-critical rules: email privacy, permissions matrix accuracy, localhost domain standard.
> - Path-scoped review guidance lives in `.github/instructions/*.instructions.md` (auto-applied via `applyTo` globs).
>
> Cite rules by ID (e.g. CORE-SEC-007) in review comments so authors can look up the full text.

## Status & Context

- **Phase**: Soft-launched (Beta) -- MVP+ Polish
- **Users**: Active users at Austin Pinball Collective. This is a live app with real data.
- **Core Value**: Log issues for pinball machines, track repair work, resolve them.
- **Tenant Model**: Single-tenant (Austin Pinball Collective). No org scoping, no RLS, no multi-tenant isolation.
- **Safety**: Destructive operations (migrations, deletions, data changes) require extra care. Real users depend on this data.

## Architectural Pillars

1. **Server-First**: Prefer React Server Components. `"use client"` only for interactivity (events, browser APIs, dynamic state).
2. **Direct Data Access**: Drizzle ORM directly from Server Components & Server Actions. No DAL/service abstractions until Rule of Three.
3. **Progressive Enhancement**: Forms must work without JavaScript: `<form action={serverAction}>`.
4. **Strict TypeScript**: ts-strictest -- no `any`, no non-null `!`, no unsafe `as`. Narrow types + guards.
5. **Drizzle Migrations**: Use `db:generate` + `db:migrate`. Never `drizzle-kit push`. Never Supabase migrations.
6. **Memory Safety**: Worker-scoped PGlite for integration tests. Never per-test DB instances.
7. **Domain Rules**: Every issue belongs to exactly one machine. Severity: `minor | playable | unplayable`.
8. **UI Stack**: shadcn/ui + Tailwind CSS v4 + Material Design 3 color tokens. Never MUI.

## Auth

- SSR only via `src/lib/supabase/server.ts`: `createClient()` then immediately `auth.getUser()`.
- Middleware handles token refresh; do not mutate the response object.
- Auth pages use Server Components + forms posting to Server Actions.

## Testing

- **Unit**: Pure logic (status derivation, validation).
- **Integration**: Drizzle queries + Server Actions with worker-scoped PGlite.
- **E2E**: Playwright for full user flows. Follow `docs/E2E_BEST_PRACTICES.md` for selectors, organization, anti-patterns.
- If you add a clickable UI element, it must be exercised in an E2E test.

## Quality Gates

```bash
pnpm run check       # Fast: types + lint + format:fix + unit tests (may modify files)
pnpm run preflight   # Full: check + build + DB reset + integration + smoke/e2e (pre-commit)
```

Conventional commit messages required.

## Copilot Review Priorities

1. **Never merge without explicit approval** -- even if CI is green.
2. **Regression checks**: Review recent commits for patterns that should not be reintroduced.
3. **Security & data integrity**: Input validation, single-tenant assumptions, issue-machine relationship.
4. **Server-first compliance**: No unnecessary `"use client"`.
5. **Type safety**: No forbidden escapes (`any`, non-null `!`, unsafe `as`); proper narrowing with type guards.
6. **Progressive enhancement**: `<form action={serverAction}>` patterns. Server Action wiring (CORE-ARCH-005/006/007): direct refs only in forms, `onSelect` in `DropdownMenuItem`, `useActionState` for feedback (no flash messages).
7. **Memory safety**: Worker-scoped DB setup in tests.
8. **E2E quality**: Semantic selectors, no hard-coded delays (`page.waitForTimeout`), independent tests.
9. **Help page accuracy**: If a PR changes roles, statuses, permissions, UI flows, or user-facing terminology, read through `src/app/(app)/help/` pages and flag any content that becomes outdated or inaccurate. Help pages must reflect the current state of the app. Key things to check:
   - Role names must match the access levels in `src/lib/permissions/matrix.ts` (Guest, Member, Technician, Admin)
   - Status names must use display labels from `STATUS_CONFIG` in `src/lib/issues/status.ts`, not raw database values
   - Descriptions of features, workflows, and form fields should match the actual implementation
   - No references to removed features (e.g., roadmap)
   - **Permissions matrix ↔ enforcement sync (CORE-ARCH-008)**: If a PR changes authorization logic in server actions (`actions.ts`), verify that `src/lib/permissions/matrix.ts` values and descriptions match. If a PR changes `matrix.ts`, verify the server actions enforce it. `true` means unconditional access, `"own"` means only resources the user created — mismatches here cause the help page to show incorrect permission information.
10. **Email privacy (CORE-SEC-007 / NON_NEGOTIABLES.md)**: Email addresses MUST NEVER appear outside `/admin/*` views and the user's own settings page. Flag any UI, timeline event, seed fixture, notification body, or client-serialized payload that falls back to `reporterEmail`. Use the name hierarchy: `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`. This rule has shipped a bug before.
11. **Matrix-only permissions (AGENTS.md §2.1 #12)**: All permission checks MUST go through `checkPermission()` from `~/lib/permissions/helpers`. Flag any standalone permission function defined outside `src/lib/permissions/`. The help page auto-generates from the matrix — divergent enforcement paths cause users to see wrong information.
12. **Test What We Own — class-J (AGENTS.md §2.1 #14)**: E2E specs MUST NOT drive live external services. Owned local stack only: Mailpit, PGlite, local Supabase (including local Storage). Flag any spec that hits `discord.com`, `googleapis.com`, real OAuth providers, vendor email templates, or captcha-verification endpoints. Two-layer self-check: (a) `rg 'https?://' <spec>` must show only localhost/owned-domain URLs; (b) any production third-party URL touched indirectly via server actions must live in an SDK client module that has a `*.test.ts` mocking `fetch` at the boundary. Diagnostic: "If this ran against production with real credentials, would the same code pass?" If no, the test is wrong — replace with an SDK-boundary mock.
13. **Two-layer responsive framework (CORE-RESP-001..004 / AGENTS.md §2.1 #13)**: Viewport breakpoints (`md:`, `lg:`) for **page structure**; container queries (`@lg:`, `@xl:`) for **component internals**. Never mix the two for the same layout decision. `sm:` is padding/spacing only — never `sm:flex-row`, `sm:grid-cols-2`, `hidden sm:block`. No JS viewport detection (`window.innerWidth`, `useMediaQuery`, `matchMedia`). New pages MUST be added to `e2e/smoke/responsive-overflow.spec.ts`.
14. **Cheapest-layer testing (CORE-TEST-005)**: Don't reflexively reach for E2E. Multi-step user journeys → E2E. Server Action wiring / permission checks / DB query correctness → integration (PGlite + direct action call). Pure form-state / UI logic → RTL unit. Smoke E2E covers "page renders without 500" only. See `pinpoint-testing` skill § "Bug Classes & Cheapest Catching Layer".
15. **Minimal RSC payload (CORE-SEC-006)**: Flag `"use client"` components receiving full ORM/domain objects (`UnifiedUser`, full profile rows, full issue rows) as props. The RSC payload is visible in page source — map to the minimal shape the component actually uses at the server→client boundary.
16. **Migrations only, no `drizzle-kit push`**: All schema changes flow through `pnpm run db:generate` + `pnpm run db:migrate`. Production has real user data — `push` bypasses migration history and corrupts state.
17. **No `auth.users` queries (CORE-SSR-007)**: Application code reads user data from `user_profiles`, never from Supabase's internal `auth.users` table. Exceptions: `supabase/seed.sql` triggers and `pglite.ts` test setup.
18. **localhost domain standard (NON_NEGOTIABLES.md)**: Local URLs use `localhost`, not `127.0.0.1`. Browser cookie isolation breaks Supabase SSR auth across the two — flag any `127.0.0.1:NNNN` in `supabase/config.toml`, `.env*`, Playwright config, or health-check scripts.

## Do Not Generate

- Organization/multi-tenant scoping logic.
- tRPC routers or multi-tenant context wrappers.
- RLS policies or pgTAP tests.
- DAL/service abstractions prematurely (Rule of Three).
- Client components where server rendering suffices.

---

Last Updated: 2026-05-17 (Added review priorities 10-18: email privacy CORE-SEC-007, matrix-only permissions §2.1 #12, class-J §2.1 #14, two-layer responsive CORE-RESP-001..004, cheapest-layer testing CORE-TEST-005, minimal RSC payload CORE-SEC-006, migrations-only, auth.users ban CORE-SSR-007, localhost domain. Added canonical-rules pointer to docs/NON_NEGOTIABLES.md.)
