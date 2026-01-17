# PinPoint Agent Context

## 1. User & Mission

**User**: Tim (GitHub: timothyfroehlich)
**Goal**: Vibecoding PinPoint (Pinball Issue Tracker) for Austin Pinball Collective.
**Phase**: Soft-launched (Beta). Active users. Working on MVP+ Polish.
**Style**: Explain pros/cons. Teach, don't just fix.
**Constraint**: PR reviews are AI-generated; apply critical thinking.

## 2. Critical Non-Negotiables (The "10 Commandments")

1. **Escape parentheses** in paths (e.g., `src/app/\(app\)/page.tsx`).
2. **Migrations ONLY**: Never use `drizzle-kit push`. Use `db:generate` + `db:migrate`.
3. **Worker-Scoped PGlite**: No per-test DB instances (causes lockups). Use shared worker.
4. **Server Components Default**: "use client" only for interaction leaves.
5. **Progressive Enhancement**: `<form action={serverAction}>`. No inline handlers.
6. **Supabase SSR**: `createClient()` -> `auth.getUser()` immediately. No logic in between.
7. **Type Safety**: No `any`, no `!`, no unsafe `as`. This project uses ts-strictest.
8. **Path Aliases**: Always use `~/` (e.g., `~/lib/utils`).
9. **Preflight**: Must run `pnpm run preflight` before commit.
10. **Code Cleanliness**: Follow Rule of Three. DRY up code only after 3rd duplication.

## 3. Agent Skills (Progressive Disclosure)

**YOU MUST LOAD RELEVANT SKILLS FOR EVERY TASK.**
If your tool does not support skills, read the file path directly.

| Category       | Skill Name            | Path                                          | When to Use                                        |
| :------------- | :-------------------- | :-------------------------------------------- | :------------------------------------------------- |
| **UI**         | `pinpoint-ui`         | `.gemini/skills/pinpoint-ui/SKILL.md`         | Components, shadcn/ui, forms, responsive design.   |
| **TypeScript** | `pinpoint-typescript` | `.gemini/skills/pinpoint-typescript/SKILL.md` | Type errors, generics, strict mode, Drizzle types. |
| **Testing**    | `pinpoint-testing`    | `.gemini/skills/pinpoint-testing/SKILL.md`    | Writing tests, PGlite setup, Playwright.           |
| **Security**   | `pinpoint-security`   | `.gemini/skills/pinpoint-security/SKILL.md`   | Auth flows, CSP, Zod validation, Supabase SSR.     |
| **Patterns**   | `pinpoint-patterns`   | `.gemini/skills/pinpoint-patterns/SKILL.md`   | Server Actions, architecture, data fetching.       |

## 4. Environment & Workflow

### Worktrees & Ports

We use git worktrees for parallel environments. Run `python3 scripts/sync_worktrees.py` to sync config.

| Worktree    | Next.js | Supabase API | Postgres |
| :---------- | :------ | :----------- | :------- |
| Main        | 3000    | 54321        | 54322    |
| Secondary   | 3100    | 55321        | 55322    |
| Review      | 3200    | 56321        | 56322    |
| AntiGravity | 3300    | 57321        | 57322    |

### Key Commands

- `pnpm run check` (**RUN OFTEN**): Fast check (types, lint, format, unit tests). ~5s.
- `pnpm run preflight`: Full suite (check + build + integration). **Run before commit.**
- `pnpm run db:migrate`: Apply schema changes locally.
- `pnpm run db:backup`: Manual production data dump to `~/.pinpoint/db-backups` (verifies Supabase CLI link matches expected production project).
- `pnpm run db:seed:from-prod`: Reset local DB and seed from the latest production backup.
- `pnpm run test:e2e`: Full E2E suite (Don't run Safari locally on Linux).

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
