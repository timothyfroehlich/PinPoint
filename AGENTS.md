# PinPoint Agent Context

## 1. User & Mission

**User**: Tim (timothyfroehlich). **Project**: PinPoint, a pinball issue tracker for Austin Pinball Collective. **Phase**: Beta with active users; MVP+ polish.
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

### 2.2 Workflow

1. **Escape parentheses in paths**: `src/app/\(app\)/page.tsx`.
2. **Run `pnpm run preflight` before committing.** Trivial doc/comment changes: `pnpm run check` is enough.
3. **Don't kill processes you didn't start** — see §4 Process safety.
4. **Sync with merge, never rebase** — see §5 Branches.
5. **Root checkout is read-only.** It stays on `main`. All work — including planning docs — happens in a worktree. Dispatch a subagent or switch into an existing worktree. Tool-specific dispatch mechanics live in `CLAUDE.md` and `.agents/rules/AGY.md`. (PP-46z, PP-bg45.)
6. **Never `--no-verify`**, never `gh pr merge`, never wildcard tool permissions — without explicit user approval each time.

## 3. Agent Skills

Load relevant skills for every task. If your tool doesn't support skills, read the file directly. All skills live at `.agents/skills/<name>/SKILL.md`.

| Category   | Skill                            | When to use                                         |
| :--------- | :------------------------------- | :-------------------------------------------------- |
| UI         | `pinpoint-ui`                    | Components, shadcn/ui, forms, responsive design     |
| UI         | `pinpoint-design-bible`          | Design system, page archetypes, spacing, surfaces   |
| TypeScript | `pinpoint-typescript`            | Type errors, generics, Drizzle types                |
| Testing    | `pinpoint-testing`               | Writing tests, PGlite, test-layer decisions         |
| Testing    | `pinpoint-e2e`                   | E2E tests, worker isolation, Playwright stability   |
| Security   | `pinpoint-security`              | Auth, CSP, Zod, Supabase SSR                        |
| Patterns   | `pinpoint-patterns`              | Server Actions, data fetching, architecture         |
| Workflow   | `pinpoint-briefing`              | Session-start health review                         |
| Workflow   | `pinpoint-pr-workflow`           | Full PR lifecycle: commit, push, CI, Copilot, merge |
| Workflow   | `pinpoint-orchestrator`          | Parallel subagent work in worktrees                 |
| Workflow   | `pinpoint-dispatch-e2e-teammate` | Dispatching a teammate end-to-end                   |

## 4. Environment

### Worktrees & ports

Each git worktree gets isolated Supabase ports automatically. The Husky `post-checkout` hook runs `scripts/worktree_setup.py`, which allocates a slot from `~/.config/pinpoint/worktree-slots.json` and generates read-only `supabase/config.toml`, `.env.local`, `.claude/launch.json`.

- **Create**: `git worktree add /path -b branch origin/main` — the hook handles the rest.
- **Cleanup**: `scripts/worktree_cleanup.py` (stops Supabase, removes volumes, deallocates slot). Plain `git worktree remove` may leak Docker volumes (`docker volume prune` to clean).
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

| Command                               | What                                                                           |
| :------------------------------------ | :----------------------------------------------------------------------------- |
| `pnpm run check`                      | Fast: types, lint, format, unit, yamllint, actionlint, ruff, shellcheck (~12s) |
| `pnpm run preflight`                  | Full: check + build + integration. **Before commit.**                          |
| `pnpm run smoke`                      | Smoke E2E (~60s)                                                               |
| `pnpm run e2e:full`                   | Full E2E suite                                                                 |
| `pnpm run e2e:all`                    | Full + smoke + roots in separate Playwright invocations (~10–15 min)           |
| `pnpm run db:migrate`                 | Apply schema changes locally                                                   |
| `pnpm run db:backup`                  | Manual prod dump → `~/.pinpoint/db-backups`                                    |
| `pnpm run db:seed:from-prod`          | Reset local + seed from latest prod backup                                     |
| `ruff check && ruff format`           | Python lint/format (no venv needed)                                            |
| `./scripts/workflow/pr-watch.py <PR>` | Watch CI for a PR (Monitor-compatible). Never hand-roll a polling loop.        |

### Which tests to run

1. Docs, hooks, config, or other non-source changes → `pnpm run check` is enough (~12s)
2. Pure logic / utils → `pnpm run check` (~12s)
3. Single E2E spec → `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium` (~15–30s)
4. UI components / forms → `pnpm run smoke`
5. Auth / permissions / middleware → `pnpm run smoke` + targeted specs
6. DB schema / migrations → `pnpm run preflight`
7. Final pre-review sweep → `pnpm run e2e:all`

