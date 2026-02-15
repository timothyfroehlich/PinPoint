# Username-Only Accounts (Internal Email Facade)

**Date**: 2026-02-15
**Status**: Approved
**Scope**: One-off admin-managed accounts for users who don't want to provide an email

## Problem

A user wants a PinPoint account but won't share their email address. They want to log in with a username and password. This should be a hidden capability, not offered to the general public. An admin creates the account on their behalf.

## Design: Internal Email Facade

Supabase Auth requires an email for every account. Rather than fighting this, we satisfy the requirement with a convention: username-only accounts use **`{username}@pinpoint.internal`** as their email. The `.internal` TLD is RFC 6761 reserved and will never resolve to a real mail server.

### Convention & Utility

A single utility function defines the convention:

```typescript
// src/lib/auth/internal-accounts.ts
const INTERNAL_DOMAIN = "pinpoint.internal";

export function isInternalAccount(email: string): boolean {
  return email.endsWith(`@${INTERNAL_DOMAIN}`);
}

export function usernameToInternalEmail(username: string): string {
  return `${username}@${INTERNAL_DOMAIN}`;
}
```

All other code references `isInternalAccount()` rather than checking the domain directly.

### Login Flow Changes

**Files**: `src/app/(auth)/schemas.ts`, `src/app/(auth)/actions.ts`, `src/app/(auth)/login/login-form.tsx`

- The Zod `loginSchema` changes to accept a string that is either a valid email OR a plain alphanumeric username (no `@`).
- In `loginAction`, after validation, if the input has no `@`, append `@pinpoint.internal` before passing to `supabase.auth.signInWithPassword()`.
- The login form's input `type` changes from `email` to `text` (HTML email inputs reject non-email strings).
- The field label stays "Email" — this is intentionally a hidden feature.
- No changes to signup, forgot-password, or auth callback flows.

### Admin Account Creation Script

**File**: `scripts/admin-username-account.mjs` (standalone, no pnpm script needed)

Single script with two modes:

**Create mode** (default):

```bash
./scripts/admin-username-account.mjs --username jdoe --first "John" --last "Doe" --role member
```

- Generates a secure random 16-char alphanumeric password
- Calls `supabase.auth.admin.createUser()` with `email_confirm: true`
- Database trigger auto-creates `user_profiles` record
- Prints username + generated password for admin to hand off

**Password reset mode**:

```bash
./scripts/admin-username-account.mjs --reset-password --username jdoe
```

- Looks up the user by `{username}@pinpoint.internal` email
- Calls `supabase.auth.admin.updateUserById()` with new generated password
- Prints new password for admin to hand off

### Notification Guard Rails

**File**: `src/lib/notifications.ts`

When building the email send list, skip any user whose email satisfies `isInternalAccount()`. In-app notification records are still created — only the email send is skipped. This prevents the email transport from attempting delivery to a nonexistent domain.

### Settings Page

**Files**: `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/profile-form.tsx`

- For internal accounts, display "Username account - no email on file" instead of the raw `@pinpoint.internal` email.
- Hide email-related notification preference toggles (they have no effect).

### Admin Help Page

**Files**: `src/app/(app)/help/admin/page.tsx`, `src/app/(app)/help/page.tsx`

- New `/help/admin` page (Server Component) documenting: what username accounts are, how to run the creation script, how to reset passwords, limitations (no forgot-password, no email notifications).
- Protected by role check (same pattern as admin layout).
- Existing `/help/page.tsx` becomes async + auth-aware, adds a conditional "Admin Help" button visible only to admins.

### Test User & E2E Coverage

**Seed data** (`supabase/seed-users.mjs` or `src/test/data/users.json`):

- Add `testuser@pinpoint.internal` with name "Test Username Account", role `member`, password `TestPassword123`.

**E2E tests**:

1. Login with username — type `testuser` into email field, verify successful login + dashboard redirect.
2. Settings page — verify internal account sees "no email on file" messaging, email notification toggles hidden.

**Unit/integration tests**:

- `isInternalAccount()` utility correctness.
- Notification email skip for internal accounts.

## Explicitly Out of Scope

- Self-service password reset for username accounts
- Making username login a public-facing option
- Adding a `username` column to the database schema
- Phone auth
- Changes to signup, forgot-password, or auth callback flows

## Affected Files Summary

| File                                      | Change                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `src/lib/auth/internal-accounts.ts`       | **New** — utility functions                          |
| `src/app/(auth)/schemas.ts`               | Login schema accepts email or username               |
| `src/app/(auth)/actions.ts`               | Append `@pinpoint.internal` if no `@` in login input |
| `src/app/(auth)/login/login-form.tsx`     | Input type `email` -> `text`                         |
| `src/lib/notifications.ts`                | Skip email send for internal accounts                |
| `src/app/(app)/settings/page.tsx`         | Pass internal account flag                           |
| `src/app/(app)/settings/profile-form.tsx` | Conditional email display + notification toggles     |
| `src/app/(app)/help/page.tsx`             | Async + admin button                                 |
| `src/app/(app)/help/admin/page.tsx`       | **New** — admin help page                            |
| `scripts/admin-username-account.mjs`      | **New** — account creation/reset script              |
| `supabase/seed-users.mjs` (or users.json) | Add test username account                            |
| E2E tests                                 | Login + settings coverage                            |
