# Common Test Helpers

## `e2e/support/auth-state.ts` and `e2e/auth.setup.ts` — Cached Auth State

- **`STORAGE_STATE`**: Constants for pre-saved auth state files.
  - `STORAGE_STATE.admin` → `e2e/.auth/admin.json`
  - `STORAGE_STATE.member` → `e2e/.auth/member.json`
  - `STORAGE_STATE.technician` → `e2e/.auth/technician.json`

Usage (opt-in per describe block):

```typescript
import { STORAGE_STATE } from "../support/auth-state"; // adjust path to e2e root

test.describe("My Feature", () => {
  test.use({ storageState: STORAGE_STATE.member });
  // tests start already logged in as member
});
```

The `e2e/.auth/` directory is gitignored and auto-created by the `auth-setup` Playwright project which runs before browser projects. Each browser project declares `dependencies: ["auth-setup"]`.

## `e2e/support/actions.ts`

- **`ensureLoggedIn(page, testInfo, options?)`**: Checks if logged in; if not, logs in. For multi-role or legacy tests. Prefer `storageState` for single-role tests.
- **`loginAs(page, testInfo, options?)`**: Performs fresh login. Use for mid-test role switches or auth flow tests.
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
