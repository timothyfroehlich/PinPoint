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

### 2.2 Process rules

1. **Escape parentheses in paths**: `src/app/\(app\)/page.tsx`.
2. **Run `pnpm run check` before committing** (~9s — the default floor). It is a **static** gate: types, lint, format, and the shell/YAML/Python linters. **It does not run unit tests, and does not run pytest** (PP-4zcj) — unit tests are a required CI job (`test-unit`), part of `preflight`, and available via `pnpm run test`; the Python hook/script tests are a required CI job (`linters`) and available via `pnpm run check:python`. Reserve `pnpm run preflight` (the slower check + build + unit + integration) for **non-trivial changes**: migrations, security/auth, server actions, middleware, DB schema. Preflight is the exception, not the per-commit rule.
3. **Don't kill processes you didn't start** — see §4 Process safety.
4. **Sync with merge, never rebase** — see §5 Branches.
5. **Root checkout is read-only.** It stays on `main`. All work — including planning docs — happens in a worktree. Dispatch a subagent or switch into an existing worktree. Tool-specific dispatch mechanics live in `CLAUDE.md`. (PP-46z, PP-bg45.)
6. **Never `--no-verify`**, never wildcard tool permissions — without explicit user approval each time. **The merge decision is Tim's, always.** An agent MAY run the gate-enforced script `bash scripts/workflow/merge-pr.sh <PR> --human`, but the `block-direct-merge.cjs` PreToolUse hook turns that invocation into an **approval prompt** — Tim approves before it runs, so the merge is still his call (PP-wi85, reversed for the script only, per Tim 2026-08-19). The raw merge channels stay **hard-blocked** for agents — never `gh pr merge`, never `gh api PUT .../merge`, never MCP `merge_pull_request` — because they skip the script's gate re-checks (CI green, review pins head, threads resolved, no conflict). An agent's normal terminal state on a PR is still: ready-for-review, CI green, a review covering the head commit (see §5 "Getting a PR reviewed"), threads resolved, screenshots posted if UI-touching, then hand over with `bash scripts/workflow/merge-handoff.sh <PR>` — it prints the state Tim needs plus the merge command. (PP-wi85.)
7. **Beads: `team-maintainer` policy** (not the conservative default).

**Codex mutations:** use `bd --actor Codex <command>` so automated writes never fall back to Tim's identity.

**Beads in a cloud/ephemeral checkout:** if `.beads/` is absent (fresh cloud sandbox), run `bash scripts/beads-cloud-init.sh && cd ~/beads` before any `bd` write — the binaries are already installed by the environment setup script; this materializes the DoltHub credential and clones the shared DB. A discovery net; scheduled routines still carry the same line as a prompt preamble. Full setup: `docs/runbooks/cloud-routines-beads-access.md`.

## 3. Agent Skills

Before working in an area covered by a skill, read that skill. If your tool doesn't support skills, read its `SKILL.md` directly. All project skills live at `.agents/skills/<name>/SKILL.md`; they own task-specific procedure while this file stays agent-neutral.

Before exploring or changing non-mechanical product behavior, read
`docs/agents/domain.md`; it routes the relevant glossary, feature spec, and
ADRs. Skip it for mechanical changes that do not affect product behavior or
domain language.

**The huddle is the exception, and it is not in this repo.** Inter-session coordination — the SessionStart identity notice, the poll, the daily bead — moved to Tim's dotfiles on 2026-08-12: scripts at `~/.claude/hooks/huddle/`, skill at `~/.claude/skills/huddle/`, tests alongside the scripts. Nothing about it was PinPoint-specific, and living outside the repo means editing it costs no PR. What stays here is the four hook registrations in `.claude/settings.json` and the channel itself — the huddle resolves `.agents/huddle/` and its beads from the cwd's repo, so the conversation is still per-project.

## 4. Environment

### Host prerequisites

One-time install for tools the workflow scripts depend on:

