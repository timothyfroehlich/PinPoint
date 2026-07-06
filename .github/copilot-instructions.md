# PinPoint — Copilot code review instructions

PinPoint is a **single-tenant** pinball issue tracker (Austin Pinball Collective), in live production with real user data. Stack: Next.js App Router (React Server Components by default), Drizzle ORM on Supabase Postgres, Supabase SSR auth, shadcn/ui + Tailwind CSS v4, TypeScript `ts-strictest`. There is no multi-tenancy, no RLS, and no tRPC — by design.

Cite the `CORE-*` rule ID (e.g. `CORE-SEC-007`) in a review comment when a change violates a rule below, so the author can look it up.

## Highest priority — each of these has shipped a real bug

- **Email privacy (CORE-SEC-007).** A user's email address must never appear outside `/admin/*` views and the user's own settings page. Flag any UI, timeline event, notification body, seed fixture, or prop passed to a client component that renders `reporterEmail` or a raw email elsewhere. The correct display chain is `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`.
- **Permissions through the matrix (CORE-ARCH-008).** Every authorization check must go through `checkPermission()` from `~/lib/permissions/helpers`. Flag any ad-hoc role or permission check defined outside `src/lib/permissions/`. If a PR changes a server action's auth logic, verify `src/lib/permissions/matrix.ts` still agrees; if it changes the matrix, verify the server action enforces it.
- **No side effects inside DB transactions (CORE-ARCH-011).** Flag any HTTP request, email/Discord send, blob upload, or Vault RPC inside a `db.transaction(...)` callback. Inputs are fetched before the transaction; effects are delivered after commit via `after()` + `planNotification`/`dispatchNotification`.

## Type safety (CORE-TS-007, CORE-TS-008)

- Flag `any` (explicit or implicit), non-null assertions (`!`), and unsafe `as` casts. Require narrowing with type guards instead.
- Flag deep relative imports (`../../..`); imports use the `~/` path alias.

## Architecture

- **Server-first (CORE-ARCH-001).** Flag `"use client"` on a component with no interactivity (no event handlers, browser APIs, or client state). Server Components are the default.
- **Minimal client payload (CORE-SEC-006).** Flag a `"use client"` component that receives a whole ORM row or domain object as a prop; the server→client boundary should pass only the fields the component uses. The RSC payload is visible in page source.
- **Migrations only (CORE-ARCH-009).** Schema changes go through `db:generate` + `db:migrate`. Flag any `drizzle-kit push` or Supabase-migration usage. Every new `.sql` migration must have a matching `_snapshot.json`.

## Single-tenant & environment

- Flag any newly introduced org scoping, multi-tenant context wrapper, RLS policy, pgTAP test, or tRPC router — the app has none and should stay that way.
- **`localhost`, never `127.0.0.1` (CORE-SEC-008).** Flag `127.0.0.1` in `supabase/config.toml`, `.env*`, Playwright config, or scripts — browser cookie isolation breaks Supabase SSR auth across the two hosts.

## Help-page accuracy

If a PR changes roles, statuses, permissions, or user-facing terminology, check `src/app/(app)/help/` for content that becomes stale. Role names must match `src/lib/permissions/matrix.ts` (Guest, Member, Technician, Admin). Status labels must use the display labels in `STATUS_CONFIG` (`src/lib/issues/status.ts`), not raw database values.

Detailed, path-scoped rules live in `.github/instructions/*.instructions.md`.
