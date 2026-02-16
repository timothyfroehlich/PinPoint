# Change Password in Settings — Design

**Date:** 2026-02-15
**GitHub Issue:** #994 (Add password reset)
**Scope:** Add a "Change Password" section to the Settings page for authenticated users.

## Architecture

Inline section on `/settings` between Notification Preferences and Danger Zone. Follows the existing stacked-section pattern with `<Separator />` dividers.

### Components

- **`ChangePasswordSection`** — Client component with 3 password inputs and submit button
- **`changePasswordAction`** — Server action in `settings/actions.ts`
- **`changePasswordSchema`** — Zod schema in `settings/actions.ts` (co-located)

### Form Fields

1. Current Password (required)
2. New Password (required, 8-128 chars)
3. Confirm New Password (must match)

### Server Action Flow

1. `getUser()` auth check
2. Zod validation
3. Verify current password via `signInWithPassword(email, currentPassword)`
4. Update via `updateUser({ password: newPassword })`
5. Return success — user stays logged in (no sign-out)

### Username Accounts

Works identically — `signInWithPassword` uses `username@pinpoint.internal`. No email involved.

### Error States

- Wrong current password: "Current password is incorrect"
- Validation errors: inline field messages
- Server errors: generic message

### Testing

- Unit test for `changePasswordAction` (mock Supabase)
- E2E test: login, navigate to settings, change password, verify new password works
