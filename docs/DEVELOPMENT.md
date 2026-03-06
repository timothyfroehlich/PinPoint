# Development Guide

This guide covers the development workflow, tools, and best practices for contributing to PinPoint.

For full project rules and constraints, **always start with `AGENTS.md`**.
This file is a shorter, hands-on reference for day‑to‑day development.

## What PinPoint Is (Developer View)

- Single‑tenant issue tracker for the **Austin Pinball Collective**
- Focus: Fast issue reporting per machine, clear dashboards for operators
- Core entities: **Machines**, **Issues**, **Comments**, **Notifications**

If you’re trying to understand what the product should do, read:

- `docs/PRODUCT_SPEC.md`
- `docs/TECH_SPEC.md`

If you’re trying to understand how to implement something, read:

- `AGENTS.md`
- `docs/NON_NEGOTIABLES.md`
- `docs/PATTERNS.md`

## Quickstart for Development

1. **Create a Branch**

   ```bash
   git checkout -b feat/my-change
   ```

2. **Install & Configure**

   ```bash
   pnpm install
   python3 scripts/sync_worktrees.py
   ```

   This generates `supabase/config.toml` and `.env.local` from templates. These files are ignored by git to keep your local environment clean.

3. **Start Dev Server**

   ```bash
   pnpm run dev    # automatically ensures Supabase is running
   ```

4. **Run Fast Checks While Iterating**

   ```bash
   pnpm run check      # typecheck + lint + unit tests
   ```

5. **Before Pushing**

   ```bash
   pnpm run preflight  # full gate: typecheck, lint, format, tests, build, int tests, smoke
   ```

## Testing Overview

PinPoint uses the following test types (see `docs/TESTING_PLAN.md` for details):

- **Unit Tests** (`pnpm test`)
  - Location: `src/test/unit/**`
  - What: Pure logic, utilities, validation
- **Integration Tests (PGlite)** (`pnpm test`)
  - Location: `src/test/integration/**`
  - What: Database queries, Server Actions (using worker‑scoped PGlite)
- **Supabase Integration Tests** (`pnpm run test:integration`)
  - Location: `src/test/integration/supabase/**`
  - What: Real Supabase interactions (requires `supabase start`)
- **E2E Tests (Playwright)** (`pnpm run smoke`)
  - Location: `e2e/**`
  - What: Critical user flows only

Useful commands:

```bash
pnpm test                      # Unit + PGlite integration
pnpm run test:integration      # Supabase-backed integration tests
pnpm run smoke                 # Playwright smoke suite
pnpm run test:watch            # Watch mode for unit tests
pnpm run test:coverage         # Coverage for unit tests
```

## Component Creation

We use **shadcn/ui** for our component library.

To add a new component:

```bash
pnpm exec shadcn@latest add [component-name]
```

Example: `pnpm exec shadcn@latest add button`

This will install the component source code into `src/components/ui`. You can then customize it as needed.

## Database Management

We use **Supabase** (PostgreSQL) and **Drizzle ORM**.

### Local Development

- **Apply Schema Changes (Day-to-Day)**

  After editing `src/server/db/schema.ts`, generate a migration and apply it. This is the **preferred** way to update your schema without losing local data.

  ```bash
  # 1. Generate a migration
  pnpm run db:generate -- --name <change-name>

  # 2. Apply migrations to your local database
  pnpm run db:migrate

  # 3. Regenerate test schema for PGlite
  pnpm run test:_generate-schema
  ```

- **Reset & Seed Database (Destructive)**

  If your local environment is out of sync or you want a clean slate, use the reset command. **Warning: This wipes all application data.**

  ```bash
  pnpm run db:reset
  ```

  This will:
  - Restart Supabase
  - Drop application tables
  - Apply all Drizzle migrations from scratch
  - Regenerate the test schema
  - Seed data and users

- **View Database**:
  ```bash
  pnpm run db:studio
  ```
  Opens Drizzle Studio to view and edit data.

### Production & Preview Updates

For preview and production, we use **Automated Migrations** via Vercel build hooks.

1. **Local Development**:
   - Edit `src/server/db/schema.ts`
   - Generate a migration locally: `pnpm run db:generate -- --name <change-name>`
   - Commit the resulting `drizzle/` files

2. **Automated Deployment**:
   - **Production deploys** run `pnpm run migrate:production` via the `vercel-build` script before building.
   - **Preview deploys** skip `migrate:production` in Vercel because preview branch DBs are migrated/seeded by `.github/workflows/supabase-branch-setup.yaml`.
   - Requires `POSTGRES_URL` (or `POSTGRES_URL_NON_POOLING`) in Vercel for production migration runs.

3. **Migration State Mismatch (Troubleshooting)**:

   If a migration fails with "relation does not exist" or similar errors, it usually means a migration was manually applied but not tracked in Drizzle's migration table.

   **To fix:**

   ```bash
   # 1. Identify the failed migration number from Vercel build logs
   # 2. Mark it as applied (replace 0001 with actual migration number):
   POSTGRES_URL=<production-url> tsx scripts/mark-migration-applied.ts 0001

   # 3. Trigger a redeployment (push a trivial change or use Vercel UI)
   ```

   **Prevention:** Always use the automated migration system. Avoid manually running migrations in production/preview unless absolutely necessary.

## Troubleshooting

### Supabase Connection Issues

- **Error**: `P0001: Connection refused`
- **Fix**: Ensure your IP is allowed in Supabase Project Settings > Database > Network Restrictions. For local dev, ensure you have the correct connection string in `.env.local`.

### Type Errors

- **Error**: `Type 'string | null' is not assignable to type 'string'`
- **Fix**: We use strict TypeScript. Ensure you handle null/undefined cases. Use Zod for runtime validation to narrow types.

### Test Setup

- **Issue**: Tests failing with database errors.
- **Fix**: Ensure you are not sharing database state between tests. Our test setup uses `pglite` with a fresh instance for each test worker to ensure isolation.

## Quality Gates

Before merging a PR, the following checks must pass:

- `pnpm run typecheck`: No TypeScript errors.
- `pnpm run lint`: No ESLint errors.
- `pnpm run format`: Code is formatted with Prettier.
- `pnpm test`: All unit and integration tests pass.
- `pnpm run smoke`: Critical E2E flows pass.
