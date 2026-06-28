# PinPoint Agent Context

## 1. User & Mission

**User**: Tim (timothyfroehlich). **Project**: PinPoint, a pinball issue tracker for Austin Pinball Collective. **Phase**: In active production use by 20+ members; MVP+ polish and hardening.
**Style**: Explain pros/cons, teach. PR reviews are AI-generated — apply critical thinking.

## 2. Critical Non-Negotiables

### 2.1 Implementation

> These are one-line summaries indexed to `docs/NON_NEGOTIABLES.md`. Each rule cites its canonical `CORE-*` ID(s) — read the catalog for full severity, rationale, and do/don't. **Keep this list in sync** with `docs/NON_NEGOTIABLES.md` whenever a rule is added, removed, or rewritten.

1. **Drizzle migrations only** (CORE-ARCH-009): `db:generate` + `db:migrate`. Never `drizzle-kit push`. Supabase migration config is disabled.
2. **Worker-scoped PGlite** (CORE-TEST-001): no per-test DB instances (causes lockups).
3. **Server Components default** (CORE-ARCH-001): `"use client"` only for interaction leaves.
4. **Progressive enhancement** (CORE-ARCH-002): `<form action={serverAction}>`. No inline handlers.
5. **Supabase SSR** (CORE-SSR-001, CORE-SSR-002): `createClient()` → `auth.getUser()` immediately. No logic between.
6. **Type safety** (CORE-TS-007): ts-strictest. No `any`, no `!`, no unsafe `as`.
7. **Path aliases** (CORE-TS-008): always `~/` (e.g. `~/lib/utils`).
8. **Rule of Three** (CORE-ARCH-010): DRY up after the third duplication, not before.
9. **Test at the cheapest layer** (CORE-TEST-005): E2E for multi-step journeys; integration (PGlite + direct action) for server-action wiring, permissions, query correctness; RTL unit for form-state and UI logic. Smoke E2E is for "renders without 500" only. Bug-class table: `pinpoint-testing` skill.
10. **Email privacy** (CORE-SEC-007): user emails only in admin views and the user's own settings page. Everywhere else: names, "Anonymous", or roles.
11. **Permissions go through the matrix** (CORE-ARCH-008): all checks via `checkPermission()` from `~/lib/permissions/helpers`. The help page auto-generates from the matrix — keep enforcement and matrix in sync.
12. **Two-layer responsive** (CORE-RESP-001..004): viewport breakpoints (`md:`, `lg:`) for page structure; container queries (`@lg:`, `@xl:`) for component internals. No `useMediaQuery` / `window.innerWidth` — use CSS. Sole exception: `use-table-responsive-columns` (PP-rs9).
13. **Test what we own** (CORE-TEST-006): mock third-party SDKs at their boundary; don't synthesize their internal state. Any production third-party hostname reachable from an E2E run is a class-J violation — delete the spec and add an SDK-boundary mock.
14. **`localhost`, never `127.0.0.1`** (CORE-SEC-008): cookie host isolation breaks Supabase SSR auth across the two. Use `localhost` in config, `.env*`, Playwright `baseURL`, and any local URL.
15. **Baseline Widely available is the UI floor** (CORE-UI-005, CORE-UI-006): reach for `<dialog>`, container queries, `:has()`, `:user-invalid`, `inert`, `aspect-ratio`, `fetchpriority`, etc. directly — no polyfills, no feature detection. Look up modern patterns via the `modern-web-guidance` plugin (`npx -y modern-web-guidance@latest search "<query>"` then `retrieve "<id>"`); each guide tags its Baseline status. Newly-available features (Popover API, View Transitions, anchor positioning, scroll-driven animations) require a per-feature opt-in documented in `pinpoint-design-bible` §19.
16. **Form correctness** (CORE-FORM-001..006): right `type` (`email`/`tel`/`url`/`password`), correct `autocomplete` token (`current-password` / `new-password` / `off` on confirm), `:user-invalid` styling on the shared Input, `aria-invalid` synced on blur, visible required-field indicators, `enterkeyhint` on sequential mobile fields.
17. **Accessibility floor** (CORE-A11Y-001..006): skip-to-main link, `motion-reduce:` paired with animations, `<th scope="col">` + `aria-sort` + accessible name on data tables, real `<button>` (never `<div role="button">`), `title` is not a tooltip, `inert` on background regions when a modal opens.
18. **No side effects inside DB transactions** (CORE-ARCH-011): external/non-transactional effects (HTTP, email, Discord, blob, Vault RPC) never run inside `db.transaction` — fetch inputs before it, deliver effects after commit (`after()` + `planNotification`/`dispatchNotification`). A runtime tripwire throws `SideEffectInTransactionError` if violated. (The Doodle Bug, PP-2053.)
19. **Respect PinballMap API conduct** (CORE-PBM-001): all PBM access goes through the `~/lib/pinballmap` client seam using the documented JSON API — one sync call/hour, store+reuse tokens (Vault), descriptive User-Agent, 429 backoff, attribution + link-back when rendering PBM data. Never crawl pinballmap.com or reach it from tests. Re-read `docs/external/pinballmap-*` before changing integration code.
20. **Env vars: central registry + no secret coupling** (CORE-SEC-009): every production-required env var is declared in the `next.config.ts` build registry (`assertVercelDeploymentEnv`) so a missing value fails the Vercel build, not silently degrades. No secret reused as another's fallback; no secret prefixed `NEXT_PUBLIC_`. Catalog + scope matrix: `docs/ENV_VARS.md`.

