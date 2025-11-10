# Task 10: Password Reset Flow

**Status**: ⏳ PENDING
**Branch**: `feat/password-reset`
**Dependencies**: Task 9.5 (Member Dashboard)

## Objective

Password reset flow (forgot password, reset link, new password) via Supabase auth.

## Acceptance Criteria

- [ ] Can request password reset from login page
- [ ] Reset email is sent (check inbox or Supabase logs)
- [ ] Reset link redirects to reset password page
- [ ] Can set new password successfully
- [ ] Can log in with new password
- [ ] Expired/invalid tokens show error message
- [ ] All tests pass

## Tasks

### Password Reset Request Page

- [ ] Create `src/app/(auth)/forgot-password/page.tsx`
- [ ] Create form with email input
  - Progressive enhancement
  - Zod validation (email format)
  - Display success message after submission
- [ ] Create Server Action for password reset request
  - Call `supabase.auth.resetPasswordForEmail(email)`
  - Provide redirect URL to reset password page
  - Handle errors gracefully
- [ ] Add "Forgot password?" link to login page

### Password Reset Confirmation Page

- [ ] Create `src/app/(auth)/reset-password/page.tsx`
- [ ] Create form for new password
  - Password input (with confirmation)
  - Zod validation (min length, match confirmation)
  - Progressive enhancement
- [ ] Create Server Action for password update
  - Call `supabase.auth.updateUser({ password: newPassword })`
  - Redirect to login after success
  - Handle errors (expired link, invalid token)

### Email Configuration

- [ ] Configure Supabase email templates (in Supabase dashboard)
  - Password reset email template
  - Set redirect URL to app's reset password page
- [ ] Test email delivery in preview environment

### Tests

- [ ] Integration test: Password reset request creates email
- [ ] Integration test: Password update succeeds with valid token
- [ ] E2E test: Full password reset flow
  - Request reset
  - Click email link (mock or manual)
  - Set new password
  - Login with new password

## Key Decisions

_To be filled during task execution_

## Problems Encountered

_To be filled during task execution_

## Lessons Learned

_To be filled during task execution_

## Updates for CLAUDE.md

_To be filled after completion - what future agents need to know_
