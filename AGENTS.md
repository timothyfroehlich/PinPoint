# PinPoint Agent Context

## 1. User & Mission

**User**: Tim (GitHub: timothyfroehlich)
**Goal**: Vibecoding PinPoint (Pinball Issue Tracker) for Austin Pinball Collective.
**Phase**: Soft-launched (Beta). Active users. Working on MVP+ Polish.
**Style**: Explain pros/cons. Teach, don't just fix.
**Constraint**: PR reviews are AI-generated; apply critical thinking.

## 2. Critical Non-Negotiables (The "10 Commandments")

1. **Escape parentheses** in paths (e.g., `src/app/\(app\)/page.tsx`).
2. **Drizzle Migrations**: We use Drizzle ORM, NOT Supabase migrations. Never use `drizzle-kit push`. Use `db:generate` + `db:migrate`. Supabase migration config is disabled (`db.migrations.enabled = false`).
3. **Worker-Scoped PGlite**: No per-test DB instances (causes lockups). Use shared worker.
4. **Server Components Default**: "use client" only for interaction leaves.
5. **Progressive Enhancement**: `<form action={serverAction}>`. No inline handlers.
6. **Supabase SSR**: `createClient()` -> `auth.getUser()` immediately. No logic in between.
7. **Type Safety**: No `any`, no `!`, no unsafe `as`. This project uses ts-strictest.
8. **Path Aliases**: Always use `~/` (e.g., `~/lib/utils`).
9. **Preflight**: Must run `pnpm run preflight` before commit.
10. **Code Cleanliness**: Follow Rule of Three. DRY up code only after 3rd duplication.
11. **E2E Interaction Coverage**: If you add a clickable UI element, you must click it in an E2E test.
12. **Email Privacy**: User email addresses must NEVER be displayed outside of admin views and the user's own settings page. Use names, "Anonymous", or role labels instead. This applies to UI, seed data, timeline events, and any client-facing serialization.
13. **Permissions Matrix Accuracy**: The permissions matrix (`matrix.ts`) must match actual server action enforcement. The help page auto-generates from the matrix — if it drifts, users see wrong information. Update both when changing auth logic.
14. **Matrix-Only Permissions**: All permission checks MUST use `checkPermission()` from the matrix system (`~/lib/permissions/helpers`). No standalone permission functions outside `src/lib/permissions/`. The help page auto-generates from the matrix — if enforcement diverges, users see wrong information.
15. **Process Safety**: NEVER kill processes system-wide. Do NOT run `pkill`, `killall`, use `kill` with PIDs obtained from broad selectors like `pgrep`, run `supabase stop --all`, or use any command that terminates services beyond your current worktree. Only stop services you explicitly started in your current session. Violating this destroys other agents' environments and the user's running work.
16. **Two-Layer Responsive Framework**: Viewport breakpoints (`md:`, `lg:`) for page structure (show/hide sections, grid columns). Container queries (`@lg:`, `@xl:`) for component internals (flex direction, padding, column count). Never mix both for the same layout decision. No `window.innerWidth`, `useMediaQuery`, or `matchMedia` — use CSS. `sm:` is padding/spacing only. The sole documented exception is `use-table-responsive-columns` for IssueList (PP-rs9).

## 3. Agent Skills (Progressive Disclosure)

**YOU MUST LOAD RELEVANT SKILLS FOR EVERY TASK.**
If your tool does not support skills, read the file path directly.