### 2.2 Process rules

1. **Escape parentheses in paths**: `src/app/\(app\)/page.tsx`.
2. **Run `pnpm run check` before committing** (~12s — the default floor). Reserve `pnpm run preflight` (the slower check + build + integration) for **non-trivial changes**: migrations, security/auth, server actions, middleware, DB schema. Preflight is the exception, not the per-commit rule.
3. **Don't kill processes you didn't start** — see §4 Process safety.
4. **Sync with merge, never rebase** — see §5 Branches.
5. **Root checkout is read-only.** It stays on `main`. All work — including planning docs — happens in a worktree. Dispatch a subagent or switch into an existing worktree. Tool-specific dispatch mechanics live in `CLAUDE.md` and `.agents/rules/AGY.md`. (PP-46z, PP-bg45.)
6. **Never `--no-verify`**, never `gh pr merge`, never wildcard tool permissions — without explicit user approval each time.

## 3. Agent Skills

Load relevant skills for every task. If your tool doesn't support skills, read the file directly. All skills live at `.agents/skills/<name>/SKILL.md`.

| Category    | Skill                     | When to use                                                             |
| :---------- | :------------------------ | :---------------------------------------------------------------------- |
| UI          | `pinpoint-ui`             | Components, shadcn/ui, forms, responsive design                         |
| UI          | `pinpoint-design-bible`   | Design system, page archetypes, spacing, surfaces                       |
| TypeScript  | `pinpoint-typescript`     | Type errors, generics, Drizzle types                                    |
| Testing     | `pinpoint-testing`        | Writing tests, PGlite, test-layer decisions                             |
| Testing     | `pinpoint-e2e`            | E2E tests, worker isolation, Playwright stability                       |
| Security    | `pinpoint-security`       | Auth, CSP, Zod, Supabase SSR                                            |
| Patterns    | `pinpoint-patterns`       | Server Actions, data fetching, architecture                             |
| Workflow    | `pinpoint-prototype-mode` | Opt-in rapid UI/UX prototyping: relax rigor on presentation, track debt |
| Workflow    | `pinpoint-briefing`       | Session-start health review                                             |
| Workflow    | `pinpoint-pr-workflow`    | Full PR lifecycle: commit, push, CI, merge                              |
| Workflow    | `pinpoint-orchestrator`   | Parallel subagent work in worktrees: dispatch, monitor, follow-up       |
| Workflow    | `pinpoint-huddle`         | Inter-session coordination via daily/monthly beads (the huddle hooks)   |
| Antigravity | `pinpoint-agy-triage`     | Grooming: evaluate whether a bead is agy-ready/agy-ui                   |
| Antigravity | `pinpoint-agy-dispatch`   | Emit an Antigravity copy-paste prompt for a chosen bead                 |
| Antigravity | `pinpoint-agy-execute`    | Runbook for Antigravity to execute an agy-ready bead end-to-end         |

