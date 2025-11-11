# Task 3: Supabase SSR Authentication

**Status**: 🚧 IN PROGRESS
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

- [x] Install Supabase packages (`npm install @supabase/supabase-js @supabase/ssr`)
- [ ] Create Supabase projects (preview & production via Supabase dashboard)
- [x] Add Supabase env vars to `.env.example`
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- [ ] Add Supabase credentials to `.env.local`

### Supabase SSR Client

- [x] Create `src/lib/supabase/server.ts` (SSR client wrapper)
  - Implement createClient() with cookie handlers
  - Follow CORE-SSR-001 pattern (getAll/setAll cookies)
  - Call auth.getUser() immediately after client creation (CORE-SSR-002)
- [x] Create Next.js middleware (`middleware.ts`)
  - Token refresh logic
  - Follow Supabase SSR middleware pattern
  - Don't modify response object (CORE-SSR-005)
- [x] Create auth callback route (`src/app/auth/callback/route.ts`)
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

- Use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new format) instead of legacy ANON key. Docs and env example updated accordingly.
- SSR client and middleware follow Supabase SSR cookie contract (getAll/setAll). Middleware triggers token refresh with `auth.getUser()` and does not mutate response body.
- Env access uses explicit runtime guards (no non-null `!`). Missing vars throw with clear messages, aligning with strict TypeScript patterns.
- Added a minimal `/auth/auth-code-error` page to avoid 404 when callback fails.

## Problems Encountered

- Type narrowing around Next `cookies()` signature varied in local typings; resolved by awaiting `cookies()` in SSR client to satisfy the workspace type definition.

## Lessons Learned

- Prefer explicit runtime checks for env variables over non-null assertions to stay within strict TypeScript rules and surface config issues early.
- The Supabase SSR pattern requires calling `auth.getUser()` in middleware to proactively refresh tokens and avoid intermittent sign-outs.

## Updates for CLAUDE.md

- Establish pattern: Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; treat legacy anon key as deprecated.
- Middleware and SSR client patterns are in place; reuse these for future auth-dependent routes.
