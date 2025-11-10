# Task 2: Database Schema

**Status**: ⏳ PENDING
**Branch**: `setup/database-schema`
**Dependencies**: Task 1 (Project Foundation)

## Objective

Drizzle ORM setup and complete schema definition with database trigger for auto-profile creation.

## Acceptance Criteria

- [ ] `npx drizzle-kit generate` works without errors
- [ ] Schema types are available for import
- [ ] TypeScript compilation includes schema types
- [ ] No TypeScript errors in schema file
- [ ] Trigger script ready for deployment

## Tasks

### Drizzle ORM Setup

- [ ] Install Drizzle (`npm install drizzle-orm`)
- [ ] Install Drizzle Kit (`npm install -D drizzle-kit`)
- [ ] Install PostgreSQL driver (`npm install postgres`)
- [ ] Create `drizzle.config.ts`
- [ ] Create `src/server/db/index.ts` (database instance)

### Database Schema

- [ ] Create `src/server/db/schema.ts`
- [ ] Define `user_profiles` table (NOT `users`)
  - id (uuid, primary key, references auth.users(id) ON DELETE CASCADE)
  - name (text, not null)
  - avatar_url (text)
  - role (text: 'guest' | 'member' | 'admin', default 'member')
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Define `machines` table
  - id (uuid, primary key, default gen_random_uuid())
  - name (text, not null)
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Define `issues` table
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
- [ ] Define `issue_comments` table (NOT `comments`)
  - id (uuid, primary key, default gen_random_uuid())
  - issue_id (uuid, not null, foreign key → issues.id ON DELETE CASCADE)
  - author_id (uuid, foreign key → user_profiles.id)
  - content (text, not null)
  - is_system (boolean, default false) -- for timeline events
  - created_at (timestamp, default now())
  - updated_at (timestamp, default now())
- [ ] Add Drizzle relations definitions

### Database Trigger (Auto-Profile Creation)

- [ ] Create `handle_new_user()` function
  - Auto-creates user_profiles record on signup
  - Copies name from Supabase auth.users metadata
  - Sets default role to 'member'
- [ ] Create trigger on `auth.users` table
  - AFTER INSERT trigger
  - Executes handle_new_user() function
- [ ] Document trigger in schema comments

### Package.json Scripts

- [ ] Add package.json scripts:
  - [ ] `db:generate` - Generate Drizzle migrations
  - [ ] `db:push` - Push schema to database
  - [ ] `db:studio` - Open Drizzle Studio

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
