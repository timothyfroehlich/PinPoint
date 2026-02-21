# Common Test Helpers

## `e2e/support/actions.ts`

- **`ensureLoggedIn(page, testInfo, options?)`**: Checks if logged in; if not, logs in. Handles mobile/desktop navigation checks.
  - _Use this instead of manual login flows for stability._
- **`loginAs(page, testInfo, options?)`**: Performs fresh login.
- **`logout(page)`**: Logs out via UI.
- **`selectOption(page, triggerId, value)`**: Robustly selects from shadcn/ui Select.

## `e2e/support/page-helpers.ts`

- **`fillReportForm(page, options)`**: Fills the issue report form with defaults.
- **`submitFormAndWaitForRedirect(page, button, options?)`**: Clicks submit and waits for URL change.
  - _Crucial for Safari stability where redirects are slow._

## `e2e/support/mailpit.ts`

- **`waitForEmail(email, criteria)`**: Polls Mailpit for an email.
  - _Criteria_: `{ subjectContains: uniqueTitle, timeout: 30000 }`
- **`getSignupLink(email)`**: Extracts signup magic link.
- **`getPasswordResetLink(email)`**: Extracts reset link.

## `e2e/support/supabase-admin.ts`

Direct database access for setup/teardown.

- `createTestUser` / `deleteTestUser`
- `createTestMachine` / `deleteTestMachine`
- `updateUserRole`
- `confirmUserEmail`
