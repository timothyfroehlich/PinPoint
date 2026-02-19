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

## 3. Agent Skills (Progressive Disclosure)

**YOU MUST LOAD RELEVANT SKILLS FOR EVERY TASK.**
If your tool does not support skills, read the file path directly.

| Category       | Skill Name              | Path                                            | When to Use                                                              |
| :------------- | :---------------------- | :---------------------------------------------- | :----------------------------------------------------------------------- |
| **UI**         | `pinpoint-ui`           | `.agent/skills/pinpoint-ui/SKILL.md`            | Components, shadcn/ui, forms, responsive design.                         |
| **TypeScript** | `pinpoint-typescript`   | `.agent/skills/pinpoint-typescript/SKILL.md`    | Type errors, generics, strict mode, Drizzle types.                       |
| **Testing**    | `pinpoint-testing`      | `.agent/skills/pinpoint-testing/SKILL.md`       | Writing tests, PGlite setup, Playwright.                                 |
| **Testing**    | `pinpoint-e2e`          | `.agent/skills/pinpoint-e2e/SKILL.md`           | E2E tests, worker isolation, stability patterns.                         |
| **Security**   | `pinpoint-security`     | `.agent/skills/pinpoint-security/SKILL.md`      | Auth flows, CSP, Zod validation, Supabase SSR.                           |
| **Patterns**   | `pinpoint-patterns`     | `.agent/skills/pinpoint-patterns/SKILL.md`      | Server Actions, architecture, data fetching.                             |
| **Workflow**   | `pinpoint-commit`       | `.agent/skills/pinpoint-commit/SKILL.md`        | Intelligent commit-to-PR workflow and CI monitoring.                     |
| **Workflow**   | `github-monitor`        | `.agent/skills/github-monitor/SKILL.md`         | Monitoring GitHub Actions and build status.                              |
| **Workflow**   | `pinpoint-orchestrator` | `.claude/skills/pinpoint-orchestrator/SKILL.md` | Parallel subagent work in worktrees (background agents or Claude Teams). |

## 4. Environment & Workflow

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
- _Supabase Failures_: Run `supabase stop --all` then restart
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

### Key Commands

- `pnpm run check` (**RUN OFTEN**): Fast check (types, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck). ~12s.
- `pnpm run preflight`: Full suite (check + build + integration). **Run before commit.**
- `pnpm run db:migrate`: Apply schema changes locally.
- `pnpm run db:backup`: Manual production data dump to `~/.pinpoint/db-backups` (verifies Supabase CLI link matches expected production project).
- `pnpm run db:seed:from-prod`: Reset local DB and seed from the latest production backup.
- `pnpm run e2e:full`: Full E2E suite (Don't run Safari locally on Linux).
- `ruff check <file> && ruff format <file>`: Lint and format Python files (`pinpoint-wt.py`, scripts). Ruff is installed globally — no venv needed.

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

When merging branches with competing migrations (both created same number):

**Regeneration Protocol** (Standard):

1. **Accept incoming** (main's migrations) - Keep main's SQL and meta files
2. **Delete your migration files** - Remove conflicted `000N_*.sql` and `drizzle/meta/000N_snapshot.json`
3. **Resolve schema.ts** - Manually merge both sets of changes
4. **Regenerate**: `pnpm db:generate` creates fresh migration with correct number
5. **Verify SQL** - Compare new SQL to deleted SQL, confirm intent preserved
6. **Test**: `pnpm db:reset` to rebuild from scratch

**Why this works**: Drizzle regenerates consistent meta files (prevId chain, journal idx).
Eliminates manual JSON surgery and uncertainty.

### GitHub Copilot Reviews

**MANDATORY**: When addressing Copilot review comments on a PR, you MUST resolve each thread as you go.

**Workflow for each comment:**

1. Read the comment via `bash scripts/workflow/copilot-comments.sh <PR>`
2. Fix the code (or decide to ignore with justification)
3. Reply and resolve the thread:

```bash
bash scripts/workflow/respond-to-copilot.sh <PR> "<path>:<line>" "Fixed: <what you did>. —Claude"
bash scripts/workflow/respond-to-copilot.sh <PR> "<path>:<line>" "Ignored: <why this is wrong/unnecessary>. —Claude"
```

Sign replies with your agent name (`—Claude`, `—Codex`, etc.).

**Scripts:**

```bash
bash scripts/workflow/copilot-comments.sh <PR>              # Show UNRESOLVED comments only
bash scripts/workflow/copilot-comments.sh <PR> --all         # Include resolved
bash scripts/workflow/resolve-copilot-threads.sh <PR>        # Bulk-resolve addressed threads
bash scripts/workflow/respond-to-copilot.sh <PR> <path:line> <msg>  # Reply + resolve one thread
```

**Rules:**

- Every Copilot comment gets a reply — no silent fixes or silent ignores
- Keep replies to one sentence
- If Copilot is wrong, say why (helps future reviews)
- Resolve threads immediately after replying, not in bulk at the end

### Parallel Subagent Workflow

For multiple independent tasks (UI fixes, Copilot feedback, parallel features), use worktree-isolated subagents.

**When to Use**:

- 2+ independent beads issues ready to work
- Copilot review feedback on multiple PRs
- Parallel feature development

**Permission Requirements**:
Worktree permissions must be in `.claude/settings.json`:

```json
"Read(//home/froeht/Code/pinpoint-worktrees/**)",
"Glob(//home/froeht/Code/pinpoint-worktrees/**)",
"Edit(//home/froeht/Code/pinpoint-worktrees/**)",
"Write(//home/froeht/Code/pinpoint-worktrees/**)"
```

**Workflow**:

1. Create worktrees: `./pinpoint-wt.py create <branch>` for each task
2. Dispatch subagents with full worktree paths in prompts
3. Monitor: `gh pr checks`, Copilot comments
4. Clean up: `./pinpoint-wt.py remove <branch>`

**Critical**: Agent prompts must include the full worktree path and instruct agents to work ONLY in that path. Agents inherit the parent session's cwd - they will NOT cd into worktrees on their own.

**Anti-patterns**:

- DON'T spawn agents from parent dir with `cd /path/to/worktree` instructions
- DON'T assume agents will respect directory instructions without explicit paths
- DON'T forget to check Copilot comments before merging

See `pinpoint-orchestrator` skill for the full workflow.

## 5. Documentation Philosophy

- Actionable information only - focus on "what" and "how", not "why"
- Designed for efficient LLM consumption
- Skills provide deep dives on-demand

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