## 4. Environment

### Host prerequisites

One-time install for tools the workflow scripts depend on:

- **GNU parallel** (provides `sem`, used by `pnpm run preflight` to cap host-wide concurrency at 2):
  - macOS: `brew install parallel`
  - Linux: `apt install parallel`
  - Without it, `pnpm run preflight` fails with a clear install hint; use `pnpm run preflight:unlocked` to bypass the cap.
- **pytest** (used by `pnpm run check:pytest` to run hook tests):
  - macOS: `brew install pytest`
  - Linux: `pipx install pytest` (requires pipx: `apt install pipx`)

### Worktrees & ports

Each git worktree gets isolated Supabase ports automatically. The Husky `post-checkout` hook runs `scripts/worktree_setup.py`, which allocates a slot from `~/.config/pinpoint/worktree-slots.json` and generates read-only `supabase/config.toml`, `.env.local`, `.claude/launch.json`.

- **Create**: `git worktree add /path -b branch origin/main` — the hook handles the rest.
- **Cleanup**: `scripts/worktree_cleanup.py` (stops Supabase, removes volumes, deallocates slot). Plain `git worktree remove` or `rm -rf` leaks slot entries and Docker volumes — `scripts/worktree_orphan_sweep.py` reconciles them; pass `--apply` to reclaim. A SessionStart hook runs the sweep in dry-run mode every 6h and prints a one-line nudge if orphans are found.
- **Ports**: main worktree uses defaults (3000 / 54321 / 54322). Slot N: `3000+N*10`, `54321+N*100`, `54322+N*100`.
- **Config**: edit `supabase/config.toml.template`, not the generated file (which is chmod 444).

### Starting the local stack (self-service)

Start what you need yourself rather than pausing the user.

- **OrbStack down?** `open -a OrbStack`, then `docker info` to confirm.
- **Supabase down?** From the current worktree: `supabase start`. Ports are isolated, so this won't affect anyone else.

Leave the stack running afterward — the user can stop it. Hand off what's running. If you can't start it (port collisions, stuck containers), ask the user — don't fall back to "let CI tell us."

### Process safety

Only stop services you started in this session, by specific PID or via worktree-local commands (e.g. `supabase stop` inside the worktree). Forbidden without explicit permission: `supabase stop --all`, `pkill`/`killall` against process names, `docker stop` on containers you didn't start. The system runs many environments in parallel; broad kills wipe out other agents' work.

## 5. Workflow

### Key commands

