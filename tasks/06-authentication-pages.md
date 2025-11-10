# Task 6: Authentication Pages

**Status**: ⏳ PENDING
**Branch**: `feat/auth-pages`
**Dependencies**: Task 5 (Testing Infrastructure)

## Objective

Login, signup pages with Server Actions and auth guards for protected routes.

## Acceptance Criteria

- [ ] Can sign up with new account
- [ ] User profile auto-created (trigger works)
- [ ] Can log in with credentials
- [ ] Can log out
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Auth state persists across page refreshes
- [ ] All tests pass
- [ ] Works on mobile (responsive design verified)

## Tasks

### Authentication Pages

- [ ] Create `src/app/(auth)/` route group
- [ ] Create `src/app/(auth)/layout.tsx` (auth pages layout)
- [ ] Create `src/app/(auth)/login/page.tsx`
  - Email/password login form
  - Progressive enhancement (works without JS)
  - Display validation errors
  - Link to signup page
- [ ] Create `src/app/(auth)/signup/page.tsx`
  - Registration form
  - Email, password, name fields
  - Progressive enhancement
  - Link to login page
- [ ] Create `src/app/(auth)/actions.ts` (Server Actions)
  - Login action with Zod validation (CORE-SEC-002)
  - Signup action with Zod validation
  - Logout action
- [ ] Update landing page (`src/app/page.tsx`)
  - Wire Sign Up button to /auth/signup
  - Wire Sign In button to /auth/login

### Protected Routes Pattern

- [ ] Create auth guard helper in `src/lib/auth.ts`
  - Check user in Server Component
  - Redirect to login if unauthenticated
  - Return user if authenticated
- [ ] Create example protected page (`src/app/dashboard/page.tsx`)
  - Simple "Dashboard" heading
  - Display user name/email
  - Logout button
- [ ] Document auth patterns in `docs/PATTERNS.md`
  - Auth check in Server Components
  - Auth check in Server Actions
  - Protected route pattern

### Tests

- [ ] Unit tests for validation schemas
- [ ] Integration tests for auth actions
- [ ] E2E test for signup flow
- [ ] E2E test for login flow
- [ ] E2E test for protected route redirect

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
