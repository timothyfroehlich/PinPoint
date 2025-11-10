# Task 2: Database Schema

**Status**: ✅ COMPLETED
**Branch**: `claude/task-2-database-schema-011CUzdqayMkABeBFESMx23U`
**Dependencies**: Task 1 (Project Foundation)

## Objective

Drizzle ORM setup and complete schema definition with database trigger for auto-profile creation.

## Acceptance Criteria

- [x] ~~`npx drizzle-kit generate` works without errors~~ (Deferred - using `push` workflow for pre-beta)
- [x] Schema types are available for import
- [x] TypeScript compilation includes schema types
- [x] No TypeScript errors in schema file
- [x] Trigger script ready for deployment

## Tasks

### Drizzle ORM Setup

- [x] Install Drizzle (`npm install drizzle-orm`)
- [x] Install Drizzle Kit (`npm install -D drizzle-kit`)
- [x] Install PostgreSQL driver (`npm install postgres`)
- [x] Create `drizzle.config.ts`
- [x] Create `src/server/db/index.ts` (database instance)

### Database Schema

- [x] Create `src/server/db/schema.ts`
- [x] Define `user_profiles` table (NOT `users`)
  - id (uuid, primary key, references auth.users(id) ON DELETE CASCADE via seed.sql)
  - name (text, not null)
  - avatar_url (text)
  - role (text: 'guest' | 'member' | 'admin', default 'member')
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [x] Define `machines` table
  - id (uuid, primary key, default gen_random_uuid())
  - name (text, not null)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [x] Define `issues` table
  - id (uuid, primary key, default gen_random_uuid())
  - machine_id (uuid, not null, foreign key → machines.id ON DELETE CASCADE)
  - title (text, not null)
  - description (text)
  - status (text: 'new' | 'in_progress' | 'resolved', default 'new')
  - severity (text: 'minor' | 'playable' | 'unplayable', default 'playable')
  - reported_by (uuid, foreign key → user_profiles.id)
  - assigned_to (uuid, foreign key → user_profiles.id)
  - resolved_at (timestamp)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
  - CHECK constraint: `machine_id IS NOT NULL`
- [x] Define `issue_comments` table (NOT `comments`)
  - id (uuid, primary key, default gen_random_uuid())
  - issue_id (uuid, not null, foreign key → issues.id ON DELETE CASCADE)
  - author_id (uuid, foreign key → user_profiles.id)
  - content (text, not null)
  - is_system (boolean, default false) -- for timeline events
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [x] Add Drizzle relations definitions

### Database Trigger (Auto-Profile Creation)

- [x] Create `handle_new_user()` function
  - Auto-creates user_profiles record on signup
  - Copies name from Supabase auth.users metadata
  - Sets default role to 'member'
- [x] Create trigger on `auth.users` table
  - AFTER INSERT trigger
  - Executes handle_new_user() function
- [x] Document trigger in schema comments

### Package.json Scripts

- [x] Add package.json scripts:
  - [x] ~~`db:generate` - Generate Drizzle migrations~~ (Deferred to Task 11 docs)
  - [x] `db:push` - Push schema to database
  - [x] `db:studio` - Open Drizzle Studio

## Key Decisions

### 1. Supabase CLI Local Development

**Decision**: Use local Supabase via Docker (`supabase start`) instead of connecting to remote Supabase instance.
**Rationale**: Faster development iteration, no network latency, free tier limits avoided.

### 2. Database Trigger via seed.sql

**Decision**: Place `handle_new_user()` trigger in `supabase/seed.sql` instead of Drizzle migration.
**Rationale**:

- Runs automatically on `supabase db reset` (local development)
- Fits Supabase CLI workflow perfectly
- `CREATE OR REPLACE` is idempotent (safe to re-run)

### 3. Push Workflow Only (No Migrations)

**Decision**: Use `drizzle-kit push` for pre-beta, defer `generate` + `migrate` to production.
**Rationale**:

- Pre-beta has zero users, can blow away data anytime
- Faster iteration (no migration file management)
- Migration workflow documented in Task 11 for MVP launch

### 4. Cross-Schema Foreign Key Constraint

**Decision**: Handle `user_profiles.id → auth.users.id` FK constraint in `seed.sql`, not Drizzle schema.
**Rationale**:

- Drizzle doesn't support cross-schema references (public.user_profiles → auth.users)
- Added FK constraint manually via `ALTER TABLE` in seed.sql
- Documented in schema comments for clarity

### 5. TypeScript Strictest Config Compliance

**Decision**: Use bracket notation `process.env["DATABASE_URL"]` instead of dot notation.
**Rationale**:

- `@tsconfig/strictest` requires bracket notation for index signatures
- Prevents TypeScript error TS4111

## Problems Encountered

### 1. Cross-Schema Reference Error

**Problem**: Initial schema used `sql` template literal to reference `auth.users(id)`, causing TypeScript error.
**Solution**: Removed Drizzle reference, added FK constraint in `seed.sql` manually.

### 2. TypeScript Index Signature Access

**Problem**: `process.env.DATABASE_URL` failed with TS4111 error.
**Solution**: Changed to bracket notation `process.env["DATABASE_URL"]`.

## Lessons Learned

### 1. Supabase Seed Files Are Powerful

Seed files run automatically on `supabase db reset`, making them perfect for:

- Database triggers (AFTER INSERT on auth.users)
- Cross-schema foreign key constraints
- Initial data seeding (future use)

### 2. Drizzle Has Schema Limitations

Drizzle can't reference tables outside the `public` schema (like Supabase's `auth.users`). Workarounds:

- Document in comments
- Add constraint manually via seed.sql
- Keep schema simple, handle edge cases in SQL

### 3. Push vs Migrations Trade-off

- **Push**: Fast, destructive, perfect for pre-beta greenfield
- **Migrations**: Safe, version-controlled, required for production
- Transition happens when you have data you can't lose

## Updates for CLAUDE.md

**For Task 3 (Supabase Auth) agent:**

- Database schema is ready (4 tables: user_profiles, machines, issues, issue_comments)
- Auto-profile creation trigger is in `supabase/seed.sql`
- Use `npm run db:push` to sync schema to local Supabase
- Foreign key `user_profiles.id → auth.users.id` enforced by seed.sql
- Types available at `~/lib/types` (UserProfile, Machine, Issue, IssueComment)

**For future agents:**

- All database access via `import { db } from "~/server/db"`
- Schema uses snake_case (database convention)
- Convert to camelCase at application boundaries
- Relations defined, use `db.query.{table}.findMany({ with: { relation } })`
- CHECK constraint ensures every issue has exactly one machine