| Command                               | What                                                                                                                                                                                                                             |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run check`                      | Fast: types, lint, format, unit, yamllint, actionlint, ruff, shellcheck (~12s)                                                                                                                                                   |
| `pnpm run preflight`                  | Full: check + build + integration. **For non-trivial changes** (migrations, auth, server actions, middleware, DB schema) — not every commit. Host-wide cap of 2 concurrent runs (via `sem`); use `preflight:unlocked` to bypass. |
| `pnpm run smoke`                      | Smoke E2E (~60s)                                                                                                                                                                                                                 |
| `pnpm run e2e:full`                   | Full E2E suite — **CI only; don't run locally.**                                                                                                                                                                                 |
| `pnpm run e2e:all`                    | Full + smoke + roots, separate Playwright invocations (~10–15 min) — **CI only; don't run locally.**                                                                                                                             |
| `pnpm run db:migrate`                 | Apply schema changes locally                                                                                                                                                                                                     |
| `pnpm run db:backup`                  | Manual prod dump → `~/.pinpoint/db-backups`                                                                                                                                                                                      |
| `pnpm run db:seed:from-prod`          | Reset local + seed from latest prod backup                                                                                                                                                                                       |
| `ruff check && ruff format`           | Python lint/format (no venv needed)                                                                                                                                                                                              |
| `./scripts/workflow/pr-watch.py <PR>` | Watch CI for a PR (Monitor-compatible). Never hand-roll a polling loop.                                                                                                                                                          |
| `FORCE_MEM_PRECHECK=skip <command>`   | Bypass the memory-pressure gate for one run (e.g. when you know pressure is transient or acceptable).                                                                                                                            |

### Type-check engine (TS 7 migration — in progress)

The `typecheck` gate runs on the **Go-native compiler** (`tsgo`, from `@typescript/native-preview`, pinned to a nightly) — ~4–6× faster than `tsc`. **ESLint type-aware linting and `next build` still type-check on `typescript@6`** — they need the JS compiler API the native build omits until TS 7.1, so `typescript@6` stays installed; do not remove it. `pnpm run typecheck:tsc6` runs the old engine for A/B comparison. This is Phase 1 of `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` (PR #1586) — proven 0 divergences vs `tsc 6` on `tsconfig.json`. **When TS 7.0 GA lands (~July 2026), bump the pinned nightly to the GA release.** Later phases (type-check tests/e2e, type-aware lint on the Go engine, Next native build) are deferred follow-ups.

### Prototype mode (rapid iteration)

When the user explicitly asks for "prototype mode" / "rapid iteration" / "just explore" **for UI/UX work**, load the `pinpoint-prototype-mode` skill and enter it. It's scoped to **presentation only** — layout, components, styling, page structure, interaction/flow — and explicitly **not** for backend/internal work (data layer, server-action logic, auth, permissions, migrations), which keep full rigor; stub data rather than building it. Within that scope it relaxes the §2 rigor (skip preflight/tests before showing work, defer lint/type fixes, defer coverage and DRY) while logging every skipped item to a `.prototype-mode` debt ledger. It changes **agent behavior only** — pre-commit and `preflight` hooks still run on any real commit, which is fine because prototype work stays local and uncommitted. Never self-elect into it; full rigor is the default. A `UserPromptSubmit`/`SessionStart` hook reminds the agent while the marker exists, so the mode survives compaction. Exit on "exit prototype mode" / "make this real" — then repay the ledger.

### Which tests to run

1. Docs, hooks, config, or other non-source changes → `pnpm run check` is enough (~12s)
2. Pure logic / utils → `pnpm run check` (~12s)
3. Single E2E spec → `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium` (~15–30s)
4. UI components / forms → `pnpm run smoke`
5. Auth / permissions / middleware → `pnpm run smoke` + targeted specs
6. DB schema / migrations → `pnpm run preflight`
7. Final pre-review → push and let **CI** run the full suite; don't sweep locally.

**Never** invoke `pnpm exec playwright test` with no spec path — it runs every spec in one Playwright process and cross-contaminates seed state. **Never** run `e2e:full` / `e2e:all` locally — the full suite is CI's job. Always use `--project=chromium` for targeted runs; `--headed` to debug visually. Report flaky tests; don't retry in a loop.

### Reproducing CI failures locally

Always try local first — seconds vs minutes, full devtools. If a single-test run fails with missing fixtures, run the whole file (E2E specs share state across describe blocks via `beforeAll`).

### Branches

- **Create inside a worktree**: `git checkout -b feature/name && git push -u origin feature/name`. Verify with `git branch -vv` shows `[origin/feature/name]`, not `[origin/main]`. Never push to `main`.
- **Sync with merge, never rebase**: `git fetch origin && git merge origin/main`. Rebase rewrites SHAs → force-push → teammate guardrails block → ~30 min lost negotiating push permission. Always merge. (Casework: PP audit-cleanup wave 2026-05-15.)

### CI

- **Check for conflicts first**: `gh pr view <PR> --json mergeable,mergeStateStatus`. `DIRTY`/`CONFLICTING` means GitHub silently skips workflow runs until you resolve. `pnpm run check` includes a `check:behind-main` warning.
- **Required check**: only `CI Gate` (ruleset `6326455`). Vercel is not required. `BLOCKED` while E2E is still running is normal.
- **Vercel preview migrations**: preview deployments skip `migrate:production` (branch DB user lacks `CREATE SCHEMA`). The on-demand `Preview Controller` workflow migrates + seeds the branch DB before building the preview (see §7 "Preview deployments"). Production deploys still migrate.

### Migration conflicts

Never resolve `drizzle/meta` conflicts manually — the folder holds binary-like schema snapshots; manual edits corrupt the prevId chain.

**Protocol when meta conflicts on merge:**

1. Take upstream's `drizzle/meta` (theirs).
2. Delete your migration files (`.sql` + `_snapshot.json`).
3. Resolve `schema.ts` manually.
4. `pnpm db:generate` — Drizzle regenerates a fresh migration.
5. Compare the new SQL to what you deleted; confirm intent preserved.
6. `pnpm db:reset` to verify.

Before merging any migration PR: every new `.sql` has a matching `_snapshot.json`; `pnpm db:generate` reports "No schema changes".

### Review comments

If a PR accumulates review comments (from Tim or another agent): fix the code, OR decline with a one-sentence reply (`add_reply_to_pull_request_comment`) and resolve the thread (`pull_request_review_write(method: "resolve_thread")`). Sign replies with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). Declined comments must get a reply — no silent ignores.

### Parallel subagent work

Use worktree-isolated subagents for independent tasks. Tool-specific dispatch, hooks, and known bugs live in your tool's instructions file. Full multi-tool workflow: `pinpoint-orchestrator` skill.

### Surfacing visual or ambiguous decisions (playgrounds)

When a decision is **visual or hard to convey in prose** — color/contrast, spacing, layout, component variants, or a tradeoff with several plausible answers — build a small interactive playground for the user instead of describing options in text or guessing on their behalf. A playground is a single self-contained HTML file with live controls, a real rendered preview, and a copy-out decision; the user adjusts it, sees the actual result, and hands the choice back. (Claude Code provides this via a `playground` plugin skill — it is **not** a checked-in `.agents/skills/` skill, so in any tool you can simply write the single-file HTML directly.) Prefer this over a wall of bullet-pointed options whenever the user would benefit from _seeing_ the thing — e.g. a contrast change is far easier to judge as rendered swatches with live WCAG ratios than as numbers. Keep using `AskUserQuestion`-style prompts for non-visual forks; reach for a playground when sight is the deciding factor.

## 6. Working style

How Tim wants agents to behave. (§1 has the one-line version; this is the detail.)

### Collaboration & decisions

- **Don't make my calls for me.** (a) When you ask me a multi-option question, wait for my answer before acting on one — even in auto/autonomous mode; deciding before I reply makes the question performative and removes my choice. (b) Auto/autonomous mode authorizes _operational_ calls (continuing work, tool choices, cleanup, re-publishing after a restart), **not** taste decisions — layout, color, copy, IA, or scope tradeoffs I surfaced. When I'm the taste-maker, ask (`AskUserQuestion` or a visual playground). While waiting on an answer, only do genuinely non-blocking parallel work.
- **PRs ready-by-default.** Open PRs as ready-for-review, not draft. CI runs the same on drafts, so draft gates nothing — it just adds a "flip ready" step and signals WIP. Use draft only while still iterating, when you want title/description feedback first, or when you've told me you're pausing mid-task.
- **Link markdown files by absolute path.** When you point me at a markdown file to read or review (a plan, spec, handoff doc, report), always give the full absolute path (e.g. `/Users/froeht/Code/PinPoint/docs/...`), never a relative one. Absolute paths open directly in a cmux pane.

### Scope and shipping discipline

- **Polish before shipping — no "fast follow."** Get a change genuinely good before it merges; don't ship something rough on the promise of a later cleanup PR. There is no fast-follow culture here.
- **Slice large work into smaller _complete_ features.** When something is too big to polish in one pass, split it into smaller features that each ship finished — not one big half-done change followed by patch-up PRs. Smaller-but-complete beats larger-but-rough.
- **One bead = one PR.** A bead is a unit of shippable work that maps to a single PR. File a bead only for genuinely separate work that will become its own PR — a real follow-up, a discovered out-of-scope problem, or future work. Conversely, don't create slivers: if a task is too small to justify its own session/PR overhead, fold it into a related bead or add it to an existing unstarted bead where it fits.

## 7. Deployment

### Supabase

- **`pinpoint-prod`** (Live, Pro plan): **real user data — strict safety.** Daily backups, 7-day retention.
- **Local**: `db:reset` OK. **Prod: NEVER `db:reset`. Only `db:migrate`.**
- **Connection**: app + scripts use `POSTGRES_URL` — the Supavisor **transaction** pooler (`…pooler.supabase.com:6543`, IPv4). In prod the Supabase↔Vercel integration injects `POSTGRES_URL_NON_POOLING` as the IPv4 **session** pooler (`…pooler.supabase.com:5432`) — the prepared-statement-capable, IPv4-reachable endpoint that `scripts/migrate-production.ts` uses for DDL on the IPv4-only Vercel build runner (verified 2026-06-18 via prod build logs + DNS, PP-xhqt). The **direct** connection (`db.<ref>.supabase.co:5432`) is **not** what NON_POOLING points to here: it is IPv6-only (prod's IPv4 add-on is **off**, confirmed — the host has no A record), so it is unreachable from CI/preview/Vercel; the session pooler is used instead.
  Format: `postgresql://postgres.[ref]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres`

  **Canonical endpoint reference** (Supabase docs, verified 2026-06-18):

  | Endpoint                    | Mode                       | IP                      | Prepared statements           | Use for                                      |
  | --------------------------- | -------------------------- | ----------------------- | ----------------------------- | -------------------------------------------- |
  | `…pooler.supabase.com:6543` | Supavisor **transaction**  | IPv4 (always)           | **disable** (`prepare:false`) | reads, serverless, one-shot scripts          |
  | `…pooler.supabase.com:5432` | Supavisor **session**      | IPv4 (always)           | supported                     | migrations / DDL / write transactions (IPv4) |
  | `db.<ref>.supabase.co:5432` | **direct**                 | IPv6 (IPv4 with add-on) | supported                     | migrations from IPv6-capable hosts           |
  | `db.<ref>.supabase.co:6543` | Dedicated PgBouncer (paid) | IPv6 (IPv4 with add-on) | no                            | high-perf app traffic                        |
  - The shared Supavisor pooler is **already IPv4** on both ports, free, every tier — there is nothing to "enable". The paid **IPv4 add-on** is a separate thing that makes the _direct_ connection IPv4; PinPoint does not need it (the session pooler already gives an IPv4, prepared-statement-capable endpoint).
  - **Transaction pooler (`:6543`) does not support prepared statements** — set `prepare:false` on **every** porsager client that connects there: one-shot scripts (`scripts/lib/pg-client.mjs`) **and the app runtime** (`src/server/db/index.ts`). This is the canonical Drizzle + postgres-js + Supabase serverless setting. `scripts/migrate-production.ts` also sets `prepare:false` as defense-in-depth: it normally runs over the `:5432` session pooler (prepared-statement-capable), but the option keeps it correct if it ever falls back to `:6543`, and it additionally **requires** `POSTGRES_URL_NON_POOLING` in production rather than silently falling back (PP-xhqt).
  - ✅ **Write/transaction hazard (resolved, PP-d8l8):** multi-statement write transactions over the `:6543` transaction pooler with prepared statements caused **silent commit loss** in prod (the driver saw COMMIT succeed; nothing persisted — incident 2026-06-18). Root cause: the runtime client (`src/server/db/index.ts`) used postgres-js's default `prepare:true`. **Fixed by setting `prepare:false` on the runtime client** — one client-level option that covers all write transactions and standalone writes; no read/write split or session-pooler routing needed (the `:5432` session pooler is wrong for Vercel serverless — session mode exhausts connections under Fluid Compute). The app-layer read-back guard in `src/services/issues.ts` (PP-qk7s) remains as a tripwire until prod confirms the fix, then is removed in a follow-up. Do **not** reintroduce `prepare:true` on a `:6543` client.

