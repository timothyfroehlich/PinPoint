# PinPoint Agent Context

## 1. User & Mission

**User**: Tim (timothyfroehlich). **Project**: PinPoint, a pinball issue tracker for Austin Pinball Collective. **Phase**: In active production use by 20+ members; MVP+ polish and hardening.
**Scale**: PinPoint is meant to support collections of 100+ machines spanning all eras — 1940s EMs through early solid state, DMD-era Bally/Williams, and modern Stern/JJP/Multimorphic. Don't design features that assume "modern games only."
**Style**: Explain pros/cons, teach. PR reviews are AI-generated — apply critical thinking.

## 2. Critical Non-Negotiables

### 2.1 Implementation

**`docs/NON_NEGOTIABLES.md` is the catalog** — every implementation rule, with its canonical `CORE-*` ID, severity, rationale, and do/don't. Read it before writing code in an area you have not touched before, and cite rules by ID.

`AGENTS.md` is the portable, always-on project policy. Skills hold task-specific procedure; the catalog remains authoritative for complete rule statements.

#### Universal implementation policy

- **Type safety (CORE-TS-007):** never use `any`, non-null `!`, or unsafe `as`; model or narrow the value instead. See `pinpoint-typescript` for PinPoint's database-typing guidance.
- **Path aliases (CORE-TS-008):** import project code with `~/`, never deep relative paths.
- **Rule of Three (CORE-ARCH-010):** do not abstract before the third real duplication.
- **Email privacy (CORE-SEC-007):** user emails only in admin views and the user's own settings page; everywhere else use names, "Anonymous", or roles.

### 2.2 Process rules