- **GNU parallel** — provides `sem`, which `pnpm run preflight` uses to cap host-wide concurrency at 2. Without it, `preflight` fails with a clear install hint; `pnpm run preflight:unlocked` bypasses the cap.
- **pytest** — `pnpm run check:python` runs the hook/script tests with it, and dies with a bare `pytest: command not found` if it is absent (no runtime install hint, unlike `sem`). Install it however your host installs Python CLI tools — Homebrew, pipx, distro package.

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

- **OrbStack down?** `open -a OrbStack`, then `docker info` to confirm.
- **Supabase down?** From the current worktree: `supabase start`. Ports are isolated, so this won't affect anyone else.

Leave the stack running afterward — the user can stop it. Hand off what's running. If you can't start it (port collisions, stuck containers), ask the user — don't fall back to "let CI tell us."

### Process safety

Only stop services you started in this session, by specific PID or via worktree-local commands (e.g. `supabase stop` inside the worktree). Forbidden without explicit permission: `supabase stop --all`, `pkill`/`killall` against process names, `docker stop` on containers you didn't start. The system runs many environments in parallel; broad kills wipe out other agents' work.

## 5. Workflow

### Key commands

| Command                                   | What                                                                                                                                                                                                                                                                                                                               |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run check`                          | Fast **static** gate: types, lint (via the `lint:local` oxlint mirror), format, yamllint, actionlint, ruff, shellcheck (~9s; `format:fix` is the long pole). **No unit tests** (see `pnpm run test`), **no pytest** (see `check:python`).                                                                                          |
| `pnpm run check:python`                   | ruff + `pytest scripts/tests/` (~14s). Split out of `check` because Python changes are rare; CI's required `Fast Linters` job runs it on every push regardless. Run after touching `scripts/` or `.claude/hooks/`.                                                                                                                 |
| `pnpm run preflight`                      | Full: check + build + integration. **For non-trivial changes** (migrations, auth, server actions, middleware, DB schema) — not every commit. Host-wide cap of 2 concurrent runs (via `sem`); use `preflight:unlocked` to bypass.                                                                                                   |
| `pnpm run smoke`                          | Smoke E2E (~60s)                                                                                                                                                                                                                                                                                                                   |
| `pnpm run e2e:full`                       | Full E2E suite — CI's job by default. Runs **every** browser project; add `--project=chromium` to mirror CI's required job. Plus a Supabase stack and a Next server; peaks several GB.                                                                                                                                             |
| `pnpm run e2e:all`                        | Full then smoke, separate Playwright invocations so the DB resets between them (~10–15 min) — CI's job by default. Chromium only, mirroring the two required CI jobs. Roughly twice `e2e:full` at `--project=chromium`.                                                                                                            |
| `pnpm run db:migrate`                     | Apply schema changes locally                                                                                                                                                                                                                                                                                                       |
| `pnpm run db:backup`                      | Manual prod dump → `~/.pinpoint/db-backups` (data-only dev seed, **not** a DR artifact)                                                                                                                                                                                                                                            |
| `pnpm run db:seed:from-prod`              | Reset local + seed from latest prod backup                                                                                                                                                                                                                                                                                         |
| `pnpm run chores:backups`                 | Verify prod Supabase daily physical backups exist + retention is intact (weekly chore; hits prod, not part of `check`)                                                                                                                                                                                                             |
| `node scripts/query-readonly.mjs "<sql>"` | Query prod (or any DB) through `POSTGRES_URL_READONLY` — a dedicated `pinpoint_readonly` role with no write grants, so investigating a bug means reading prod without service-role write authority. One-time setup: `scripts/sql/readonly-role.sql`. Falls back to `POSTGRES_URL` (can write) if the role isn't set up. (PP-xdvw.) |
| `ruff check && ruff format`               | Python lint/format (no venv needed)                                                                                                                                                                                                                                                                                                |
| `./scripts/workflow/pr-watch.py <PR>`     | Watch CI for a PR (Monitor-compatible). Never hand-roll a polling loop.                                                                                                                                                                                                                                                            |
| `pnpm run dev:status`                     | Check whether Next.js / Supabase / Postgres are up — one command, worktree-port aware. Use it instead of ad-hoc `curl` health checks against localhost.                                                                                                                                                                            |

### Type-check engine (TS 7 GA dual-install)

TypeScript 7.0 (the Go-native compiler) is GA and installed via Microsoft's recommended dual-install: `@typescript/native` (alias of `typescript@^7`) ships the native `tsc` binary that runs the `typecheck`, `typecheck:tests`, and `typecheck:e2e` gates (~4–6× faster than TS6's `tsc`), while the `typescript` package name is aliased to `@typescript/typescript6` — the TS6 JS compiler API + a `tsc6` binary. **ESLint type-aware linting and `next build` still type-check on that TS6 API** — TS7 doesn't ship a stable JS API until 7.1, so do not remove the `typescript` alias. Bin names are unambiguous: `tsc` = native 7, `tsc6` = JS 6. `pnpm run typecheck:tsc6` runs the TS6 engine for A/B comparison. PP-8mv1 moved the test/e2e configs onto native `tsc` (0 divergences vs `tsc6` on `tsconfig.tests.check.json` and `e2e/tsconfig.json`) and retired the `tsc-baseline` gate. History and validation record: `docs/plans/2026-06-27-typescript-7-upgrade-plan.md` (PRs #1586, PP-xu96, PP-8mv1).

### Lint engines (authoritative ESLint + local oxlint mirror)

`pnpm run lint` (full ESLint, type-aware via the TS6 JS API) is **authoritative** and is what CI runs — unchanged. `pnpm run check` runs `lint:local` instead: a faster **mirror** of the same rules, split in two because no single engine covers them all.

- `lint:_oxlint` — `oxlint` with `options.typeAware`, backed by the Go-native tsgolint engine. Owns the type-checked bulk plus the syntactic TypeScript rules. ~0.9s / ~930 MB.
- `lint:_slim` — `PINPOINT_LINT_SLIM=1 eslint src/ e2e/ scripts/`. The same `eslint.config.mjs`, with typescript-eslint's `disable-type-checked` spread in and the project service off, so it costs nothing to build a Program. Owns the plugins oxlint can't run: the local `pinpoint` custom rule, `better-tailwindcss`, `eslint-comments`, `unused-imports`, `react-hooks`, `promise`, `jsx-a11y`. ~3.5s / ~1.2 GB.

Together ~3.8s vs full ESLint's ~14.9s, and peak RSS ~1.2 GB vs ~3.2 GB. The memory drop is the point, not the wall-clock.

**The mirror is a speed optimization, never a coverage bet.** Drift fails safe: whatever it misses, CI's full ESLint still catches, so the worst case is a CI-only failure, never silent loss. Two maintenance rules follow:

1. Add a type-aware rule to `eslint.config.mjs` → add it to `.oxlintrc.json` too, **including any per-override `"off"`**. Rules oxlint still classifies as nursery (e.g. `no-unnecessary-condition`) are skipped by `@oxlint/migrate` and must be listed by hand.
2. A lint failure that reproduces only in CI means the mirror drifted. Fix the mirror; don't treat it as flake.

**`typescript/prefer-optional-chain` is stricter in oxlint than in typescript-eslint.** It is enabled in both, but oxlint fires on two shapes ESLint stays silent on, and they needed opposite treatment:

- `src/lib/cookies/client.ts` — `typeof window !== "undefined" && window.location…`. **oxlint is wrong here**: `?.` guards a nullish _value_, not an undeclared _binding_, so `window?.location` still throws `ReferenceError` under SSR (verified: `undeclared?.foo` throws). Silenced with a scoped `/* oxlint-disable */` … `/* oxlint-enable */` pair — block form, because the expression wraps and `-next-line` would miss it. The suppression is narrow: a violation elsewhere in that file is still caught.
- `src/components/machines/PinballMapLinkField.tsx` — a `family !== null && family.x === null && family.y > 1` chain. **oxlint was right and typescript-eslint merely conservative**: the rewrite is semantically equivalent and type-checks clean, because TS narrows `family` to non-null once `family?.x === null` holds. Rewritten.

The general rule this illustrates: when the mirror is stricter than authoritative ESLint, fix or suppress the specific site — don't drop the rule, which would silently widen the coverage gap. (PP-4zcj.)

(PP-4zcj.)

### Prototype mode (rapid iteration)

When the user explicitly asks for "prototype mode" / "rapid iteration" / "just explore" **for UI/UX work**, load the `pinpoint-prototype-mode` skill and enter it. It's scoped to **presentation only** — layout, components, styling, page structure, interaction/flow — and explicitly **not** for backend/internal work (data layer, server-action logic, auth, permissions, migrations), which keep full rigor; stub data rather than building it. Within that scope it relaxes the §2 rigor (skip preflight/tests before showing work, defer lint/type fixes, defer coverage and DRY) while logging every skipped item to a `.prototype-mode` debt ledger. It changes **agent behavior only** — pre-commit and `preflight` hooks still run on any real commit, which is fine because prototype work stays local and uncommitted. Never self-elect into it; full rigor is the default. A `UserPromptSubmit`/`SessionStart` hook reminds the agent while the marker exists, so the mode survives compaction. Exit on "exit prototype mode" / "make this real" — then repay the ledger.

### Which tests to run

1. Docs, hooks, config, or other non-source changes → `pnpm run check` is enough (~9s) — plus `pnpm run check:python` if you touched `scripts/` or `.claude/hooks/`
2. Pure logic / utils → `pnpm run check` (~9s) **plus `pnpm run test`** — check no longer runs unit tests
3. Single E2E spec → `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium` (~15–30s)
4. UI components / forms → `pnpm run test` (RTL unit) then `pnpm run smoke`
5. Auth / permissions / middleware → `pnpm run smoke` + targeted specs
6. DB schema / migrations → `pnpm run preflight`
7. Final pre-review → push and let **CI** run the full suite; don't sweep locally.

**Never** invoke `pnpm exec playwright test` with no spec path — it runs every spec in one Playwright process and cross-contaminates seed state. The full suite (`e2e:full` / `e2e:all`) is CI's job by default — roughly 8–10 minutes of three parallel workers plus a Supabase stack and a Next server, peaking at several GB. Run it locally when you actually want the signal and the host has the headroom. **Pass `--project=chromium`** for targeted runs, and for `e2e:full` unless you specifically want cross-browser signal (`e2e:all` already pins it). Leaving it off runs every browser project concurrently against one database, so a spec that mutates a seeded row and never restores it passes in whichever project is scheduled first and fails in the rest. **Read that red as a real bug, not a local-setup artifact.** PP-168u was ten such failures and every one traced to a spec leaking seeded state — a seeded issue reassigned away for good, the seeded guest left promoted to member, a settings set left on a shared machine. The three required PR E2E jobs each run a single project against their own database and so cannot see this class at all; the only job that can is the post-merge `E2E Comprehensive Tests`, which runs chromium + Mobile Chrome + Mobile Safari in **one** Playwright process against **one** database. It is push-to-main only, so it cannot gate a PR merge — but its `failure` now fails the required `CI Gate` check **on the main commit** (PP-x0ke), so a red post-merge full-matrix verdict alarms at merge time instead of hiding behind a green main. On a `pull_request` event it is skipped and passes, exactly as before. Use `--headed` to debug visually. Report flaky tests; don't retry in a loop.

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

Never resolve `drizzle/meta` conflicts manually — the folder holds binary-like schema snapshots; manual edits corrupt the prevId chain. Full regenerate-don't-edit protocol: `pinpoint-deployment` skill.

### Getting a PR reviewed

**No bot reviews this repo.** Copilot review was retired on 2026-08-02 (PP-4ric) — the free tier was too small to review PinPoint's PRs, so quota outages were the normal state. The merge bar is unchanged: a PR still needs a review covering its **head commit**, with threads resolved.

**Tim can trigger GitHub-native Codex review.** Finish churn first (CI fixes, merge-from-main), stop iterating, then Tim may comment `@codex review` on the PR. It uses the installed GitHub integration and does not use an OpenAI API key. Once Codex has reviewed, address every finding and have Tim comment `@codex review` again if the branch changed. A Codex GitHub `APPROVED` review of the current head SHA is valid alongside the existing manual attestation workflow.

The gate accepts either GitHub's native Codex review record — exact account `chatgpt-codex-connector[bot]`, state `APPROVED`, and `commit_id` equal to the PR head SHA — or the existing SHA-pinned `mark-review.sh` attestation after `/codex:review` or `/code-review`. Full rules: `pinpoint-pr-workflow` skill Phase 3.4.

### Handing a PR over to merge

Don't write the handoff summary — **run it and paste it**:

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

It computes what Tim needs in order to merge without re-deriving anything: which review covered head and how many commits back it was, CI, threads, mergeable + distance behind main, when main was last merged in, the diff split src / tests / docs / other, migrations, newly-registered env vars, UI + screenshots — then two `!`-prefixed commands, one to re-run the report (it is a snapshot) and one to merge. The merge command is printed **only** when all four gates pass; otherwise the block names what is blocking, so an un-ready PR cannot be handed over as ready. Every field is a claim an agent would otherwise be making from memory. (PP-9onv.)

### Review comments

The canonical review rubric is `REVIEW.md` at the repo root. If a PR accumulates review comments (from Tim or another agent): fix the code, OR decline with a one-sentence reply (`add_reply_to_pull_request_comment`) and resolve the thread (`pull_request_review_write(method: "resolve_thread")`). Sign replies with your agent name (`—Claude`, `—Gemini`, `—Codex`, `—Antigravity`). Declined comments must get a reply — no silent ignores.

### Parallel subagent work

Use worktree-isolated subagents for independent tasks. Tool-specific dispatch, hooks, and known bugs live in your tool's instructions file. Full multi-tool workflow: `pinpoint-orchestrator` skill.

### Superpowers lifecycle → beads

When you run the superpowers plugin lifecycle (`brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch`), load `pinpoint-superpowers-bridge` — several superpowers steps conflict with PinPoint rules (local merge, raw `git worktree remove`, generic test commands, uncapped subagent dispatch, the plugin's own review-reply flow) and the skill spells out the overrides. Superpowers specs and plans are **working documents, not repo artifacts** (decision 2026-08-16): draft them outside the repo tree (the session scratchpad), store the content in the bead. Files under `docs/superpowers/` committed before the decision stay as records (§8); no new files go there. Durable requirements belong in `docs/feature-specs/` (§8), not in superpowers docs. Bead fields:

- `--spec-id` = the feature spec path (`docs/feature-specs/<feature>.md`), when the work has one
- `--design` = the **full plan text**, stored when the plan is written and refreshed when it materially changes
- `--acceptance` = distilled success criteria
- `--notes` = landing breadcrumbs (PR #, branch, migration state, follow-ups)

Plan-file checkboxes are within-PR execution state, **not** durable task tracking — the bead is the cross-session source of truth. Single-PR work gets one bead (no per-task sliver-beads); only multi-PR epics decompose into children.

## 6. Working style

How Tim wants agents to behave. (§1 has the one-line version; this is the detail.)

### Collaboration & decisions

- **Don't make my calls for me.** (a) When you ask me a multi-option question, wait for my answer before acting on one — even in auto/autonomous mode; deciding before I reply makes the question performative and removes my choice. (b) Auto/autonomous mode authorizes _operational_ calls (continuing work, tool choices, cleanup, re-publishing after a restart), **not** taste decisions — layout, color, copy, IA, or scope tradeoffs I surfaced. When I'm the taste-maker, ask (`AskUserQuestion` or a visual playground). While waiting on an answer, only do genuinely non-blocking parallel work.
- **PRs ready-by-default.** Open PRs as ready-for-review, not draft. CI runs the same on drafts, so draft gates nothing — it just adds a "flip ready" step and signals WIP. Use draft only while still iterating, when you want title/description feedback first, or when you've told me you're pausing mid-task.
- **Link markdown files by absolute path.** When you point me at a markdown file to read or review (a plan, spec, handoff doc, report), always give the full absolute path (e.g. `/Users/froeht/Code/PinPoint/docs/...`), never a relative one. Absolute paths open directly in a cmux pane.

### Scope and shipping discipline

- **Polish before shipping — no "fast follow."** Get a change genuinely good before it merges; don't ship something rough on the promise of a later cleanup PR. There is no fast-follow culture here.
- **Slice large work into smaller _complete_ features.** When something is too big to polish in one pass, split it into smaller features that each ship finished — not one big half-done change followed by patch-up PRs. Smaller-but-complete beats larger-but-rough.

## 7. Deployment

### Supabase

- **`pinpoint-prod`** (Live, Pro plan): **real user data — strict safety.** Daily backups, 7-day retention, no PITR — so the recovery floor is the previous nightly snapshot. That posture is asserted weekly by `pnpm run chores:backups` (chores checklist item 9); it verifies backups exist and are retained, not that they restore.
- **Local**: `db:reset` OK. **Prod: NEVER `db:reset`. Only `db:migrate`.**
- **Prod-mutating Supabase surfaces are gated in `.claude/settings.json`** (CORE-SEC-010): prod is the only project in the org, and MCP calls bypass both the Bash hook stack and the script-level `assertLocalDatabase` / `assertNotDrizzlePush` guards. So: every write-capable MCP tool (`execute_sql`, `apply_migration`, `deploy_edge_function`, `pause_project`, `restore_project`, `create_project`, the branch mutators) is on `permissions.ask`; the destructive CLI verbs `supabase db reset` / `db remote commit` / `migration repair` / `branches delete` are on `ask`, and `supabase db push` / `projects delete` on `deny`. Read-only MCP tools stay unprompted. These are prefix matchers over the command string — a speed bump against accidents, not a security boundary — and they don't reach child processes, so `pnpm run db:reset` and the E2E global-setup are unaffected. Add new write surfaces to the lists as the connector or CLI grows.
- **Connection**: app + scripts use `POSTGRES_URL` — the Supavisor **transaction** pooler (`…pooler.supabase.com:6543`, IPv4), with `prepare:false` set on every porsager client that connects there (`src/server/db/index.ts`, `scripts/lib/pg-client.mjs`) — the transaction pooler does not support prepared statements, and a resolved incident (PP-d8l8) traced silent prod commit loss to this exact setting missing on the runtime client. **Never reintroduce `prepare:true` on a `:6543` client.** Full pooler/endpoint reference, connection string format, and the incident writeup: `pinpoint-deployment` skill.

### Vercel

- Vercel runs `pnpm run migrate:production` on build (production only).
- Stuck migration fix: `MARK_MIGRATION_FORCE_PRODUCTION=1 POSTGRES_URL=<prod_url> tsx scripts/mark-migration-applied.ts <n>`. The token is required — the script refuses a remote target without it, and prompts once more when run in a TTY. It writes to `drizzle.__drizzle_migrations` without running the migration, so a wrong number makes prod's schema diverge from history permanently.

### Preview deployments (on-demand, TTL'd Supabase branches)

Native Supabase auto-branching is **disabled** — no PR gets a preview by default. Previews are created on demand via the `/preview` PR-comment command and torn down on a TTL by an hourly reaper. Full control-surface reference and implementation pointers: `pinpoint-deployment` skill.

### Audit-gate override (per-PR `/audit-override`)

When `pnpm audit --audit-level=high` goes RED on a freshly-published advisory **unrelated** to a PR's changes, `/audit-override <reason>` is the escape hatch so it doesn't force an admin-merge — commit-bound, dropped on every new push. Full protocol: `pinpoint-deployment` skill.

## 8. Documentation

Actionable, "what" and "how" only. Skills carry the deep dives.

**Canonical specs are authoritative** — particularly `pinpoint-design-bible` (§5 page archetypes, §17 modal archetypes). When implementation changes UI behavior covered there, **edit the spec in place**. Don't append divergence notes or "TODO: spec out of date" disclaimers. If you find one, fold it into canonical text and delete it. Dated artifacts in `docs/superpowers/specs/` are records — leave them alone.

**Feature specs stay current as you work** (`docs/feature-specs/`, `spec-driven-development` skill): when a change touches behavior covered by one, the **same PR** updates the spec or adds a divergence-table row — never neither. Spec edits require Tim approving the exact diff first, even when he says "update the spec".