| Category       | Skill Name                       | Path                                                    | When to Use                                                                                   |
| :------------- | :------------------------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| **UI**         | `pinpoint-ui`                    | `.agent/skills/pinpoint-ui/SKILL.md`                    | Components, shadcn/ui, forms, responsive design.                                              |
| **UI**         | `pinpoint-design-bible`          | `.agent/skills/pinpoint-design-bible/SKILL.md`          | Design system rules, page archetypes, spacing, surfaces. Use for any new UI work.             |
| **TypeScript** | `pinpoint-typescript`            | `.agent/skills/pinpoint-typescript/SKILL.md`            | Type errors, generics, strict mode, Drizzle types.                                            |
| **Testing**    | `pinpoint-testing`               | `.agent/skills/pinpoint-testing/SKILL.md`               | Writing tests, PGlite setup, Playwright.                                                      |
| **Testing**    | `pinpoint-e2e`                   | `.agent/skills/pinpoint-e2e/SKILL.md`                   | E2E tests, worker isolation, stability patterns.                                              |
| **Security**   | `pinpoint-security`              | `.agent/skills/pinpoint-security/SKILL.md`              | Auth flows, CSP, Zod validation, Supabase SSR.                                                |
| **Patterns**   | `pinpoint-patterns`              | `.agent/skills/pinpoint-patterns/SKILL.md`              | Server Actions, architecture, data fetching.                                                  |
| **Workflow**   | `pinpoint-briefing`              | `.agent/skills/pinpoint-briefing/SKILL.md`              | Session start health review: Sentry, PRs, main CI, new issues, audit, beads triage.           |
| **Workflow**   | `pinpoint-commit`                | `.agent/skills/pinpoint-commit/SKILL.md`                | Intelligent commit-to-PR workflow and CI monitoring.                                          |
| **Workflow**   | `pinpoint-ready-to-review`       | `.agent/skills/pinpoint-ready-to-review/SKILL.md`       | CI green + Copilot comments addressed + label applied. Use standalone when PR already exists. |
| **Workflow**   | `pinpoint-github-monitor`        | `.agent/skills/pinpoint-github-monitor/SKILL.md`        | Monitoring GitHub Actions and build status.                                                   |
| **Workflow**   | `pinpoint-orchestrator`          | `.agent/skills/pinpoint-orchestrator/SKILL.md`          | Parallel subagent work in worktrees (background agents or Claude Teams).                      |
| **Workflow**   | `pinpoint-dispatch-e2e-teammate` | `.agent/skills/pinpoint-dispatch-e2e-teammate/SKILL.md` | Dispatching a teammate end-to-end (worktree + contract + prompt).                             |
| **Workflow**   | `pinpoint-teammate-guide`        | `.agent/skills/pinpoint-teammate-guide/SKILL.md`        | For dispatched teammates: environment, contract, Copilot loop, CI.                            |

## 4. Environment & Workflow

### ⛔ SYSTEM PROCESS SAFETY — READ BEFORE TOUCHING ANY SERVICE

