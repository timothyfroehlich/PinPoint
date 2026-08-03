# PinPoint — Code Review Brief

This is the canonical review rubric for PinPoint. It is harness-neutral: Claude Code reads it via a pointer in `CLAUDE.md` (and via the `/code-review` skill), and the Antigravity adapter (`.agents/rules/antigravity.md`) pulls it in via `@REVIEW.md`. Any reviewer added later reads the same brief — edit only here.

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

## Scope of the review

A default `/code-review` or Antigravity pass is aimed at smaller changes — Tim triggers deeper reviews (`/code-review ultra`) manually on bigger ones. In practice: prioritise the highest-priority rule violations above and genuine correctness defects. Don't editorialise about style a formatter or linter already owns (Prettier, ESLint, oxlint). A clean review — no comments — is a valid outcome; don't manufacture nits to justify the pass.

## Reviewer-relevant skill pointers

Reviewers read agent skills. Consult the relevant one for the area a PR touches — this is a routing table, not a summary; read the skill itself for the actual guidance. All live at `.agents/skills/<name>/SKILL.md`.

- `pinpoint-security` — auth, CSP, Zod validation, Supabase SSR changes.
- `pinpoint-testing` — whether a PR picked the right test layer (unit/integration/E2E) for what it's testing.
- `pinpoint-e2e` — Playwright/E2E stability: worker isolation, flake-prone patterns.
- `pinpoint-typescript` — ts-strictest patterns, generics, Drizzle query typing.
- `pinpoint-ui` and `pinpoint-design-bible` — UI, component, and responsive-design changes. `pinpoint-ui` also owns Server Actions, data fetching, and the form conventions (Radix Select form-reset carve-out, CREATE form reset).
- `pinpoint-deployment` — Drizzle migrations, DB connection/pooler config, preview deployments.

## How a review gets triggered

**Every review on this repo is asked for. No bot reviews it, and nothing fires a review automatically.** GitHub Copilot code review was retired on 2026-08-02 (PP-4ric) — its free tier was too small to review PinPoint's PRs, so quota outages were the normal state. The reviewer is now Tim, running `/code-review` on a branch; Antigravity likewise reviews when he asks.

That did **not** loosen the merge bar. A PR still cannot merge without a review covering its **head commit**, recorded as the author's SHA-pinned marker (`<!-- pinpoint-claude-review: <head_sha> -->`), with every thread resolved. An agent cannot launch `/code-review`, so the author's job is to finish the work, hand the branch over, address the findings, and attest the head that was read:

```bash
bash scripts/workflow/mark-claude-review.sh <PR> <depth> "<one-line findings>"
```

The marker pins a SHA, so a later push invalidates it — deliberately, so a 3-commit fixup can't inherit the review of the commit before it. **If you're reviewing, assume the commit you were handed is the one the author intends to be final.** Full author-side rules: `.agents/skills/pinpoint-pr-workflow/SKILL.md` Phase 3.4.

## Review mechanics

Sign every review comment or reply with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). If you decline to act on a comment (Tim's or another agent's), don't leave it silent: reply with one sentence explaining why, then resolve the thread. Every comment gets a fix or a reply — never a silent ignore.

## The merge boundary

Reviewers never merge. Merging is human-only, via every path (PP-wi85) — no `gh pr merge`, no MCP `merge_pull_request`, no `scripts/workflow/merge-pr.sh`, not even to "just check the gates."

This is enforced two different ways depending on harness. In **Claude Code**, `block-direct-merge.cjs` is a PreToolUse hook that blocks these commands outright. It does **not** fire inside Antigravity, Codex, or Gemini — in those harnesses there is no hook backstop. What binds you instead is this written instruction plus `merge-pr.sh`'s own refusal to execute without a `--human` flag that only Tim should ever pass.

Take note if you're not Claude Code: `.agents/skills/pinpoint-pr-workflow/SKILL.md`, under "Phase 4: Merge — human-only," says direct merge paths are "ALL blocked for an agent by the `block-direct-merge.cjs` PreToolUse hook" with "no agent-usable bypass." That statement is true in Claude Code and **false in every other harness** — the hook simply isn't there. Don't take it at face value if you're reviewing or acting from Antigravity, Codex, or Gemini; the instruction in this section is what actually binds you.

An agent's terminal state on a PR is: ready-for-review, CI green, a review covering the head commit (see "How a review gets triggered"), review threads resolved, screenshots posted if UI-touching. Then hand Tim the exact command to run himself: `! scripts/workflow/merge-pr.sh <PR> --human`.

## Pointers, not copies

- `docs/NON_NEGOTIABLES.md` is the full `CORE-*` catalog — severity, rationale, do/don't for every rule cited above. It stays there; this brief only cites IDs.
