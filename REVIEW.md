# PinPoint — Code Review Brief

This is the canonical review rubric for PinPoint. It is harness-neutral: Claude Code reads it via a pointer in `CLAUDE.md` (and via the `/code-review` skill), and `AGENTS.md` points reviewers here. Any reviewer reads the same brief — edit only here.

PinPoint is a **single-tenant** pinball issue tracker (Austin Pinball Collective), in live production with real user data. Stack: Next.js App Router (React Server Components by default), Drizzle ORM on Supabase Postgres, Supabase SSR auth, shadcn/ui + Tailwind CSS v4, TypeScript `ts-strictest`. There is no multi-tenancy, no RLS, and no tRPC — by design.

Cite the `CORE-*` rule ID (e.g. `CORE-SEC-007`) in a review comment when a change violates a rule below, so the author can look it up.

## Highest priority — each of these has shipped a real bug

- **Email privacy (CORE-SEC-007).** A user's email address must never appear outside `/admin/*` views and the user's own settings page. Flag any UI, timeline event, notification body, seed fixture, or prop passed to a client component that renders `reporterEmail` or a raw email elsewhere. The correct display chain is `reportedByUser.name` → `invitedReporter.name` → `reporterName` → `"Anonymous"`.
- **Permissions through the matrix (CORE-ARCH-008).** Every authorization check must go through `checkPermission()` from `~/lib/permissions/helpers`, or a centralized resource predicate in `src/lib/permissions/` for multi-dimensional entity state (collaborators, tokens, compound ownership) that delegates its role dimension to `checkPermission()`. Flag any standalone permission check defined outside `src/lib/permissions/` or any hardcoded role comparison used as an authorization gate. If a PR changes a server action's or loader's auth logic, verify `src/lib/permissions/matrix.ts` still agrees; if it changes the matrix, verify the server action enforces it.
- **No side effects inside DB transactions (CORE-ARCH-011).** Flag any HTTP request, email/Discord send, blob upload, or Vault RPC inside a `db.transaction(...)` callback. Inputs are fetched before the transaction; effects are delivered after commit via `after()` + `planNotification`/`dispatchNotification`.

## Type safety (CORE-TS-007, CORE-TS-008)

- Flag `any` (explicit or implicit), non-null assertions (`!`), and unsafe `as` casts. Require narrowing with type guards instead.
- Flag deep relative imports (`../../..`); imports use the `~/` path alias.

## Architecture

- **Server-first (CORE-ARCH-001).** Flag `"use client"` on a component with no interactivity (no event handlers, browser APIs, or client state). Server Components are the default.
- **Minimal client payload (CORE-SEC-006).** Flag a `"use client"` component that receives a whole ORM row or domain object as a prop; the server→client boundary should pass only the fields the component uses. The RSC payload is visible in page source.
- **Migrations only (CORE-ARCH-009).** Schema changes go through `db:generate` + `db:migrate`. Flag any `drizzle-kit push` or Supabase-migration usage. Every new `.sql` migration must have a matching `_snapshot.json`.
- **Action auth through the pipeline (CORE-ARCH-013).** Flag a new Server Action that hand-rolls `getUser()`, validation, and permission checks instead of wrapping its handler in `createProtectedAction` (or `createPublicAction` for signed-out callers). Signed-out auth flows and redirect-only OAuth actions are exempt.
- **One write path per mutation (CORE-ARCH-014).** Flag a Server Action, MCP tool, or cron route that performs a mutation an existing `src/services` function already performs, instead of calling it.
- **Reuse known helpers (CORE-ARCH-010).** Flag code that re-implements one of these:
  - `createProtectedAction` (`~/lib/actions`): Server Action auth, validation, permission, redirect, and error handling.
  - `getUserAccessLevel` (`~/lib/permissions/access`): a user's access level from their profile role.
  - The mutations in `src/services` (`issues.ts`, `machines.ts`, `machine-settings.ts`).
- **New helpers ship with a pointer.** Flag a PR that adds a shared helper (an export meant for other call sites) without naming it in its owning skill under `.agents/skills/`. A helper no skill names stays invisible to the next agent, which writes its own copy.

## Single-tenant & environment

- Flag any newly introduced org scoping, multi-tenant context wrapper, RLS policy, pgTAP test, or tRPC router — the app has none and should stay that way.
- **`localhost`, never `127.0.0.1` (CORE-SEC-008).** Flag `127.0.0.1` in `supabase/config.toml`, `.env*`, Playwright config, or scripts — browser cookie isolation breaks Supabase SSR auth across the two hosts.