### Vercel

- Vercel runs `pnpm run migrate:production` on build (production only).
- Stuck migration fix: `POSTGRES_URL=<prod_url> tsx scripts/mark-migration-applied.ts <n>`.

### Preview deployments (on-demand, TTL'd Supabase branches)

Native Supabase auto-branching is **disabled** — no PR gets a preview by default (zero branches, zero cost). Previews are created on demand via PR comment commands and torn down on a TTL.

- **Control surface = PR comments** (from authors with write access only):
  - `/preview` — create (or restart after expiry) a branch, migrate + seed it, wire creds into the Vercel preview, and post a sticky status comment with the live URL + 48h expiry.
  - `/preview extend` — push expiry +48h (no DB work). `/preview stop` — tear down now.
- **State**: one sticky bot comment per PR (keyed `<!-- pinpoint-preview-status -->`) holds the `Expires:` timestamp — the TTL source of truth.
- **Reaper**: `Preview Reaper` runs hourly; deletes branches past expiry or on closed/merged PRs, and flips the sticky comment to "expired — comment `/preview` to restart."
- **Implementation** (workflows, the Vercel git-integration wiring, and required secrets): `.github/workflows/preview-control.yaml`, `preview-reaper.yaml`, `scripts/workflow/preview/*.sh`.