> **NEVER terminate processes system-wide. This is an absolute rule. No exceptions unless Tim gives explicit written permission in the current session.**
>
> **FORBIDDEN without explicit permission:**
>
> - `supabase stop --all` — kills ALL Supabase instances across every worktree
> - `pkill node`, `killall node`, `pkill next`, `pkill -f next` — kills ALL Next.js servers system-wide
> - `pkill postgres`, `killall postgres` — kills ALL database connections system-wide
> - Any `kill`/`pkill`/`killall` targeting a process name or category rather than a specific PID you started
> - Any `docker stop`/`docker rm` on containers you did not start in this session
>
> **WHY**: This system runs multiple simultaneous environments (main + secondary + review + AntiGravity + ephemeral worktrees). Killing "all Supabase" or "all node" destroys every other running environment and the user's active work.
>
> **ALLOWED**: Stop only the specific service you started, identified by its specific PID or by running the worktree-local stop command (e.g., run `supabase stop` from within the current worktree directory to stop only that environment's Supabase instance). When in doubt — DO NOT stop it. Ask first.

### Worktrees & Ports

We use git worktrees for parallel environments. There are two types:

**Static Worktrees** (4 permanent environments with fixed ports):

| Worktree    | Next.js | Supabase API | Postgres | Purpose                   |
| :---------- | :------ | :----------- | :------- | :------------------------ |
| Main (root) | 3000    | 54321        | 54322    | Primary development       |
| Secondary   | 3100    | 55321        | 55322    | Parallel feature work     |
| Review      | 3200    | 56321        | 56322    | PR reviews                |
| AntiGravity | 3300    | 57321        | 57322    | Experimental/long-running |

**Ephemeral Worktrees** (on-demand, port offsets 4000-9900 → Next.js 3400-3990, API 58321-63821):

Created with `./pinpoint-wt.py` for quick PR reviews or parallel development. Ports are hash-allocated to avoid conflicts.

**Worktree Path Resolution**: Branch slashes are replaced with dashes in directory names (flat naming). Branch `feat/my-feature` creates directory `pinpoint-worktrees/feat-my-feature`. Example: branch `feat/f3r-rename-env-vars` lives at `/home/froeht/Code/pinpoint-worktrees/feat-f3r-rename-env-vars`. The `remove` command has a fallback for old nested paths (`pinpoint-worktrees/feat/f3r-rename-env-vars`).

**Commands**:

```bash
./pinpoint-wt.py create feat/my-feature   # Create ephemeral worktree
./pinpoint-wt.py list                     # Show all worktrees with ports
./pinpoint-wt.py sync [--all]             # Regenerate config files
./pinpoint-wt.py remove feat/my-feature   # Clean teardown (Supabase + Docker + worktree)
```

**Config Management**:

- `supabase/config.toml` and `.env.local` are auto-generated from templates
- Generated files are **read-only** (chmod 444) with warning headers
- To modify: Edit templates, then run `./pinpoint-wt.py sync`

**Troubleshooting**:

- _Config Mismatch_: Run `./pinpoint-wt.py sync` to regenerate
- _Supabase Failures_: Run `supabase stop` (current worktree only — never `--all`) then restart
- _Template Changes_: Edit `supabase/config.toml.template`, then `./pinpoint-wt.py sync --all`

### Branch Management

**Creating branches** - Ensure proper remote tracking:

- `git checkout -b feature/name` then `git push -u origin feature/name`
- **NOT**: `git checkout -b feature/name origin/main` (tracks main, not your branch)
- Verify: `git branch -vv` shows `[origin/feature/name]`, not `[origin/main]`

**Why**: Proper tracking enables `git pull`/`git push` without arguments and prevents accidentally
pushing to main.

**Syncing with main** - Always merge, never rebase:

- `git fetch origin && git merge origin/main` (preferred)
- **NOT**: `git rebase origin/main` (rewrites history, causes issues with worktrees and PRs)

**Why**: Merge commits preserve history and work cleanly with git worktrees. Rebasing can cause
conflicts across worktrees and force-push requirements on open PRs.

### Commit Safety

- **NEVER use `--no-verify`** without explicit user permission
- This flag bypasses pre-commit hooks (lint, format, type checks)
- Only use when user explicitly requests it
- Never add `gh pr merge` or broad wildcard tool patterns without explicit user approval.

### CI Workflow

- When investigating CI failures, check for merge conflicts FIRST:
  `gh pr view <PR> --json mergeable`. A dirty mergeable state blocks all CI.
- Never push directly to protected branches (main). Always use a feature branch.
- After code changes, run `pnpm run preflight` before considering work complete.
  For trivial changes (comments, docs), `pnpm run check` is sufficient.
- **Required checks for merge**: Only `CI Gate` is required by the GitHub ruleset (ruleset `6326455`). Vercel is NOT a required check. `mergeStateStatus: BLOCKED` while E2E tests are still running is normal — it unblocks automatically once `CI Gate` passes.
- **Vercel preview migrations**: Preview deployments skip `migrate:production` entirely (exit 0). The Supabase integration triggers a redeployment with branch DB credentials, but that DB user lacks `CREATE SCHEMA` privileges. Migrations are handled by the GHA "Supabase Branch Setup" workflow instead. Production deployments still run migrations normally.

### Key Commands

- `pnpm run check` (**RUN OFTEN**): Fast check (types, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck). ~12s.
- `pnpm run preflight`: Full suite (check + build + integration). **Run before commit.**
- `pnpm run db:migrate`: Apply schema changes locally.
- `pnpm run db:backup`: Manual production data dump to `~/.pinpoint/db-backups` (verifies Supabase CLI link matches expected production project).
- `pnpm run db:seed:from-prod`: Reset local DB and seed from the latest production backup.
- `pnpm run e2e:full`: Full E2E suite (Don't run Safari locally on Linux).
- `ruff check <file> && ruff format <file>`: Lint and format Python files (`pinpoint-wt.py`, scripts). Ruff is installed globally — no venv needed.
- `./scripts/workflow/monitor-gh-actions.sh <PR>`: Watch GitHub Actions CI for a PR. **Always use this — never write a manual polling loop.**

### Which Tests to Run (Decision Tree)

1. **Changed pure logic/utils?** → `pnpm run check` (unit tests, ~12s)
2. **Changed a single E2E-relevant file?** → `pnpm exec playwright test e2e/path/to/file.spec.ts --project=chromium` (~15-30s, replace with your spec path)
3. **Changed UI components/forms?** → `pnpm run smoke` (~60s)
4. **Changed auth/permissions/middleware?** → `pnpm run smoke` + targeted full specs
5. **Changed DB schema/migrations?** → `pnpm run preflight` (full suite)
6. **NEVER** run `e2e:full` locally unless explicitly asked — that's what CI is for

**Key rules for agents:**

- Always use `--project=chromium` for targeted runs (skip Mobile Chrome unless testing responsive)
- Use `--headed` for debugging visual issues
- `pnpm run check` catches 90% of issues — E2E is for integration verification, not iteration
- If a test is flaky locally, report it — don't retry in a loop

### Testing After Refactors

- After any refactor, verify that test mocks reflect the new code structure
  (transaction wrappers, changed defaults, new parameters).
- Update test fixtures and seed data proactively rather than waiting for CI to fail.

### Safe Command Patterns

- **Search**: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files | grep "\.js$"`

### Deployment Infrastructure

- **Vercel Migrations**: Automatically runs `pnpm run migrate:production` on build.
  - _Fix Stuck Migration_: `POSTGRES_URL=<prod_url> tsx scripts/mark-migration-applied.ts <migration_number>`
- **Supabase Projects**:
  - `pinpoint-prod` (Live, Pro plan) - **Real user data. STRICT SAFETY.** Daily backups with 7-day retention.
  - Preview branches are auto-created per PR via Supabase GitHub integration.
- **Preview Deployments (Supabase Branching)**:
  - Every PR gets an isolated Supabase branch database (auto-created, auto-deleted on PR close).
  - The `Supabase Branch Setup` GHA workflow runs Drizzle migrations + seeding on each branch.
  - Vercel preview deployments connect to branch DBs via the Supabase Vercel integration.
  - Env var fallbacks in `server.ts`/`middleware.ts` handle both PinPoint and integration naming conventions.
  - Cost: ~$0.32/day per open PR (Micro instance at $0.01344/hr).
- **Database Safety**:
  - Local: `db:reset` allowed.
  - Prod: **NEVER** `db:reset`. ONLY `db:migrate`.
- **Connection Requirements**:
  - **Session Pooler (IPv4)**: Use `POSTGRES_URL` (port `:6543`) for external connections. The `POSTGRES_URL_NON_POOLING` (port `:5432`) uses IPv6 which may be unreachable from some environments.
  - Format: `postgresql://postgres.[project-ref]:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres`

### Migration Conflict Resolution

**CRITICAL RULE: NEVER MANUALLY RESOLVE `drizzle/meta` CONFLICTS.**
The `drizzle/meta` folder contains binary-like snapshots of the schema. Manual resolution (e.g., accepting "both" or editing JSON files) leads to corruption and snapshot collisions.

**Protocol: If `drizzle/meta` conflicts on merge/pull:**

1.  **Accept Incoming**: Take the upstream version of `drizzle/meta` (theirs).
2.  **Delete Local**: Delete your local migration files (`.sql` and `snapshot.json`).
3.  **Regenerate**: Run `pnpm db:generate`. Drizzle will create a fresh migration on top of the new upstream state.

**Why this works**: Drizzle regenerates consistent meta files (prevId chain, journal idx).
Eliminates manual JSON surgery and uncertainty.

**Snapshot Verification**:
Before merging any PR involving migrations, ensure that:

1.  Every new `.sql` file has a corresponding `_snapshot.json` in `drizzle/meta`.
2.  `pnpm db:generate` runs locally without error (outputs "No schema changes").

When merging branches with competing migrations (both created same number):

**Regeneration Protocol** (Standard):

1. **Accept incoming** (main's migrations) - Keep main's SQL and meta files
2. **Delete your migration files** - Remove conflicted `000N_*.sql` and `drizzle/meta/000N_snapshot.json`
3. **Resolve schema.ts** - Manually merge both sets of changes
4. **Regenerate**: `pnpm db:generate` creates fresh migration with correct number
5. **Verify SQL** - Compare new SQL to deleted SQL, confirm intent preserved
6. **Test**: `pnpm db:reset` to rebuild from scratch

### GitHub Copilot Reviews

**Workflow for each comment:**

1. Read unresolved comments via `./scripts/workflow/copilot-comments.sh <PR>`
2. Fix the code, or decide to decline with justification
3. **Applied suggestions**: Copilot auto-resolves the thread when it detects your fix commit — no action needed
4. **Declined suggestions**: reply and resolve manually:

```bash
./scripts/workflow/respond-to-copilot.sh <PR> "<path>:<line>" "Ignored: <why this is wrong/unnecessary>. —Claude"
```

Sign replies with your agent name (`—Gemini`, `—Antigravity`, `—Claude`, `—Codex`, etc.).

**Scripts:**

```bash
./scripts/workflow/copilot-comments.sh <PR>              # Show UNRESOLVED comments only
./scripts/workflow/copilot-comments.sh <PR> --all         # Include resolved
./scripts/workflow/respond-to-copilot.sh <PR> <path:line> <msg>  # Reply + resolve one thread
```

**Rules:**

- Declined comments must get a reply explaining why — no silent ignores
- Keep replies to one sentence
- If Copilot is wrong, say why (helps future reviews)

### Parallel Subagent Workflow

For multiple independent tasks, use worktree-isolated subagents.

**Primary**: Standalone subagents with `isolation: "worktree"` + `run_in_background: true`. Use `resume` for follow-up (Copilot comments, CI fixes). The `WorktreeCreate` hook delegates to `pinpoint-wt.py` for port allocation and Supabase config.

**Fallback**: Agent Teams for bidirectional real-time communication. Note: `isolation: "worktree"` is broken when `team_name` is set — teammates land in the lead's repo. Create worktrees manually with `pinpoint-wt.py`.

**Quality Enforcement**:

- **Standalone subagents**: Self-enforced via prompt instructions (`pnpm run check` before returning). Hooks don't fire.
- **Agent Teams**: `TaskCompleted` hook runs `pnpm run check`; `TeammateIdle` hook blocks unpushed commits. Requires `isolation: "worktree"` for correct CWD (broken — see above).

**Anti-patterns**:

- DON'T use Agent Teams as default — standalone subagents have working worktree isolation
- DON'T forget to check Copilot comments before merging

See `pinpoint-orchestrator` skill for the full workflow.

## 5. Documentation Philosophy

- Actionable information only - focus on "what" and "how", not "why"
- Designed for efficient LLM consumption
- Skills provide deep dives on-demand

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

> **Note**: The `TeammateIdle` hook now enforces push-before-idle automatically for teammates.
> The manual checklist below applies to the lead agent and solo sessions.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Update issue status** - Close finished work, update in-progress items
3. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
4. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
