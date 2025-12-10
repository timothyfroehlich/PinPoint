# E2E Autologin and Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Speed up E2E and integration runs by defaulting dev/preview users to Test Admin when unauthenticated, fixing E2E cleanup reliability, and switching Playwright global setup to the fast reset path with safe fallback.

**Architecture:** Add opt-in autologin inside `src/lib/supabase/middleware.ts` gated by environment and explicit opt-outs; extend the test-data cleanup API to support prefix-based deletions to match e2e helpers; switch Playwright global setup to use the existing fast reset script with a single fallback to the heavy path when the DB is uninitialized. Document the behaviors in E2E best practices.

**Tech Stack:** Next.js middleware (Edge runtime), Supabase SSR client, Drizzle, Playwright, Vitest.

### Task 1: Add TDD coverage for autologin behavior in middleware

**Files:**

- Create: `src/lib/supabase/middleware.test.ts`

**Step 1: Write failing tests**

- Tests cover:
  - Autologin attempts signInWithPassword when env `DEV_AUTOLOGIN_ENABLED=true` and no user present.
  - Autologin skipped when header `x-skip-autologin: true` is present.
  - Autologin disabled when env flag is false/undefined.
  - Query param `?autologin=off` and cookie `skip_autologin=true` both block autologin.
- Mock `createServerClient` to return spies for `auth.getUser`, `auth.signInWithPassword` and `auth.getSession` as needed; fake NextRequest with differing headers/searchParams. Assert redirect behavior untouched (no redirect when public path). Ensure tests call `updateSession` directly.

**Step 2: Run tests to verify they fail**

- Command: `npm test -- src/lib/supabase/middleware.test.ts`
- Expect RED: missing implementation causes failing assertions.

### Task 2: Implement autologin in middleware with opt-outs

**Files:**

- Modify: `src/lib/supabase/middleware.ts`

**Step 1: Implement minimal code**

- Read env `DEV_AUTOLOGIN_ENABLED`, `DEV_AUTOLOGIN_EMAIL`/`DEV_AUTOLOGIN_PASSWORD` (default seeded admin creds) and environment guard (skip in production).
- Define skip detection: header `x-skip-autologin`, cookie `skip_autologin`, query `autologin=off`/`false`/`0`.
- After first `auth.getUser()`, if unauthenticated and autologin allowed and path not public? Wait—we only want for missing valid cookie regardless of path except authentication routes? Apply only for non-API? (Keep public path allowed). Call `auth.signInWithPassword` then `auth.getUser()` again to refresh `user`; if still missing, continue existing behavior.
- Preserve existing redirect logic for protected routes; ensure autologin executes before redirect check.

**Step 2: Re-run test**

- Command: `npm test -- src/lib/supabase/middleware.test.ts`
- Expect GREEN.

**Step 3: Refactor if needed**

- Keep names clear; no extra behavior.

### Task 3: Fix E2E cleanup to support title prefixes

**Files:**

- Modify: `e2e/support/cleanup.ts`
- Modify: `src/app/api/test-data/cleanup/route.ts`
- Add: `src/app/api/test-data/cleanup/route.test.ts` (integration/unit style with mocked db)

**Step 1: Write failing tests**

- Test API: when `issueTitlePrefix` provided, deletes matching issues (and returns IDs) using mocked db delete with title `LIKE prefix%` query; ensure machineIds/issueIds still work; ensure production guard returns 403 when NODE_ENV=production. Mock db with vi.fn.
- Test helper: calling `cleanupTestEntities` with `issueTitlePrefix` sends correct payload and tolerates empty removals.

**Step 2: Run tests to see RED**

- Command: `npm test -- src/app/api/test-data/cleanup/route.test.ts e2e/support/cleanup.ts`

**Step 3: Implement minimal code**

- API route: parse optional `issueTitlePrefix` (string), query issues where title ILIKE prefix% (use `like`/`ilike` from drizzle-orm), delete and return ids; keep UUID validation for explicit IDs; still block production.
- Helper: include `issueTitlePrefix` in payload; only call endpoint when at least one criterion present.

**Step 4: Re-run tests**

- Command: `npm test -- src/app/api/test-data/cleanup/route.test.ts`
- Expect GREEN.

### Task 4: Switch Playwright global setup to fast reset with safe fallback

**Files:**

- Modify: `e2e/global-setup.ts`

**Step 1: Write failing test or assertion?**

- Add minimal test in `src/test/unit/global-setup.test.ts` that stubs `execSync` and asserts command ordering: prefers `npm run db:fast-reset`; on thrown error, falls back to the current heavy flow (supabase db reset + db:\_push + test:\_generate-schema + db:\_seed + db:\_seed-users). Write failing tests accordingly.

**Step 2: Run tests to confirm RED**

- Command: `npm test -- e2e/global-setup.test.ts`

**Step 3: Implement code**

- Wrap fast reset try/catch; on success, exit early; on failure log and run full flow (reuse existing commands). Respect `SKIP_SUPABASE_RESET` to bypass entirely.

**Step 4: Re-run tests**

- Command: `npm test -- e2e/global-setup.test.ts`
- Expect GREEN.

### Task 5: Update documentation

**Files:**

- Modify: `docs/E2E_BEST_PRACTICES.md`

**Step 1: Add notes**

- Document autologin behavior, how to opt out via header/cookie/query, and env flags.
- Document Playwright fast-reset default and fallback, plus when to use SKIP_SUPABASE_RESET.
- Document cleanup endpoint semantics and issueTitlePrefix usage.

**Step 2: No tests needed**

- Proofread.

### Verification

- Run targeted tests: `npm test -- src/lib/supabase/middleware.test.ts src/app/api/test-data/cleanup/route.test.ts e2e/global-setup.test.ts`
- Run lint/typecheck: `npm run check`
- (If time) Run smoke: `npm run smoke`