### Audit-gate override (per-PR `/audit-override`)

When `pnpm audit --audit-level=high` goes RED on a freshly-published advisory **unrelated** to a PR's changes (a transitive dev-dep CVE, or a fix that's major-bump-only), the audit job cascades into CI Gate and blocks the PR. The proper fix is still a dependency-bump PR — but `/audit-override` is the escape hatch so an unrelated repo-wide advisory doesn't force an admin-merge.

- **Control surface = PR comments** (from authors with write access only):
  - `/audit-override <reason>` — bypass the `pnpm audit` gate for the PR's **current head commit**. Records a `pinpoint-audit-override` commit status + a sticky bot comment (who/when/why) and re-runs the failed CI so the gate re-evaluates immediately.
  - `/audit-override clear` — re-arm the gate.
- **Commit-bound, not PR-bound**: the override is a commit status on the head SHA. **Pushing a new commit drops it** — the gate re-fires and the override must be re-issued, so a newly-introduced real vulnerability is never silently masked. It only bypasses the audit gate; any other failing check stays red.
- **Scope**: single PR only; never changes repo-wide audit policy or any other PR. No secrets required (default `GITHUB_TOKEN`).
- **Implementation**: `.github/workflows/audit-override.yaml`, `scripts/workflow/audit-override/*.sh`; the consuming check is the `Run pnpm audit` step in `ci.yml` (`gate.sh check`).