**Never** invoke `pnpm exec playwright test` with no spec path — it runs every spec in one Playwright process and cross-contaminates seed state. **Never** run `e2e:full` during iteration (that's what CI is for). Always use `--project=chromium` for targeted runs; `--headed` to debug visually. Report flaky tests; don't retry in a loop.

### Reproducing CI failures locally

Always try local first — seconds vs minutes, full devtools. If a single-test run fails with missing fixtures, run the whole file (E2E specs share state across describe blocks via `beforeAll`).

### Branches

- **Create inside a worktree**: `git checkout -b feature/name && git push -u origin feature/name`. Verify with `git branch -vv` shows `[origin/feature/name]`, not `[origin/main]`. Never push to `main`.
- **Sync with merge, never rebase**: `git fetch origin && git merge origin/main`. Rebase rewrites SHAs → force-push → teammate guardrails block → ~30 min lost negotiating push permission. Always merge. (Casework: PP audit-cleanup wave 2026-05-15.)

### CI

- **Check for conflicts first**: `gh pr view <PR> --json mergeable,mergeStateStatus`. `DIRTY`/`CONFLICTING` means GitHub silently skips workflow runs until you resolve. `pnpm run check` includes a `check:behind-main` warning.
- **Required check**: only `CI Gate` (ruleset `6326455`). Vercel is not required. `BLOCKED` while E2E is still running is normal.
- **Vercel preview migrations**: preview deployments skip `migrate:production` (branch DB user lacks `CREATE SCHEMA`). The `Supabase Branch Setup` GHA workflow handles migrations on labeled previews. Production deploys still migrate.

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

### Copilot reviews

Full protocol: `pinpoint-pr-workflow` skill (Phase 3). Summary:

1. Read unresolved comments via `mcp__github__pull_request_read(method: "get_review_comments", …)`. Filter `author.login` = `copilot-pull-request-reviewer[bot]`.
2. Fix the code, OR decline with a one-sentence reply (`add_reply_to_pull_request_comment`) and resolve the thread (`pull_request_review_write(method: "resolve_thread")`).
3. Applied suggestions auto-resolve when Copilot detects the fix commit.
4. Sign replies with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). Declined comments must get a reply — no silent ignores.

### Parallel subagent work

Use worktree-isolated subagents for independent tasks. Tool-specific dispatch, hooks, and known bugs live in your tool's instructions file. Full multi-tool workflow: `pinpoint-orchestrator` skill.

### Safe command patterns

- Search: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- Discovery: `fd "*.js"`, `fd --type f --changed-within 1day`

## 6. Deployment

### Supabase

- **`pinpoint-prod`** (Live, Pro plan): **real user data — strict safety.** Daily backups, 7-day retention.
- **Local**: `db:reset` OK. **Prod: NEVER `db:reset`. Only `db:migrate`.**
- **Connection**: use `POSTGRES_URL` (port `:6543`, session pooler, IPv4). `POSTGRES_URL_NON_POOLING` (`:5432`) is IPv6 and often unreachable.
  Format: `postgresql://postgres.[ref]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres`

### Vercel

- Vercel runs `pnpm run migrate:production` on build (production only).
- Stuck migration fix: `POSTGRES_URL=<prod_url> tsx scripts/mark-migration-applied.ts <n>`.

### Preview deployments (Supabase branching)

- Default: PRs do **not** get a usable branch DB (saves ~$0.32/day/branch).
- Enable: add the `preview` label. Within ~5 min, `Supabase Branch Setup` GHA runs Drizzle migrations + seed.
- Cleanup: `Supabase Branch Cleanup` cron runs every 6h.
- Env var fallbacks in `server.ts`/`middleware.ts` cover both PinPoint and integration naming.

## 7. Documentation

Actionable, "what" and "how" only. Skills carry the deep dives.

**Canonical specs are authoritative** — particularly `pinpoint-design-bible` (§5 page archetypes, §17 modal archetypes). When implementation changes UI behavior covered there, **edit the spec in place**. Don't append divergence notes or "TODO: spec out of date" disclaimers. If you find one, fold it into canonical text and delete it. Dated artifacts in `docs/superpowers/specs/` are records — leave them alone.

## 8. Landing the plane

Work is not complete until `git push` succeeds.

1. File issues for follow-ups.
2. Update issue status.
3. `git pull --rebase && git push`. `git status` must show "up to date with origin".
4. Hand off context for the next session.

Never say "ready to push when you are" — you push.