1. **Escape parentheses in paths**: `src/app/\(app\)/page.tsx`.
2. **Run `pnpm run check` before committing** (~9s — the default floor). It is a **static** gate: types, lint, format, and the shell/YAML/Python linters. **It does not run unit tests, and does not run pytest** (PP-4zcj). Reserve `pnpm run preflight` (the slower static checks + unit + DB reset + build + integration + smoke) for **non-trivial changes**: migrations, security/auth, server actions, middleware, DB schema. Preflight is the exception, not the per-commit rule.
3. **Don't kill processes you didn't start** — see §4 Process safety.
4. **Sync with merge, never rebase** — see §5 Branches.
5. **Root checkout is read-only.** It stays on `main`. All work — including planning docs — happens in a worktree. Dispatch a subagent or switch into an existing worktree. (PP-46z, PP-bg45.)
6. **Never `--no-verify`**, never wildcard tool permissions — without explicit user approval each time. **For PinPoint PRs, Tim decides whether to merge.** His direct request in the active task (for example, “merge it” when the PR is unambiguous) authorizes the owning agent in any harness to run `bash scripts/workflow/merge-pr.sh <PR> --human`; do not require him to repeat the decision in a shell. The `--human` flag records his authorization, while the script rechecks CI, exact-head review, threads, and conflicts. Stop if a gate fails. Claude Code and Codex also show a permission prompt for the script; the direct request still authorizes the agent to initiate the guarded merge. Without an explicit merge request, finish with `bash scripts/workflow/merge-handoff.sh <PR>`. Raw PinPoint merge channels remain prohibited for agents (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`); they skip the gates. In PinPoint sessions Claude Code and Codex deny these channels for every repository; merge another repository's PR from that repository. See `pinpoint-pr-workflow` Phase 4. (PP-wi85.)
7. **Beads: `team-maintainer` policy** (not the conservative default).
8. **Early UI review gate (pre-E2E) (PP-4c4b):** For non-trivial UI changes (new layouts, altered components, modified user flows), get Tim's visual sign-off on rendered screenshots _before_ authoring or updating Playwright/E2E tests and running preflight. Fast unit tests (`pnpm run test`) are fine to run early; heavy E2E suites wait until layout and visual hierarchy are approved. (For rapid presentation-only explorations without any tests or backend logic, see §5 Prototype mode).

**Codex mutations:** use `bd --actor Codex <command>` so automated writes never fall back to Tim's identity.

**Beads in a cloud/ephemeral checkout:** if `.beads/` is absent (fresh cloud sandbox), run `bash scripts/beads-cloud-init.sh && cd ~/beads` before any `bd` write — the binaries are already installed by the environment setup script; this materializes the DoltHub credential and clones the shared DB. A discovery net; scheduled routines still carry the same line as a prompt preamble. Full setup: `docs/runbooks/cloud-routines-beads-access.md`.

## 3. Agent Skills

Before working in an area covered by a skill, read that skill. If your tool doesn't support skills, read its `SKILL.md` directly. All project skills live at `.agents/skills/<name>/SKILL.md`; they own task-specific procedure while this file stays agent-neutral.

Before exploring or changing non-mechanical product behavior, read
`docs/agents/domain.md`; it routes the relevant glossary, feature spec, and
ADRs. Skip it for mechanical changes that do not affect product behavior or
domain language.

**The huddle is global, not a PinPoint subsystem.** Its implementation, skill,
and tests live in the public `timothyfroehlich/huddle` repository, installed as
a plugin in each harness and checked out at `~/Code/huddle`; the trusted
repository registry and the Mac launchd job stay in Tim's dotfiles. Shared
scripts are at `~/Code/huddle/lib/`; agent-writable state lives under
`$XDG_STATE_HOME/agents-huddle/agent/`. Plugin hooks silently self-disable
outside registered repositories. The Mac leader service owns fetch and
fast-forward work and posts merge announcements. PinPoint keeps only its Beads
actor hook, which asks the global `huddle-whoami.sh` interface for the
registered identity.

## 4. Environment

### Host prerequisites

One-time install for tools the workflow scripts depend on:

- **mise** — version `2026.8.11` or newer. `mise.toml` is the exact authority for project Node, Python, Ruff, and the Supabase CLI; `package.json#packageManager` is the single pnpm version and SHA-512 authority; `mise.lock` records resolved artifacts. Run `mise install --locked` rather than installing competing project copies. Keep project commands in `package.json#scripts`, not duplicated as mise tasks. In pnpm 11, dependency `overrides`, `peerDependencyRules`, and package settings live in `pnpm-workspace.yaml` (never in `package.json`).
- **GNU parallel** (optional) — provides `sem`, which `scripts/workflow/heavy-run.sh` uses to cap heavy commands (full unit runs, build, integration, smoke) at 2 concurrent host-wide. Without it they run uncapped.
- **pytest** — `pnpm run check:python` runs the hook/script tests with it under the mise-selected Python. Install it with `mise exec -- python3 -m pip install -r scripts/requirements.txt`; if absent from that interpreter, `check:pytest` fails with this install hint rather than using a pytest bound to another Python.

### Worktrees & ports

Each git worktree gets isolated Supabase ports automatically. The Husky `post-checkout` hook runs `scripts/worktree_setup.py`, which allocates a slot from `~/.config/pinpoint/worktree-slots.json` and generates read-only `supabase/config.toml`, `.env.local`, `.claude/launch.json`.

- **Create**: `git worktree add /path -b branch origin/main` — the hook handles the rest.
- **Cleanup**: `python3 scripts/worktree_cleanup.py <worktree-path>` is the complete teardown command: it stops the pinned Supabase project, removes its volumes, unlocks/removes/prunes the Git worktree, then releases its slot. Claude's `WorktreeRemove` hook calls the same module via `--claude-hook`; configure Codex cleanup as `python3 scripts/worktree_cleanup.py .`. Plain `git worktree remove` or `rm -rf` bypasses it and leaks resources; `scripts/worktree_orphan_sweep.py --apply` reconciles those.
- **Reaping finished worktrees**: `scripts/worktree_reap.py` identifies worktrees whose work already landed and delegates teardown to `worktree_cleanup.py`. It consumes Git's complete worktree inventory, regardless of whether Claude, Codex, Antigravity, or a human chose the path. The sweep can't reap an existing worktree because it is still "active". Reap requires positive proof: a merged PR whose `headRefOid` **is** local `HEAD` with a clean tree, or zero commits ahead of `origin/main` with no PR. Dirty tree, post-merge commits, an open PR, or unreachable `gh` means "leave it alone". Dry-run by default; `--apply` to reclaim. `merge-pr.sh` reaps the merged branch's worktree automatically. (PP-49x5.)
- **SessionStart audit**: one hook runs both the sweep and the reap in dry-run mode every 6h and prints a one-line nudge when either finds something to reclaim.
- **Ports**: main worktree uses defaults (3000 / 54321 / 54322). Slot N: `3000+N*10`, `54321+N*100`, `54322+N*100`.
- **Supabase `project_id`**: derived from the branch name the **first** time a worktree is set up, then **pinned** — later checkouts reuse the id already in `supabase/config.toml`. It names the Docker containers and labels the volumes, so letting it follow a `git checkout -b` would rename the stack out from under itself (`supabase stop` matches nothing, the old containers keep the ports bound, cleanup misses them). `config.toml` is the authoritative record of the running stack's id. (PP-4936.)
- **Config**: edit `supabase/config.toml.template`, not the generated file (which is chmod 444).

### Starting the local stack (self-service)

Start what you need yourself rather than pausing the user.

- **Backend**: `.env.local`'s `PINPOINT_SUPABASE_BACKEND` says where the stack runs — `local` (this machine's Docker) or `remote` (another host's Docker over the tailnet). Read [the remote Supabase runbook](docs/runbooks/remote-supabase.md) before starting, stopping, switching, or debugging a `remote` stack.
- **OrbStack down?** (local backend) `open -a OrbStack`, then `docker info` to confirm.
- **Supabase down?** From the current worktree: `pnpm supabase:start`, which targets whichever backend the worktree uses. Ports are isolated, so this won't affect anyone else.
- **Fresh worktree database?** `pnpm supabase:start && pnpm run db:migrate` is the non-destructive bootstrap. `preflight` checks this state before costly work and prints the isolated Postgres port when it is missing; it never starts or migrates services implicitly.

Leave the stack running while the branch's work is in flight, and hand off what's running. Once its PR merges, stop the dev server and stack (`pinpoint-pr-workflow` Phase 5.2). If you can't start it (port collisions, stuck containers), ask the user — don't fall back to "let CI tell us."

### Process safety

Only stop services you started in this session, by specific PID or via worktree-local commands (e.g. `pnpm supabase:stop` inside the worktree). One exception: after your PR merges, you may stop your own worktree's stack even if an earlier session started it, provided no session is still using it (`pinpoint-pr-workflow` Phase 5.2). Forbidden without explicit permission: `supabase stop --all`, `pkill`/`killall` against process names, `docker stop` on containers you didn't start. The system runs many environments in parallel; broad kills wipe out other agents' work.

## 5. Workflow

### Key commands

`check`, `test`, and `preflight` are compact by default for agent use. Their
`:human` variants stream the same gate graph; compact warning and failure logs
are private (`0600`) under `tmp/validation-logs/` and expire after seven days.

| Command                                                                              | What                                                                                                                                                                                                                                                                                                                                                    |
| :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run check`                                                                     | Fast **static** gate: types, lint (oxlint), format (rewrites files via `format:fix`), yamllint, actionlint, ruff, shellcheck (~9s; `format:fix` is the long pole). **No unit tests** (see `pnpm run test`), **no pytest** (see `check:python`).                                                                                                         |
| `pnpm run check:python`                                                              | ruff + `pytest scripts/tests/ -m "not integration"` (~14s). Fast unit gate split out of `check` because Python changes are rare; CI's required `Fast Linters` job runs it on every push regardless. Run `pnpm run test:python:all` for the full suite (unit + integration). Run after touching `scripts/` or `.claude/hooks/`.                          |
| `pnpm run test:integration:target -- <path>`                                         | Run one or more named PGlite integration test files. This is the supported targeted entrypoint: it generates the derived test schema first and refuses an omitted path. Do not combine unit and integration paths in a bare Vitest command.                                                                                                             |
| `pnpm run preflight`                                                                 | Full, in order, stopping at the first failure: readiness → `check:human` → `test:human` → `db:fast-reset` → build → integration → Supabase integration → chromium-only smoke (`scripts/workflow/preflight.sh`; `preflight:human` streams it). **For non-trivial changes** (migrations, auth, server actions, middleware, DB schema) — not every commit. |
| `pnpm run smoke`                                                                     | Smoke E2E (~60s)                                                                                                                                                                                                                                                                                                                                        |
| `pnpm run e2e:full`                                                                  | Full E2E suite — CI's job by default. Runs **every** browser project; add `--project=chromium` to mirror CI's required job. Plus a Supabase stack and a Next server; peaks several GB.                                                                                                                                                                  |
| `pnpm run e2e:all`                                                                   | Full then smoke, separate Playwright invocations so the DB resets between them (~10–15 min) — CI's job by default. Chromium only, mirroring the two required CI jobs. Roughly twice `e2e:full` at `--project=chromium`.                                                                                                                                 |
| `pnpm run db:migrate`                                                                | Apply schema changes locally                                                                                                                                                                                                                                                                                                                            |
| `pnpm run db:backup`                                                                 | Manual prod dump → `~/.pinpoint/db-backups` (data-only dev seed, **not** a DR artifact)                                                                                                                                                                                                                                                                 |
| `pnpm run db:seed:from-prod`                                                         | Reset local + seed from latest prod backup                                                                                                                                                                                                                                                                                                              |
| `node scripts/query-readonly.mjs "<sql>"`                                            | Query prod (or any DB) through `POSTGRES_URL_READONLY` — a dedicated `pinpoint_readonly` role with no write grants, so investigating a bug means reading prod without service-role write authority. One-time setup: `scripts/sql/readonly-role.sql`. Falls back to `POSTGRES_URL` (can write) if the role isn't set up. (PP-xdvw.)                      |
| `python3 scripts/workflow/pr-watch.py <PR> --phase ci\|review --expected-head <SHA>` | Wait on CI or review for one PR head (`pinpoint-pr-workflow` Phase 3). Run it as a background command; stdout is one terminal JSON verdict (exit 0 passed / 1 act on it / 2 undetermined). Never hand-roll a polling loop.                                                                                                                              |
| `pnpm run dev:status`                                                                | Check whether Next.js / Supabase / Postgres are up — one command, worktree-port aware. Use it instead of ad-hoc `curl` health checks against localhost.                                                                                                                                                                                                 |
| `pnpm run clean:next`                                                                | Delete the worktree's `.next` cache. Stop the dev server first. A corrupted Turbopack cache hangs one route's compile and every other route waits behind it. Use this instead of `rm -rf .next`, which prompts for permission.                                                                                                                          |

### Prototype mode (rapid iteration)

When the user explicitly asks for "prototype mode" / "rapid iteration" / "just explore" **for UI/UX work**, load the `pinpoint-prototype-mode` skill and enter it. It's scoped to **presentation only** — layout, components, styling, page structure, interaction/flow — and explicitly **not** for backend/internal work (data layer, server-action logic, auth, permissions, migrations), which keep full rigor; stub data rather than building it. Never self-elect into it; full rigor is the default.

### Which tests to run

1. Docs, hooks, config, or other non-source changes → `pnpm run check` is enough (~9s) — plus `pnpm run check:python` if you touched `scripts/` or `.claude/hooks/`
2. Pure logic / utils → `pnpm run check` (~9s) **plus `pnpm run test`** — check no longer runs unit tests. One file: `pnpm run test <path>` (no `--`; pnpm passes it through literally and Vitest ignores everything after it)
3. One PGlite integration file → `pnpm run test:integration:target -- src/test/integration/path.test.ts`; this prepares `schema.sql` before Vitest
4. Single E2E spec → `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium` (~15–30s)
5. UI components / forms → `pnpm run test` (RTL unit), then **stop for Early UI Review** (PP-4c4b: present screenshots or local preview to Tim) before writing/running `pnpm run smoke` or E2E specs
6. Auth / permissions / middleware → `pnpm run smoke` + targeted specs
7. DB schema / migrations → `pnpm run preflight`
8. Final pre-review → push and let **CI** run the full suite; don't sweep locally.

**Never** invoke `pnpm exec playwright test` with no spec path — it runs every spec in one Playwright process and cross-contaminates seed state. Report flaky tests; don't retry in a loop.

### Reproducing CI failures locally

Always try local first — seconds vs minutes, full devtools. If a single-test run fails with missing fixtures, run the whole file (E2E specs share state across describe blocks via `beforeAll`).

### Branches

- **Create inside a worktree**: `git checkout -b feature/name && git push -u origin feature/name`. Verify with `git branch -vv` shows `[origin/feature/name]`, not `[origin/main]`. Never push to `main`.
- **Sync with merge, never rebase**: `git fetch origin && git merge origin/main`. Rebase rewrites SHAs → force-push → teammate guardrails block → ~30 min lost negotiating push permission. Always merge. (Casework: PP audit-cleanup wave 2026-05-15.)

### CI

- **Check for conflicts first**: `gh pr view <PR> --json mergeable,mergeStateStatus`. `DIRTY`/`CONFLICTING` means GitHub silently skips workflow runs until you resolve. `pnpm run check` includes a `check:behind-main` warning.
- **Required check**: only `CI Gate` (ruleset `6326455`). Vercel is not required. `BLOCKED` while E2E is still running is normal.

### Migration conflicts

Never resolve `drizzle/meta` conflicts manually — the folder holds binary-like schema snapshots; manual edits corrupt the prevId chain. Full regenerate-don't-edit protocol: `pinpoint-deployment` skill.

### Getting a PR reviewed

**The reviewer is a local Claude Code `/code-review` run by the owning agent.** Open every agent-created PR as a GitHub draft. After current-head `CI Gate` succeeds, run `/code-review` at the level `bash scripts/workflow/claude-review-level.sh` prints (`ask` means ask Tim first), fix or decline every finding, and re-review each new head until a round raises nothing new. Then `bash scripts/workflow/record-claude-review.sh <PR> --level <level> --findings <file>` posts the SHA-pinned review record the merge gate counts and promotes the draft. Any push other than a clean merge of `main` needs a new round and a new record. Spec: `docs/feature-specs/pr-lifecycle-monitoring.md` §8.

Request and state-transition rules: `pinpoint-pr-workflow` skill Phase 3.

### The `ownerless` label

PinPoint's one use of GitHub labels for agent coordination. Anything opened by an **unattended** bot — a scheduled Claude cloud routine, Dependabot, Renovate — carries `ownerless` on its issue or PR, because no session is driving its lifecycle: nobody is watching CI, adjudicating review threads, or taking it to merge-ready. Dependabot and Renovate apply it to PRs from `.github/dependabot.yml` and `.github/renovate.json`; `.github/workflows/ownerless-renovate-issues.yaml` applies it once when Renovate opens an issue; a routine applies it itself (`gh pr create --label ownerless`, `gh issue create --label ownerless`).

It is the queue an orchestrator works from — `gh pr list --label ownerless` and `gh issue list --label ownerless` are the open work nobody owns. A session that **adopts** one takes over that lifecycle per "Getting a PR reviewed" and removes the label (`gh pr edit <n> --remove-label ownerless`). An interactive session **never** adds it to its own work: a PR you opened is a PR you own.

### Handing a PR over to merge

Don't write the handoff summary — **run it and paste it**:

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

### Review comments

The canonical review rubric is `REVIEW.md` at the repo root. If a PR accumulates review comments (from Tim or another agent): fix the code, OR decline with a one-sentence reply (`add_reply_to_pull_request_comment`) and resolve the thread (`pull_request_review_write(method: "resolve_thread")`). Sign replies with your agent name (`—Claude`, `—Codex`, `—Antigravity`). Declined comments must get a reply — no silent ignores.

### Superpowers lifecycle → beads

When you run the superpowers plugin lifecycle (`brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch`), load `pinpoint-superpowers-bridge` — several superpowers steps conflict with PinPoint rules (local merge, raw `git worktree remove`, generic test commands, uncapped subagent dispatch, the plugin's own review-reply flow) and the skill spells out the overrides.

## 6. Working style

How Tim wants agents to behave. (§1 has the one-line version; this is the detail.)

### Collaboration & decisions

- **Don't make my calls for me.** (a) When you ask me a multi-option question, wait for my answer before acting on one — even in auto/autonomous mode; deciding before I reply makes the question performative and removes my choice. (b) Auto/autonomous mode authorizes _operational_ calls (continuing work, tool choices, cleanup, re-publishing after a restart), **not** taste decisions — layout, color, copy, IA, or scope tradeoffs I surfaced. When I'm the taste-maker, ask (`AskUserQuestion` or a visual playground). While waiting on an answer, only do genuinely non-blocking parallel work.
- **PR lifecycle is agent-owned.** Follow §5 "Getting a PR reviewed" through the exact-head manual review request and finding adjudication; draft/ready mechanics live in `pinpoint-pr-workflow`.
- **Link markdown files by absolute path.** When you point me at a markdown file to read or review (a plan, spec, handoff doc, report), always give the full absolute path (e.g. `/Users/froeht/Code/PinPoint/docs/...`), never a relative one. Absolute paths open directly in a cmux pane.

### Scope and shipping discipline

- **Polish before shipping — no "fast follow."** Get a change genuinely good before it merges; don't ship something rough on the promise of a later cleanup PR. There is no fast-follow culture here.
- **Slice large work into smaller _complete_ features.** When something is too big to polish in one pass, split it into smaller features that each ship finished — not one big half-done change followed by patch-up PRs. Smaller-but-complete beats larger-but-rough.

## 7. Deployment

### Supabase

- **`pinpoint-prod`** (Live, Pro plan): **real user data — strict safety.** Daily backups, 7-day retention, no PITR — so the recovery floor is the previous nightly snapshot. That posture is asserted weekly by `pnpm run chores:backups` (chores checklist item 9); it verifies backups exist and are retained, not that they restore.
- **Local**: `db:reset` OK. **Prod: NEVER `db:reset`. Only `db:migrate`.**
- **Prod-mutating Supabase surfaces are gated in `.claude/settings.json`** (CORE-SEC-010).
- **Connection**: app + scripts use `POSTGRES_URL` — the Supavisor **transaction** pooler (`…pooler.supabase.com:6543`, IPv4), with `prepare:false` set on every porsager client that connects there (`src/server/db/index.ts`, `scripts/lib/pg-client.mjs`) — the transaction pooler does not support prepared statements, and a resolved incident (PP-d8l8) traced silent prod commit loss to this exact setting missing on the runtime client. **Never reintroduce `prepare:true` on a `:6543` client.** Full pooler/endpoint reference, connection string format, and the incident writeup: `pinpoint-deployment` skill.

### Vercel

- Vercel runs `pnpm run migrate:production` on build (production only).
- Stuck migration: `scripts/mark-migration-applied.ts` marks a migration applied without running it, so a wrong number permanently diverges prod's schema from history. Procedure: `pinpoint-deployment` skill.

### Preview deployments (on-demand, TTL'd Supabase branches)

Native Supabase auto-branching is **disabled** — no PR gets a preview by default. Previews are created on demand via the `/preview` PR-comment command and torn down on a TTL by an hourly reaper. Full control-surface reference and implementation pointers: `pinpoint-deployment` skill.

### pnpm audit gate

CI runs `pnpm audit` only on PRs that change `pnpm-lock.yaml` or `pnpm-workspace.yaml`, and fails only on high/critical advisories the PR adds over its base; advisories already on `main` are Dependabot's job. See `pinpoint-deployment`.

## 8. Documentation

Actionable, "what" and "how" only. Skills carry the deep dives.

**Canonical specs are authoritative** — particularly `pinpoint-design-bible` (§5 page archetypes, §17 modal archetypes). When implementation changes UI behavior covered there, **edit the spec in place**. Don't append divergence notes or "TODO: spec out of date" disclaimers. If you find one, fold it into canonical text and delete it. Dated artifacts in `docs/superpowers/specs/` are records — leave them alone.

**Feature specs stay current as you work** (`docs/feature-specs/`, `spec-driven-development` skill): when a change touches behavior covered by one, the **same PR** updates the spec or adds a divergence-table row — never neither. Feature-spec source is diff-oriented: keep each prose paragraph, concept bullet, numbered requirement, divergence row, and changelog row on one physical line and rely on the editor or renderer for visual soft wrapping. Edits to actual requirements require Tim approving the exact diff first, even when he says "update the spec." Formatter-only normalization is exempt when Prettier's `--debug-check` passes before writing and the formatter is the only process that changes the spec. Divergence-table maintenance (adding, narrowing, or deleting rows) does not require separate diff approval.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