## Spec conformance

Some features have a living requirements spec in `docs/feature-specs/` (see the `spec-driven-development` skill). When a PR touches behavior covered by one:

- **Review the code against the spec.** Cite requirement numbers (`spec §4.6`) the way you cite `CORE-*` IDs. A behavior change the spec doesn't sanction needs either a same-PR spec update or a new row in the spec's Known-divergences table — flag it if it has neither.
- **If the PR edits the spec itself**, additionally review the divergence table both ways: are existing rows now stale given the spec change, and does the code diverge anywhere the table doesn't yet record?

Divergence rows are a one-line todo list, not writeups.

## Help-page accuracy

If a PR changes roles, statuses, permissions, or user-facing terminology, check `src/app/(app)/help/` for content that becomes stale. Role names must match `src/lib/permissions/matrix.ts` (Guest, Member, Technician, Admin). Status labels must use the display labels in `STATUS_CONFIG` (`src/lib/issues/status.ts`), not raw database values.

## Scope of the review

A default `/code-review` pass is aimed at smaller changes — Tim triggers deeper reviews (`/code-review ultra`) manually on bigger ones. In practice: prioritise the highest-priority rule violations above and genuine correctness defects. Don't editorialise about style a formatter or linter already owns (Prettier, oxlint). A clean review — no comments — is a valid outcome; don't manufacture nits to justify the pass.

## Reviewer-relevant skill pointers

Reviewers read agent skills. Consult the relevant one for the area a PR touches — this is a routing table, not a summary; read the skill itself for the actual guidance. All live at `.agents/skills/<name>/SKILL.md`.

- `pinpoint-security` — CSP authoring, redirects and site-URL construction, the `@supabase/ssr` allowlist, sanitizers, and what counts as a non-gating role comparison. The rules themselves are `CORE-SEC-*` / `CORE-SSR-*`.
- `pinpoint-testing` — whether a PR picked the right test layer (unit/integration/E2E) for what it's testing.
- `pinpoint-e2e` — Playwright/E2E stability: worker isolation, flake-prone patterns.
- `pinpoint-typescript` — the db→app typing decision: no converter layer, narrow with `Pick<>` at boundaries. CORE-TS-007's unsafe-`as` third is not linted, so a cast between two known types stays a review question.
- `pinpoint-ui` and `pinpoint-design-bible` — UI, component, and responsive-design changes. `pinpoint-ui` also owns Server Actions, data fetching, and the form conventions (Radix Select form-reset carve-out, CREATE form reset).
- `pinpoint-deployment` — Drizzle migrations, DB connection/pooler config, preview deployments.

## How review runs

**The reviewer is `Claude Review`**, a required CI check (`.github/workflows/claude-review.yaml`) that reads this rubric from `main`. It reviews the whole PR when it is marked ready, then each later push's new commits, and posts findings as inline comments. A comment starting with `/claude-review` re-runs it on the current head. A local `/code-review` by the owning agent is optional, useful before marking a large change ready. **If you're reviewing, assume the commit you were handed is the one the author intends to be final.** Full author-side rules: `.agents/skills/pinpoint-pr-workflow/SKILL.md` Phase 3.4.

## Review mechanics

Sign every review comment or reply with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). If you decline to act on a comment (Tim's or another agent's), don't leave it silent: reply with one sentence explaining why, then resolve the thread. Every comment gets a fix or a reply — never a silent ignore. The ruleset requires every conversation resolved before merge.

## The PinPoint merge boundary

Reviewers never merge a PinPoint PR merely by reviewing it. Tim decides whether to merge. GitHub's ruleset `6326455` enforces the gates natively: required checks `CI Gate`, `Claude Review`, and `UI Approval`, every conversation resolved, and the branch up to date with `main`.

When Tim explicitly asks to merge an unambiguous PR, the owning agent runs `gh pr merge <PR> --squash` (or `--auto --squash`) and verifies the result; if the target is ambiguous, clarify it first. A refused merge means a gate is unmet: fix the gate. `--admin` is Tim's own emergency bypass and is denied to agents, as are the raw API and MCP merge channels.

Without an explicit merge request, report the PR as ready: its URL and `gh pr checks <PR> --required`.

## Pointers, not copies

- `docs/NON_NEGOTIABLES.md` is the full `CORE-*` catalog — severity, rationale, do/don't for every rule cited above. It stays there; this brief only cites IDs.