## 8. Documentation

Actionable, "what" and "how" only. Skills carry the deep dives.

**Canonical specs are authoritative** — particularly `pinpoint-design-bible` (§5 page archetypes, §17 modal archetypes). When implementation changes UI behavior covered there, **edit the spec in place**. Don't append divergence notes or "TODO: spec out of date" disclaimers. If you find one, fold it into canonical text and delete it. Dated artifacts in `docs/superpowers/specs/` are records — leave them alone.

## 9. Landing the plane

Work isn't done at "git push" — it's done when the change is **merged, deployed clean, and cleaned up**. The full pipeline (commit → PR → CI → merge) lives in the `pinpoint-pr-workflow` skill; the load-bearing rules are repeated here in case that skill isn't loaded.

1. **Before you push:** `pnpm run check` is the floor (types, lint, format, unit). Run `pnpm run preflight` for non-trivial changes — migrations, security/auth, server actions, middleware, DB schema. Don't run the full E2E suite locally; CI owns it.
2. **Push and open the PR ready-for-review** (draft only while iterating — see "Working style"). Sync with main by **merge, never rebase**; `git status` must show "up to date with origin".
3. **Lean on CI for the full E2E suite** — don't run `e2e:full` locally; CI owns it once the PR is up. Do run **selected specs locally** while writing them or iterating on a feature they touch (`pnpm exec playwright test <spec> --project=chromium`).
4. **The bead stays open until the PR merges.** Opening the PR does NOT close it — the bead stays `in_progress`, closed only after merge (`bd close <id> --reason="PR #N merged"`). Merge via `scripts/workflow/merge-pr.sh <PR>` — never `gh pr merge` or MCP merge directly.
5. **After merge, watch the deployment.** Don't walk away at merge — watch the production deploy land and confirm no build, migration, or runtime errors. A merge that breaks prod isn't done.
6. **Cleanup — non-destructive now, destructive on confirmation.** Close the bead, file genuine follow-up beads, and hand off freely. For destructive cleanup (removing worktrees, deleting branches/volumes), wait for explicit confirmation.
7. **Hand off** for the next session, and post to the huddle daily bead if other sessions need to know what landed.

Never say "ready to push when you are" — you push.
