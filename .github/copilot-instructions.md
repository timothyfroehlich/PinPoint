# PinPoint -- GitHub Copilot Repository Instructions

> Detailed patterns live in `AGENTS.md`, skill files under `.agent/skills/`, and `docs/`. Reference those for deep dives.

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
5. **Type safety**: No forbidden escapes; proper narrowing.
6. **Progressive enhancement**: `<form action={serverAction}>` patterns.
7. **Memory safety**: Worker-scoped DB setup in tests.
8. **E2E quality**: Semantic selectors, no hard-coded delays, independent tests.
9. **Help page accuracy**: If a PR changes roles, statuses, permissions, UI flows, or user-facing terminology, read through `src/app/(app)/help/` pages and flag any content that becomes outdated or inaccurate. Help pages must reflect the current state of the app. Key things to check:
   - Role names must match the access levels in `src/lib/permissions/matrix.ts` (Guest, Member, Technician, Admin)
   - Status names must use display labels from `STATUS_CONFIG` in `src/lib/issues/status.ts`, not raw database values
   - Descriptions of features, workflows, and form fields should match the actual implementation
   - No references to removed features (e.g., roadmap)
   - **Permissions matrix ↔ enforcement sync (CORE-ARCH-008)**: If a PR changes authorization logic in server actions (`actions.ts`), verify that `src/lib/permissions/matrix.ts` values and descriptions match. If a PR changes `matrix.ts`, verify the server actions enforce it. `true` means unconditional access, `"own"` means only resources the user created — mismatches here cause the help page to show incorrect permission information.

## Do Not Generate

- Organization/multi-tenant scoping logic.
- tRPC routers or multi-tenant context wrappers.
- RLS policies or pgTAP tests.
- DAL/service abstractions prematurely (Rule of Three).
- Client components where server rendering suffices.

---

Last Updated: 2026-02-21 (Added CORE-ARCH-008 permissions matrix sync check, fixed stale "no Technician" text)
