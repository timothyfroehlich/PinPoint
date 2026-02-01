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

## 3. Agent Skills (Progressive Disclosure)

**YOU MUST LOAD RELEVANT SKILLS FOR EVERY TASK.**
If your tool does not support skills, read the file path directly.

| Category       | Skill Name            | Path                                         | When to Use                                          |
| :------------- | :-------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **UI**         | `pinpoint-ui`         | `.agent/skills/pinpoint-ui/SKILL.md`         | Components, shadcn/ui, forms, responsive design.     |
| **TypeScript** | `pinpoint-typescript` | `.agent/skills/pinpoint-typescript/SKILL.md` | Type errors, generics, strict mode, Drizzle types.   |
| **Testing**    | `pinpoint-testing`    | `.agent/skills/pinpoint-testing/SKILL.md`    | Writing tests, PGlite setup, Playwright.             |
| **Testing**    | `pinpoint-e2e`        | `.agent/skills/pinpoint-e2e/SKILL.md`        | E2E tests, worker isolation, stability patterns.     |
| **Security**   | `pinpoint-security`   | `.agent/skills/pinpoint-security/SKILL.md`   | Auth flows, CSP, Zod validation, Supabase SSR.       |
| **Patterns**   | `pinpoint-patterns`   | `.agent/skills/pinpoint-patterns/SKILL.md`   | Server Actions, architecture, data fetching.         |
| **Workflow**   | `pinpoint-commit`     | `.agent/skills/pinpoint-commit/SKILL.md`     | Intelligent commit-to-PR workflow and CI monitoring. |
| **Workflow**   | `github-monitor`      | `.agent/skills/github-monitor/SKILL.md`      | Monitoring GitHub Actions and build status.          |

## 4. Environment & Workflow

### Worktrees & Ports

We use git worktrees for parallel environments. Config is managed via templates to prevent local leaks.

**Workflow**:

1. Run `python3 scripts/sync_worktrees.py` to generate `supabase/config.toml` and `.env.local` from templates.
2. `supabase/config.toml` is ignored by git; do not track it.

**Troubleshooting**:

- _Config Mismatch_: If ports don't match the table below, re-run `python3 scripts/sync_worktrees.py`.
- _Supabase Failures_: Run `supabase stop --all` then re-run the sync script.
- _Template Changes_: If you need to change shared config, edit `supabase/config.toml.template` in the project root.

| Worktree    | Next.js | Supabase API | Postgres |
| :---------- | :------ | :----------- | :------- |
| Main        | 3000    | 54321        | 54322    |
| Secondary   | 3100    | 55321        | 55322    |
| Review      | 3200    | 56321        | 56322    |
| AntiGravity | 3300    | 57321        | 57322    |

### Branch Management

**Creating branches** - Ensure proper remote tracking:

- `git checkout -b feature/name` then `git push -u origin feature/name`
- **NOT**: `git checkout -b feature/name origin/main` (tracks main, not your branch)
- Verify: `git branch -vv` shows `[origin/feature/name]`, not `[origin/main]`

**Why**: Proper tracking enables `git pull`/`git push` without arguments and prevents accidentally
pushing to main.

### Commit Safety

- **NEVER use `--no-verify`** without explicit user permission
- This flag bypasses pre-commit hooks (lint, format, type checks)
- Only use when user explicitly requests it

### Key Commands

- `pnpm run check` (**RUN OFTEN**): Fast check (types, lint, format, unit tests). ~5s.
- `pnpm run preflight`: Full suite (check + build + integration). **Run before commit.**
- `pnpm run db:migrate`: Apply schema changes locally.
- `pnpm run db:backup`: Manual production data dump to `~/.pinpoint/db-backups` (verifies Supabase CLI link matches expected production project).
- `pnpm run db:seed:from-prod`: Reset local DB and seed from the latest production backup.
- `pnpm run e2e:full`: Full E2E suite (Don't run Safari locally on Linux).

### Safe Command Patterns

- **Search**: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **Discovery**: `fd "*.js"`, `fd --type f --changed-within 1day`
- **Repository**: `git ls-files | grep "\.js$"`

### Deployment Infrastructure

- **Vercel Migrations**: Automatically runs `pnpm run migrate:production` on build.
  - _Fix Stuck Migration_: `DATABASE_URL=<prod_url> tsx scripts/mark-migration-applied.ts <migration_number>`
- **Supabase Projects**:
  - `pinpoint-preview` (Dev/Staging) - Disposable data.
  - `pinpoint-prod` (Live) - **Real user data. STRICT SAFETY.**
- **Database Safety**:
  - Local: `db:reset` allowed.
  - Prod: **NEVER** `db:reset`. ONLY `db:migrate`.
- **Connection Requirements**:
  - **Session Pooler (IPv4)**: Use `DATABASE_URL` (port `:6543`) for external connections. The `DIRECT_URL` (port `:5432`) uses IPv6 which may be unreachable from some environments.
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

Fetch all comments (including hidden ones):

```bash
gh api graphql -f query='{ repository(owner: "timothyfroehlich", name: "PinPoint") { pullRequest(number: <PR_NUMBER>) { reviews(last: 5) { nodes { author { login } state comments(first: 20) { nodes { path line body } } } } } } }'
```

## 5. Current Priorities (MVP+ Polish)

**Status**: Soft-launched. Active users.

1.  **Critical Fixes**:
    - Fix Password Reset in Prod (Issue #792).
    - Security: Fix Host Header Injection in Auth (PR #781).
2.  **Feature Development**:
    - **Search & Filtering**: Build out search pane (`feature/issue-filter-search`).
    - **Photo Uploads**: Attach photos to issues/machines.
3.  **UI Polish**:
    - Redesign Issue Status/Priority Dropdowns (#744).
    - Pagination for Issue List (#752).
    - Highlight machine owners (#753).
    - Refactor MainLayout Header (#693).
4.  **Code Hygiene**:
    - Delete CHANGELOG.md and references (#776).
    - General DRY/refactoring.

## 6. Documentation Philosophy

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
