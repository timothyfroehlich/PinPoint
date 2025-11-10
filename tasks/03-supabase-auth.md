# Task 3: Supabase SSR Authentication

**Status**: ⏳ PENDING
**Branch**: `setup/supabase-auth`
**Dependencies**: Task 2 (Database Schema)

## Objective

Supabase client, middleware, auth callback, and schema deployment to live Supabase instance.

## Acceptance Criteria

- [ ] Middleware runs without errors
- [ ] Auth callback route responds (test with curl)
- [ ] Can connect to Supabase database
- [ ] Schema exists in Supabase project
- [ ] Trigger creates user_profiles automatically
- [ ] No Supabase SSR warnings in console

## Tasks

### Supabase Setup

- [ ] Install Supabase packages (`npm install @supabase/supabase-js @supabase/ssr`)
- [ ] Create Supabase projects (preview & production via Supabase dashboard)
- [ ] Add Supabase env vars to `.env.example`
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Add Supabase credentials to `.env.local`

### Supabase SSR Client

- [ ] Create `src/lib/supabase/server.ts` (SSR client wrapper)
  - Implement createClient() with cookie handlers
  - Follow CORE-SSR-001 pattern (getAll/setAll cookies)
  - Call auth.getUser() immediately after client creation (CORE-SSR-002)
- [ ] Create Next.js middleware (`middleware.ts`)
  - Token refresh logic
  - Follow Supabase SSR middleware pattern
  - Don't modify response object (CORE-SSR-005)
- [ ] Create auth callback route (`src/app/auth/callback/route.ts`)
  - Handle OAuth callback
  - Redirect to home after successful auth

### Schema Deployment

- [ ] Apply schema to Supabase preview project
  - Use `npx drizzle-kit push` or SQL import
- [ ] Execute trigger creation SQL in Supabase SQL editor
- [ ] Verify tables exist in Supabase dashboard
- [ ] Test database connection from application
- [ ] Test trigger: Sign up new user, verify profile auto-created

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
