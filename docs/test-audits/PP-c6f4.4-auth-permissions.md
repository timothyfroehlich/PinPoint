# PP-c6f4.4: Campaign Lane: Auth and Permissions — Test Audit Ledger & Layer Plan

**Lane:** Auth and permissions (`PP-c6f4.4`)
**Files:** 64 authoritative files from epic `PP-c6f4` baseline map (63 active, 1 deleted on `main` in PR #2281)
**Total Test Declarations Audited:** 507 declarations

## 1. Executive Summary & Layer Plan

### Layer Plan & Redundant Layer Pruning

1. **Retire Canned Drizzle DB Mocks (CORE-TEST-004) in Account Deletion:**
   - `src/app/(app)/settings/delete-account-action.test.ts` used hand-rolled Drizzle mocks (`mockFindFirst`, `mockTransaction`) to simulate DB calls for `deleteAccountAction`.
   - `src/test/integration/account-deletion.test.ts` already runs worker-scoped PGlite with full schema and real transactions. All action contracts (unauthorized, validation, sole admin, best-effort auth cleanup, session revocation order) are consolidated into `src/test/integration/account-deletion.test.ts`.
   - **Result:** `delete-account-action.test.ts` (239 lines) is completely retired.

2. **Upgrade OAuth Database Updates to Real PGlite Integration:**
   - `src/app/(auth)/oauth-actions.test.ts` mocked `db.update` to assert the mock was called on unlink.
   - `src/app/(auth)/oauth-actions.integration.test.ts` used the same mock despite being named `.integration.`.
   - We upgrade `src/app/(auth)/oauth-actions.integration.test.ts` to use worker-scoped PGlite (`getTestDb()` / `setupTestDb()`) and verify real database persistence: `discord_user_id` mirror is properly cleared in `userProfiles` upon unlinking.

3. **Consolidate Duplicate Schema Validation Files (CORE-TEST-009):**
   - `src/test/unit/auth-validation.test.ts` and `src/app/(auth)/schemas.test.ts` duplicated tests for schemas in `src/app/(auth)/schemas.ts`.
   - All `signupSchema` validation tests are merged into the colocated `src/app/(auth)/schemas.test.ts`.
   - **Result:** `src/test/unit/auth-validation.test.ts` (285 lines) is retired.

4. **Eliminate Duplicate Component Test File for PersonHoverCard (CORE-TEST-009):**
   - `src/test/unit/components/people/person-hover-card.test.tsx` duplicated `src/components/people/PersonHoverCard.test.tsx`.
   - The unique fetch-role test is consolidated into `src/components/people/PersonHoverCard.test.tsx`.
   - **Result:** `src/test/unit/components/people/person-hover-card.test.tsx` (51 lines) is retired.

5. **Eliminate Duplicate Helper Contract Tests in Route Callback:**
   - `src/app/(auth)/auth/callback/route.test.ts` tested `isInternalUrl` directly, duplicating the comprehensive suite in `src/lib/url.test.ts`.
   - The redundant tests are pruned while retaining `resolveRedirectPath` tests.

6. **Address Missing Integration Coverage for removeInvitedUser Action:**
   - `removeInvitedUser` was only tested via full E2E in `e2e/full/admin-remove-invited-user.spec.ts`.
   - Added targeted PGlite integration tests to `src/test/integration/admin/user-management.test.ts` to verify admin authorization, DB deletion from `invitedUsers`, and non-admin denial at the cheaper integration layer (Class B/E).

7. **Type Safety Enforcement (CORE-TS-007):**
   - Fixed `as any` and `any[]` in `src/app/(auth)/actions.test.ts` and `src/test/unit/components/auth/login-form.test.tsx`.

## 2. Per-Test Declaration Ledger

### `e2e/full/admin-remove-invited-user.spec.ts`

| #   | Status | Bug Class | Test Name                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | admin can remove a pending invited user     | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 2   | **R**  | F         | Remove button is not shown for active users | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/admin-users.spec.ts`

| #   | Status | Bug Class | Test Name                             | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | admin can view users and change roles | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 2   | **R**  | F         | admin cannot demote themselves        | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 3   | **R**  | F         | non-admin cannot access admin page    | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/change-password.spec.ts`

| #   | Status | Bug Class | Test Name                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | user can change password from settings page | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/privilege-reset.spec.ts`

| #   | Status | Bug Class | Test Name                                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | should reset privileges when switching from admin to member | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/profile-edit.spec.ts`

| #   | Status | Bug Class | Test Name                     | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ----------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | member edits pronouns and bio | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/public-routes-audit.spec.ts`

| #   | Status | Bug Class | Test Name                                                                                           | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | /m/new redirects to login (page-level protection)                                                   | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 2   | **R**  | F         | /m/[initials]/edit redirects an anonymous viewer to the machine detail page (page-level protection) | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/technician-role.spec.ts`

| #   | Status | Bug Class | Test Name                                          | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | F         | Technician can see Add Machine button on list page | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 2   | **R**  | F         | Technician can access machine creation page        | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 3   | **R**  | F         | Technician can create a machine                    | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 4   | **R**  | F         | Technician can edit a machine they do not own      | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |
| 5   | **R**  | F         | Technician CANNOT access the admin panel           | Retain: Multi-step browser user journey with page transitions (CORE-TEST-005) |

### `e2e/full/username-account-settings.spec.ts`

_File deleted on `main` in PR #2281 (PP-zl00.3) during earlier E2E audit wave. Ledger records 0 active tests._

### `e2e/smoke/auth-flows.spec.ts`

| #   | Status | Bug Class | Test Name                                                                     | Rationale / Target Keeper                                                       |
| --- | ------ | --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **R**  | D         | login with username (no @) redirects to dashboard                             | Retain: Critical smoke test verifying page renders without 500 / CSP violations |
| 2   | **R**  | D         | login flow - sign in with existing account                                    | Retain: Critical smoke test verifying page renders without 500 / CSP violations |
| 3   | **R**  | D         | protected route redirect - login with ?next= and land on original destination | Retain: Critical smoke test verifying page renders without 500 / CSP violations |
| 4   | **R**  | D         | logout flow - sign out and verify unauthenticated state                       | Retain: Critical smoke test verifying page renders without 500 / CSP violations |

### `e2e/smoke/issue-detail-permissions.spec.ts`

| #   | Status | Bug Class | Test Name                                            | Rationale / Target Keeper                                                       |
| --- | ------ | --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **R**  | D         | page loads without error for unauthenticated visitor | Retain: Critical smoke test verifying page renders without 500 / CSP violations |

### `e2e/smoke/profile.spec.ts`

| #   | Status | Bug Class | Test Name           | Rationale / Target Keeper                                                       |
| --- | ------ | --------- | ------------------- | ------------------------------------------------------------------------------- |
| 1   | **R**  | D         | own profile renders | Retain: Critical smoke test verifying page renders without 500 / CSP violations |

### `e2e/smoke/proxy-boundary.spec.ts`

| #   | Status | Bug Class | Test Name                                                         | Rationale / Target Keeper                                                       |
| --- | ------ | --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **R**  | D         | the request proxy canonicalizes machine links                     | Retain: Critical smoke test verifying page renders without 500 / CSP violations |
| 2   | **R**  | D         | HTML has a fresh CSP nonce that Next applies to scripts           | Retain: Critical smoke test verifying page renders without 500 / CSP violations |
| 3   | **R**  | D         | anonymous protected routes redirect while public routes stay open | Retain: Critical smoke test verifying page renders without 500 / CSP violations |

### `src/app/(app)/settings/change-password-action.test.ts`

| #   | Status | Bug Class | Test Name                                                 | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | returns UNAUTHORIZED when not logged in                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | returns VALIDATION when new password is too short         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | returns VALIDATION when passwords do not match            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | returns SERVER when rate limited                          | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | returns WRONG_PASSWORD when current password is incorrect | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | returns SERVER when updateUser fails                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | returns success when password is changed                  | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(app)/settings/change-password-section.test.tsx`

| #   | Status | Bug Class | Test Name                                                    | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | renders all three password fields                            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | renders the Change Password button                           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | has correct autocomplete attributes                          | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | renders the error message when the current password is wrong | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(app)/settings/connected-accounts/connected-accounts-section.test.tsx`

| #   | Status | Bug Class | Test Name                                                            | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | renders Connect button when provider is not linked                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | renders enabled Disconnect button when linked and canUnlink          | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | renders disabled Disconnect button with help text when only identity | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | does not render the Discord email or username (email privacy)        | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(app)/settings/delete-account-action.test.ts`

| #   | Status | Bug Class | Test Name                                                     | Rationale / Target Keeper                                                                        |
| --- | ------ | --------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **C**  | B         | returns UNAUTHORIZED when not logged in                       | Consolidate into src/test/integration/account-deletion.test.ts using real PGlite (CORE-TEST-004) |
| 2   | **C**  | B         | returns VALIDATION when confirmation is wrong                 | Consolidate into src/test/integration/account-deletion.test.ts using real PGlite (CORE-TEST-004) |
| 3   | **C**  | B         | returns SOLE_ADMIN when user is last admin                    | Consolidate into src/test/integration/account-deletion.test.ts using real PGlite (CORE-TEST-004) |
| 4   | **C**  | B         | still redirects when auth deletion fails (best-effort)        | Consolidate into src/test/integration/account-deletion.test.ts using real PGlite (CORE-TEST-004) |
| 5   | **C**  | B         | reports admin signOut errors but still proceeds with deletion | Consolidate into src/test/integration/account-deletion.test.ts using real PGlite (CORE-TEST-004) |

### `src/app/(app)/settings/settings-missing-profile.test.tsx`

| #   | Status | Bug Class | Test Name                                                                             | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | calls notFound() and reportError — does NOT redirect to login                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | redirects unauthenticated visitors to login (control path unaffected)                 | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | passes isInternalAccount={true} to NotificationPreferencesForm for username accounts  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | passes isInternalAccount={false} to NotificationPreferencesForm for standard accounts | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(app)/u/[id]/profile-editor.test.tsx`

| #   | Status | Bug Class | Test Name                                                | Rationale / Target Keeper                                    |
| --- | ------ | --------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **R**  | H         | pre-fills the form fields from initial values            | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 2   | **R**  | H         | exposes a file input for the avatar                      | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 3   | **R**  | H         | offers a Cancel control that links back to the read view | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |

### `src/app/(auth)/actions-security.test.ts`

| #   | Status | Bug Class | Test Name                                                                          | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | signupAction should return generic error message on server error                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | signupAction should return specific error for duplicate email                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | signupAction should return WEAK_PASSWORD for breached password                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | signupAction should return SERVER when createClient() throws                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | forgotPasswordAction should return success on backend errors (prevent enumeration) | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | resetPasswordAction should return WEAK_PASSWORD for breached password              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | resetPasswordAction should return SAME_PASSWORD for same_password error            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | resetPasswordAction should return generic error message on server error            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | resetPasswordAction should call updateUser when password update succeeds           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | loginAction should return SERVER for network failures (AuthRetryableFetchError)    | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | loginAction should return SERVER for 500-level errors instead of credential error  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | loginAction should return generic AUTH error for credential failures               | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/actions.test.ts`

| #   | Status | Bug Class | Test Name                                                         | Rationale / Target Keeper                                                  |
| --- | ------ | --------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **F**  | B         | should fallback to localhost when NEXT_PUBLIC_SITE_URL is not set | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 2   | **F**  | B         | should use NEXT_PUBLIC_SITE_URL when set                          | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 3   | **F**  | B         | should ignore other headers and use NEXT_PUBLIC_SITE_URL          | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 4   | **F**  | B         | should accept localhost:3000 when configured as site URL          | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 5   | **F**  | B         | should accept localhost:3100 when configured as site URL          | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 6   | **F**  | B         | should accept any valid URL configured in NEXT_PUBLIC_SITE_URL    | Fix: remove unsafe as any, verify origin fallback logic at action boundary |

### `src/app/(auth)/auth/callback/route.test.ts`

| #   | Status | Bug Class | Test Name                                                                                       | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | should return true for root path                                                                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | should return true for internal paths                                                           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | should return false for external URLs                                                           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | should return false for protocol-relative URLs                                                  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | should accept valid internal path                                                               | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | should reject external URL (open redirect prevention)                                           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | should reject protocol-relative URL                                                             | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | should handle paths with query params and hash                                                  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | should return fallback when nextParam is null                                                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | should accept absolute URL matching site url                                                    | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | should reject absolute URL matching a different host (even if it was forwarded host previously) | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | should accept absolute URL matching configured production site url                              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 13  | **R**  | G         | should reject mismatching site url when production url is configured                            | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/forgot-password/forgot-password-form.test.tsx`

| #   | Status | Bug Class | Test Name                               | Rationale / Target Keeper                                    |
| --- | ------ | --------- | --------------------------------------- | ------------------------------------------------------------ |
| 1   | **R**  | C         | should render form fields               | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 2   | **R**  | C         | should call action on submit            | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 3   | **R**  | C         | should display error message on failure | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |

### `src/app/(auth)/login-redirect.test.ts`

| #   | Status | Bug Class | Test Name                                                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | should redirect to /dashboard when no next parameter is provided            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | should redirect to the next parameter when provided                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | should redirect to /dashboard when next parameter is empty string           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | should redirect to /dashboard when next parameter is an external/unsafe URL | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | should handle various protected routes in next parameter                    | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/oauth-actions.integration.test.ts`

| #   | Status | Bug Class | Test Name                                               | Rationale / Target Keeper                                                                                        |
| --- | ------ | --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **F**  | B         | refuses second unlink once user is back to one identity | Fix/Upgrade: replace canned Drizzle mock with worker-scoped PGlite and verify real discord_user_id nullification |

### `src/app/(auth)/oauth-actions.test.ts`

| #   | Status | Bug Class | Test Name                                                       | Rationale / Target Keeper                                                                                        |
| --- | ------ | --------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **F**  | B         | refuses when provider is not available                          | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 2   | **F**  | B         | returns redirect URL from supabase.auth.signInWithOAuth         | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 3   | **F**  | B         | refuses when unlink would leave user with zero identities       | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 4   | **F**  | B         | unlinks when user has >=2 identities                            | Fix: replace Drizzle canned mock with direct action execution; real DB check verified in PGlite integration test |
| 5   | **F**  | B         | refuses when user is not logged in                              | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 6   | **F**  | B         | returns redirect URL from supabase.auth.linkIdentity            | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 7   | **F**  | B         | redirects to the provider URL on success                        | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 8   | **F**  | B         | redirects to /login?oauth_error=PROVIDER_UNAVAILABLE on failure | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 9   | **F**  | B         | redirects to /settings?oauth_status=unlinked on success         | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |
| 10  | **F**  | B         | redirects to /settings?oauth_error=ONLY_IDENTITY when refused   | Fix: remove unsafe as any, verify origin fallback logic at action boundary                                       |

### `src/app/(auth)/oauth-button-list.test.tsx`

| #   | Status | Bug Class | Test Name                                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | renders nothing when no providers are configured            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | renders Continue with Discord when Discord env vars are set | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/oauth/consent/actions.test.ts`

| #   | Status | Bug Class | Test Name                                                           | Rationale / Target Keeper                                                  |
| --- | ------ | --------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **F**  | B         | approve: admin → approveAuthorization then redirect to redirect_url | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 2   | **F**  | B         | deny: admin → denyAuthorization then redirect to redirect_url       | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 3   | **F**  | B         | missing authorization_id → redirect to /oauth/consent               | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 4   | **F**  | B         | unauthenticated → redirect to login with encoded next               | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 5   | **F**  | B         | non-admin → redirect back to consent page (no error flag)           | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 6   | **F**  | B         | approve error → redirect back to the consent page                   | Fix: remove unsafe as any, verify origin fallback logic at action boundary |

### `src/app/(auth)/oauth/consent/page.test.tsx`

| #   | Status | Bug Class | Test Name                                                       | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | renders an error notice when authorization_id is missing        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | redirects unauthenticated users to login with encoded next      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | shows an admin-only notice for non-admins                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | redirects immediately when the user already consented           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | renders an error notice when details fail to load               | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | renders the consent form with client name, scopes, and redirect | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | refuses when the authorization belongs to a different user      | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/schemas.test.ts`

| #   | Status | Bug Class | Test Name                                              | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | should accept valid email with password                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | should accept plain username (no @) with password      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | should accept alphanumeric username with underscores   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | should reject empty email/username                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | should reject single-character username                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | should accept two-character username                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | should reject password-only (no email)                 | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | should accept valid standard email                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | should accept email with + sign (gmail aliases)        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | should accept email with subdomain                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | should reject email without @                          | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | should reject email without domain                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 13  | **R**  | G         | should accept valid password and matching confirmation | Retain: Pure logic / unit validation of authentication or authorization rules |
| 14  | **R**  | G         | should accept password at minimum length (8 chars)     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 15  | **R**  | G         | should reject password below minimum length (7 chars)  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 16  | **R**  | G         | should reject password mismatch                        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 17  | **R**  | G         | should accept password with unicode characters         | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/app/(auth)/signup/signup-form.test.tsx`

| #   | Status | Bug Class | Test Name                                            | Rationale / Target Keeper                                    |
| --- | ------ | --------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **R**  | C         | should render form fields                            | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 2   | **R**  | C         | should call signup action on submit                  | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 3   | **R**  | C         | should display error message on failure              | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 4   | **R**  | C         | should show mismatch indicator when passwords differ | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 5   | **R**  | C         | should show match indicator when passwords match     | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |

### `src/app/.well-known/oauth-protected-resource/route.test.ts`

| #   | Status | Bug Class | Test Name                                                  | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | advertises the exact MCP resource and Supabase Auth issuer | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | supports browser preflight                                 | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/components/people/PersonHoverCard.test.tsx`

| #   | Status | Bug Class | Test Name                                        | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | renders a profile link for a real user           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | renders plain text (no link) for an invited user | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | renders plain text for a former user             | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/auth/derive-name.test.ts`

| #   | Status | Bug Class | Test Name                                                                          | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | takes an explicit first and last name and marks it not derived                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | accepts an explicit first name with no last name                                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | trims, so a whitespace-only first name falls through instead of being stored blank | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | prefers global_name over the account handle                                        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | yields a single-token first name when the display name is a handle                 | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | falls back to full_name when custom_claims has no global_name                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | strips the legacy discriminator when only `name` is available                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | strips the discriminator even with trailing whitespace                             | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | does not treat a non-object custom_claims as a lookup target                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | splits on the first whitespace run only, keeping compound surnames whole           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | collapses runs of whitespace rather than emitting empty segments                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | uses the email local-part when there is no metadata at all                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 13  | **R**  | G         | handles null metadata                                                              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 14  | **R**  | G         | never returns an empty first name, even for degenerate input                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 15  | **R**  | G         | falls back to 'Member' when the email has no usable local-part                     | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/auth/errors.test.ts`

| #   | Status | Bug Class | Test Name                                                               | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | returns breach message for weak_password with pwned reason              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | returns strength message for weak_password with length reason           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | returns generic weak message for weak_password without specific reasons | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | returns duplicate message for user_already_exists                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | returns duplicate message for email_exists                              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | returns rate limit message for over_request_rate_limit                  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | returns actionable SERVER message for captcha_failed                    | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | returns email confirmation message for email_not_confirmed              | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | returns same password message for same_password                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | returns validation message for validation_failed                        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | returns email not authorized message                                    | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | returns signup disabled message for signup_disabled                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 13  | **R**  | G         | returns signup disabled message for email_provider_disabled             | Retain: Pure logic / unit validation of authentication or authorization rules |
| 14  | **R**  | G         | returns undefined for unknown error codes                               | Retain: Pure logic / unit validation of authentication or authorization rules |
| 15  | **R**  | G         | returns undefined when error has no code                                | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/auth/identity-guards.test.ts`

| #   | Status | Bug Class | Test Name                                                            | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | refuses when user has only one identity (that one is being unlinked) | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | refuses when user has zero identities of the target provider         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | allows when user has two identities                                  | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | allows when user has three identities                                | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/auth/internal-accounts.test.ts`

| #   | Status | Bug Class | Test Name                                  | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | returns true for @pinpoint.internal emails | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | returns false for regular emails           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | returns false for partial domain match     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | returns false for empty string             | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | converts username to internal email        | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/auth/providers.test.ts`

| #   | Status | Bug Class | Test Name                                                            | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | exposes a discord provider with the expected shape                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | isAvailable() is false when both env vars are missing                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | isAvailable() is false when only DISCORD_CLIENT_ID is set            | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | isAvailable() is false when only DISCORD_CLIENT_SECRET is set        | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | isAvailable() is true when both env vars are set                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | getAvailableProviders() omits providers whose isAvailable() is false | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | getAvailableProviders() includes discord when both env vars are set  | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/lib/permissions/collections.test.ts`

| #   | Status | Bug Class | Test Name                                                   | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | allows the owner                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | allows an admin who is not the owner                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | denies a non-owner non-admin                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | denies a non-owner technician                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | G         | denies a non-owner guest                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | G         | denies anonymous                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | G         | denies a signed-in user with no role row                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | G         | allows the owner                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | G         | denies an admin who is not the owner                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | G         | denies anonymous                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | G         | allows the owner (regardless of collaborator flag)          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | G         | allows a signed-in editor collaborator                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | G         | denies a signed-in non-collaborator                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | G         | denies an admin who is not owner/collaborator (no edit-any) | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | G         | denies anonymous even if the flag is somehow true           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/lib/permissions/machines.test.ts`

| #   | Status | Bug Class | Test Name                                                               | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | allows a member who does not own the machine into the read-only surface | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | allows a member who owns the machine into the editing surface           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | allows a %s into the editing surface                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | denies a %s because neither route capability is granted                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/lib/permissions/settings.test.ts`

| #   | Status | Bug Class | Test Name                                                                                | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | shows public sets to everyone, including anonymous                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | shows the owner's default to everyone even when not public                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | hides a private draft from everyone but its creator                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | lets admin see a private draft they didn't create                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | G         | owner set: editable by the machine owner and admin, NOT technicians                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | G         | community set: editable by technicians, the owner, and admin                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | G         | community set: a plain non-owner member cannot edit                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | G         | unowned machine: an owner-kind set stays technician-editable                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | G         | private draft: only its creator (a tech) can edit — not other techs                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | G         | an unauthenticated or guest user cannot edit even if ID matches owner (PP-leli.8)        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | G         | owner/admin may set an owner set as default                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | G         | a community set is never eligible to be the default                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | G         | a technician cannot set the owner's default                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | G         | an unauthenticated or guest user cannot set default even if ID matches owner (PP-leli.8) | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | G         | a technician who owns the machine can set default on their own machine (PP-leli.8)       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/lib/supabase/middleware.test.ts`

| #   | Status | Bug Class | Test Name                                                                   | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | logs in automatically when enabled and unauthenticated                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | skips autologin when header requests it                                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | skips autologin when disabled via env                                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | skips autologin when env var is undefined (default false)                   | Retain: Pure logic / unit validation of authentication or authorization rules |
| 5   | **R**  | G         | skips autologin when query param disables it                                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 6   | **R**  | G         | skips autologin when cookie requests it                                     | Retain: Pure logic / unit validation of authentication or authorization rules |
| 7   | **R**  | G         | never attempts autologin in production                                      | Retain: Pure logic / unit validation of authentication or authorization rules |
| 8   | **R**  | G         | allows unauthenticated access to issue detail pages                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 9   | **R**  | G         | allows unauthenticated access to %s                                         | Retain: Pure logic / unit validation of authentication or authorization rules |
| 10  | **R**  | G         | redirects unauthenticated users from %s to /login                           | Retain: Pure logic / unit validation of authentication or authorization rules |
| 11  | **R**  | G         | preserves the query string in `next` when redirecting to /login             | Retain: Pure logic / unit validation of authentication or authorization rules |
| 12  | **R**  | G         | preserves cleared session cookies on a login redirect                       | Retain: Pure logic / unit validation of authentication or authorization rules |
| 13  | **R**  | G         | preserves forwarded CSP and nonce when session cookies replace the response | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/test/integration/account-deletion.test.ts`

| #   | Status | Bug Class | Test Name                                                                  | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | should anonymize issues, comments, and images when user is deleted         | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | should reassign machines to another user if requested                      | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | should throw SoleAdminError if the last admin tries to delete account      | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | should allow admin deletion if another admin exists                        | Retain: Real PGlite integration test validating data correctness or action wiring |
| 5   | **R**  | I         | reassign picker query excludes guests and includes member/technician/admin | Retain: Real PGlite integration test validating data correctness or action wiring |
| 6   | **R**  | I         | anonymizes DB references and redirects on successful account deletion      | Retain: Real PGlite integration test validating data correctness or action wiring |
| 7   | **R**  | I         | returns SOLE_ADMIN from action when user is last admin in real DB          | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/admin/user-management.test.ts`

| #   | Status | Bug Class | Test Name                                                                                | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | should allow admin to change user role                                                   | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | should prevent admin from demoting themselves                                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | should prevent non-admin from changing roles                                             | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | should allow admin to invite a new user                                                  | Retain: Real PGlite integration test validating data correctness or action wiring |
| 5   | **R**  | I         | should allow technician to invite a new user                                             | Retain: Real PGlite integration test validating data correctness or action wiring |
| 6   | **R**  | I         | should reject invite for existing active user                                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 7   | **R**  | I         | should reject invite when the email exists in auth.users beyond the first page (PP-a4st) | Retain: Real PGlite integration test validating data correctness or action wiring |
| 8   | **R**  | I         | should reject invite for already invited user                                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 9   | **R**  | I         | should throw error when email sending fails                                              | Retain: Real PGlite integration test validating data correctness or action wiring |
| 10  | **R**  | I         | should allow admin to resend an invitation                                               | Retain: Real PGlite integration test validating data correctness or action wiring |
| 11  | **R**  | I         | should throw error when resending fails                                                  | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/invited_users.test.ts`

| #   | Status | Bug Class | Test Name                                                                              | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | should insert and query an invited user                                                | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | should fetch unified users (active + invited)                                          | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | should sort unified users: active first, then by machine count desc, then by last name | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | should use deterministic tie-breakers (lastName, name, id)                             | Retain: Real PGlite integration test validating data correctness or action wiring |
| 5   | **R**  | I         | should return correct machineCount values                                              | Retain: Real PGlite integration test validating data correctness or action wiring |
| 6   | **R**  | I         | should enforce ownerCheck constraint on machines                                       | Retain: Real PGlite integration test validating data correctness or action wiring |
| 7   | **R**  | I         | should get correct machine owner via getMachineOwner helper                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 8   | **R**  | I         | should auto-link machines and issues when user signs up                                | Retain: Real PGlite integration test validating data correctness or action wiring |
| 9   | **R**  | I         | should transfer machines and issues via ensureUserProfile fallback                     | Retain: Real PGlite integration test validating data correctness or action wiring |
| 10  | **R**  | I         | should transfer role from invited user when creating profile                           | Retain: Real PGlite integration test validating data correctness or action wiring |
| 11  | **R**  | I         | should initialize notification preferences with current defaults                       | Retain: Real PGlite integration test validating data correctness or action wiring |
| 12  | **R**  | I         | should return real email addresses for active users when includeEmails is true         | Retain: Real PGlite integration test validating data correctness or action wiring |
| 13  | **R**  | I         | should return real email addresses for invited users when includeEmails is true        | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/issue-detail-permissions.test.ts`

| #   | Status | Bug Class | Test Name                                                                                                   | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | E         | returns unauthenticated reason for reporting updates when not logged in                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | E         | returns ownership reason for guest on another user's issue reporting fields                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | E         | returns role reason for guest triage updates                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | E         | allows member triage updates                                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | E         | allows guest to update reporting fields on their own issue                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | E         | denies guest triage updates even on their own issue                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | E         | allows member reporting updates on any issue                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | E         | allows updateIssueStatusAction for a member (issues.update.reporting = true for member)                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | E         | denies updateIssueStatusAction for a guest acting on another user's issue (issues.update.reporting = 'own') | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | E         | allows updateIssueFrequencyAction for a member (issues.update.reporting = true for member)                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/test/integration/machine-timeline-permissions.test.ts`

| #   | Status | Bug Class | Test Name                                                                      | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | **R**  | E         | inserts a comment with tag and author from current session                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | E         | rejects a reserved tag (lifecycle)                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | E         | rejects an unauthenticated user                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | E         | rejects a guest (member-only permission)                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | E         | author can delete own comment                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | E         | machine owner can delete another member's comment                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | E         | site admin can delete any comment                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | E         | non-author non-owner non-admin member CANNOT delete                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | E         | double-delete returns 'Already deleted' on the second call                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | E         | author can edit own comment — content and tag both update                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | E         | machine owner CANNOT edit another member's comment (own only)                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | E         | site admin CANNOT edit another member's comment (own only, no global override) | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | E         | non-author non-owner non-admin member CANNOT edit                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | E         | editing a soft-deleted comment is rejected                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | E         | editing rejects reserved tags (lifecycle, issue)                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/test/integration/person-card-route.test.ts`

| #   | Status | Bug Class | Test Name                                        | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | returns the card payload for an existing profile | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | 404s for an unknown id                           | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/profile-feed-queries.test.ts`

| #   | Status | Bug Class | Test Name                                                     | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | getUserTimeline returns the user's events, capped by limit    | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | resolveFeedMachineLabels maps machineId -> name/href/initials | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/profile-update-action.test.ts`

| #   | Status | Bug Class | Test Name                                                              | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | B         | updates the caller's own profile fields and redirects to the read view | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | B         | rejects an over-length first name                                      | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/profiles-queries.test.ts`

| #   | Status | Bug Class | Test Name                                                                             | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | getProfileById returns the public-safe row                                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | getProfileById returns null for unknown id                                            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | getProfileActivityCounts counts reported issues and comments                          | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | getCappedOwnedMachines caps at PROFILE_MACHINE_CAP and flags overflow                 | Retain: Real PGlite integration test validating data correctness or action wiring |
| 5   | **R**  | I         | getCappedOwnedMachines orders by most recently added                                  | Retain: Real PGlite integration test validating data correctness or action wiring |
| 6   | **R**  | I         | getProfileActivityCounts counts issues fixed by the user                              | Retain: Real PGlite integration test validating data correctness or action wiring |
| 7   | **R**  | I         | getProfileActivityCounts excludes non-resolved transitions and other users from fixed | Retain: Real PGlite integration test validating data correctness or action wiring |
| 8   | **R**  | I         | getOpenIssueCountsByInitials counts only open-status issues                           | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/supabase/auth-actions-errors.test.ts`

| #   | Status | Bug Class | Test Name                                                         | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | B         | should return SERVER error when user not authenticated            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | B         | should return VALIDATION error for password mismatch              | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | B         | should return VALIDATION error for weak password                  | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | B         | should return VALIDATION error for missing password               | Retain: Real PGlite integration test validating data correctness or action wiring |
| 5   | **R**  | B         | should return VALIDATION error for invalid email format           | Retain: Real PGlite integration test validating data correctness or action wiring |
| 6   | **R**  | B         | should return VALIDATION error for missing email                  | Retain: Real PGlite integration test validating data correctness or action wiring |
| 7   | **R**  | B         | should succeed even for non-existent email (prevents enumeration) | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/supabase/auth-actions.test.ts`

| #   | Status | Bug Class | Test Name                              | Rationale / Target Keeper                                                  |
| --- | ------ | --------- | -------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **F**  | B         | should create a new user with Supabase | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 2   | **F**  | B         | should reject duplicate email          | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 3   | **F**  | B         | should authenticate existing user      | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 4   | **F**  | B         | should reject wrong password           | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 5   | **F**  | B         | should reject non-existent email       | Fix: remove unsafe as any, verify origin fallback logic at action boundary |
| 6   | **F**  | B         | should sign out authenticated user     | Fix: remove unsafe as any, verify origin fallback logic at action boundary |

### `src/test/integration/supabase/auth-pages.test.ts`

| #   | Status | Bug Class | Test Name                                                                      | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | should detect authenticated user who should be redirected to dashboard         | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | should detect unauthenticated user who should see the form                     | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | should detect authenticated user (via reset link) who should see the form      | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | should detect unauthenticated user who should be redirected to forgot-password | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/integration/supabase/password-reset.test.ts`

| #   | Status | Bug Class | Test Name                                            | Rationale / Target Keeper                                                         |
| --- | ------ | --------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **R**  | I         | should send password reset email for existing user   | Retain: Real PGlite integration test validating data correctness or action wiring |
| 2   | **R**  | I         | should not reveal if email does not exist            | Retain: Real PGlite integration test validating data correctness or action wiring |
| 3   | **R**  | I         | should update password for authenticated user        | Retain: Real PGlite integration test validating data correctness or action wiring |
| 4   | **R**  | I         | should reject password update when not authenticated | Retain: Real PGlite integration test validating data correctness or action wiring |

### `src/test/unit/auth-validation.test.ts`

| #   | Status | Bug Class | Test Name                                                | Rationale / Target Keeper                                                 |
| --- | ------ | --------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **C**  | G         | should validate correct email and password               | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 2   | **C**  | G         | should validate with rememberMe option                   | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 3   | **C**  | G         | should reject invalid email format                       | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 4   | **C**  | G         | should reject empty password                             | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 5   | **C**  | G         | should reject missing email                              | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 6   | **C**  | G         | should validate correct name, email, password, and terms | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 7   | **C**  | G         | should trim whitespace from names                        | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 8   | **C**  | G         | should reject empty names                                | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 9   | **C**  | G         | should reject names longer than 50 characters            | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 10  | **C**  | G         | should reject invalid email format                       | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 11  | **C**  | G         | should reject password shorter than 8 characters         | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 12  | **C**  | G         | should reject password longer than 128 characters        | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 13  | **C**  | G         | should accept password exactly 8 characters              | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 14  | **C**  | G         | should accept password exactly 128 characters            | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 15  | **C**  | G         | should reject mismatched passwords                       | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 16  | **C**  | G         | should reject confirmPassword exceeding 128 characters   | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 17  | **C**  | G         | should reject when terms are not accepted                | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |
| 18  | **C**  | G         | should reject when terms field is missing                | Consolidate into colocated src/app/(auth)/schemas.test.ts (CORE-TEST-009) |

### `src/test/unit/components/auth/login-form.test.tsx`

| #   | Status | Bug Class | Test Name                        | Rationale / Target Keeper                           |
| --- | ------ | --------- | -------------------------------- | --------------------------------------------------- |
| 1   | **F**  | H         | renders correctly                | Fix: remove any[] type defeat in mock (CORE-TS-007) |
| 2   | **F**  | H         | shows loading state when pending | Fix: remove any[] type defeat in mock (CORE-TS-007) |

### `src/test/unit/components/issues/issue-detail-permissions.test.tsx`

| #   | Status | Bug Class | Test Name                                                                                       | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | shows every field read-only to a signed-out visitor, with the watcher count but no Watch toggle | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | lets a member change every field                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | lets a guest change only the reporting fields, only on their own issue                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | shows the context rows in order, linking the owner to their machines' issues                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | G         | shows an invited reporter's name in Reported as plain text                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | G         | links the assignee's name to their profile after a screen-reader prefix                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | G         | states Unassigned as plain text                                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | G         | shows a login prompt instead of the comment box when signed out                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | G         | shows the comment box, not the login prompt, to a signed-in %s                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | G         | writes a system event as one line: who, what changed, when                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | G         | shows the empty state while there are no comments, even with system events                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | G         | Comments only hides system events and starts off                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | G         | names the timestamp triggers before hydration without a zone-dependent attribute                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | G         | names each comment by its author and time                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | G         | announces what Comments only leaves showing                                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 16  | **R**  | G         | lists entries in order and offers Comments only only when there are entries                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 17  | **R**  | G         | says which comment the actions button belongs to                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 18  | **R**  | G         | Edit focuses the editor; Cancel returns focus to the actions button                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 19  | **R**  | G         | asks before leaving the page with an unsaved edit                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 20  | **R**  | G         | canceling a delete returns focus to the actions button                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 21  | **R**  | G         | a completed delete moves focus to the Activity heading                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/test/unit/components/people/person-hover-card.test.tsx`

| #   | Status | Bug Class | Test Name                                      | Rationale / Target Keeper                                                                 |
| --- | ------ | --------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **C**  | H         | renders plain text (no link) for a null userId | Consolidate into colocated src/components/people/PersonHoverCard.test.tsx (CORE-TEST-009) |
| 2   | **C**  | H         | links the trigger to the profile page          | Consolidate into colocated src/components/people/PersonHoverCard.test.tsx (CORE-TEST-009) |
| 3   | **C**  | H         | shows a capitalized role pill after fetch      | Consolidate into colocated src/components/people/PersonHoverCard.test.tsx (CORE-TEST-009) |

### `src/test/unit/components/profiles/profile-hero.test.tsx`

| #   | Status | Bug Class | Test Name                                        | Rationale / Target Keeper                                    |
| --- | ------ | --------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 1   | **R**  | H         | shows name, pronouns, role pill and member-since | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 2   | **R**  | H         | shows the Edit link only for the owner           | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |

### `src/test/unit/components/profiles/profile-stat-grid.test.tsx`

| #   | Status | Bug Class | Test Name                                 | Rationale / Target Keeper                                    |
| --- | ------ | --------- | ----------------------------------------- | ------------------------------------------------------------ |
| 1   | **R**  | H         | renders all four stats with labels        | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |
| 2   | **R**  | H         | links the machines tile to the collection | Retain: UI state and form lifecycle (CORE-FORM-_, CORE-UI-_) |

### `src/test/unit/components/settings/delete-account-failed-save-revert.test.tsx`

| #   | Status | Bug Class | Test Name                                                  | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | keeps the chosen new owner selected after the action fails | Retain: Pure logic / unit validation of authentication or authorization rules |

### `src/test/unit/permissions-helpers.test.ts`

| #   | Status | Bug Class | Test Name                                                                                                             | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | should return unauthenticated for null/undefined                                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | should return the role for valid roles                                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | should return true for simple allowed permissions                                                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | should return false for denied permissions                                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | G         | should allow guest to update own issue                                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | G         | should deny guest updating others issue                                                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | G         | should allow member to edit their own machine                                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | G         | should deny member editing others machine                                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | G         | should deny if no context provided for conditional permission                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | G         | should resolve machines.settings.manage by ownership for members (PP-43q3)                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | G         | should resolve machines.settings.setDefault by ownership for members and technicians, and grant to admins (PP-leli.8) | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | G         | should resolve machines.settings.view.private to admin only (PP-leli.8)                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | G         | should deny if userId not provided for conditional permission                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | G         | should allow technician to create machines                                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | G         | should allow technician to edit any machine without ownership                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 16  | **R**  | G         | should handle null reporterId/machineOwnerId                                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 17  | **R**  | G         | should return allowed: true for granted permissions                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 18  | **R**  | G         | should return reason: unauthenticated for unauthenticated users                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 19  | **R**  | G         | should return reason: role for role-based denial                                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 20  | **R**  | G         | should return reason: ownership for ownership-based denial                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 21  | **R**  | G         | should return allowed: true for ownership match                                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 22  | **R**  | G         | should return null for granted permissions                                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 23  | **R**  | G         | should return login message for unauthenticated users                                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 24  | **R**  | G         | should return member message for guest role denial                                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 25  | **R**  | G         | should return technician/admin message for member role denial                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 26  | **R**  | G         | should return admin message for technician role denial                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 27  | **R**  | G         | should return ownership message for ownership denial                                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 28  | **R**  | G         | should return true if all permissions are granted                                                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 29  | **R**  | G         | should return false if any permission is denied                                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 30  | **R**  | G         | should return true for empty array                                                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 31  | **R**  | G         | should return true if any permission is granted                                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 32  | **R**  | G         | should return false if no permission is granted                                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 33  | **R**  | G         | should return false for empty array                                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 34  | **R**  | G         | should return true for own-based permissions                                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 35  | **R**  | G         | should return true for owner-based permissions                                                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 36  | **R**  | G         | should return false for boolean permissions                                                                           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 37  | **R**  | G         | should allow guest to edit own comment via ownership check                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 38  | **R**  | G         | should deny guest editing others comments                                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 39  | **R**  | G         | should allow member to edit/delete only own comments                                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 40  | **R**  | G         | should allow technician to edit/delete only own comments                                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 41  | **R**  | G         | should allow admin to edit/delete only own comments                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 42  | **R**  | G         | should deny unauthenticated from editing any comment                                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 43  | **R**  | G         | should allow any authenticated user to view ownerRequirements                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 44  | **R**  | G         | should deny unauthenticated users from viewing ownerRequirements                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 45  | **R**  | G         | allows the comment author to delete (reporterId match)                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 46  | **R**  | G         | allows the machine owner to delete any comment (machineOwnerId match)                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 47  | **R**  | G         | denies a third party who is neither author nor machine owner                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 48  | **R**  | G         | denies when context.userId is undefined                                                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 49  | **R**  | G         | denies when no context is provided                                                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 50  | **R**  | G         | denies when both reporterId and machineOwnerId are null                                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 51  | **R**  | G         | admin override: admins always allowed without ownership context                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 52  | **R**  | G         | denies guest and unauthenticated regardless of authorship                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 53  | **R**  | G         | technician with own_or_owner scope: author path allowed                                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 54  | **R**  | G         | technician with own_or_owner scope: machine-owner path allowed                                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 55  | **R**  | G         | technician with own_or_owner scope: third party denied                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 56  | **R**  | G         | returns allowed: true on author path                                                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 57  | **R**  | G         | returns allowed: true on machine-owner path                                                                           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 58  | **R**  | G         | returns reason: ownership for third party                                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 59  | **R**  | G         | returns true for own_or_owner permissions                                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 60  | **R**  | G         | returns false for admin (which has true, not own_or_owner)                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 61  | **R**  | G         | denies unauthenticated and guest                                                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 62  | **R**  | G         | allows member, technician, and admin without ownership context                                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 63  | **R**  | G         | should allow guest to update reporting fields on own issue                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 64  | **R**  | G         | should deny guest triage fields even on own issue                                                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 65  | **R**  | G         | should allow member to update any issue (both tiers)                                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/test/unit/permissions-matrix.test.ts`

| #   | Status | Bug Class | Test Name                                                                                                  | Rationale / Target Keeper                                                          |
| --- | ------ | --------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **R**  | G         | should define all five access levels in order                                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 2   | **R**  | G         | should have labels for all access levels                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 3   | **R**  | G         | should have descriptions for all access levels                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 4   | **R**  | G         | should have all expected categories                                                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 5   | **R**  | G         | should have valid permission definitions                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 6   | **R**  | G         | should have unique permission IDs                                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 7   | **R**  | G         | should contain all permissions from the matrix                                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 8   | **R**  | G         | should return correct permission values                                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 9   | **R**  | G         | should return false for unknown permissions                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 10  | **R**  | G         | should return conditional values for ownership-based permissions                                           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 11  | **R**  | G         | should return true for simple allowed permissions                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 12  | **R**  | G         | should return false for denied permissions                                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 13  | **R**  | G         | should throw for ownership-based permissions to prevent silent bugs                                        | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 14  | **R**  | G         | should return true for ownership-based permissions                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 15  | **R**  | G         | should return false for simple boolean permissions                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 16  | **R**  | G         | should grant admin all permissions that technician has (except excluded)                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 17  | **R**  | G         | should grant technician all permissions that member has                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 18  | **R**  | G         | should grant member all permissions that guest has                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 19  | **R**  | G         | should allow anyone to report issues                                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 20  | **R**  | G         | should only allow members+ to set workflow fields when reporting                                           | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 21  | **R**  | G         | should allow guests to update reporting fields on their own issues                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 22  | **R**  | G         | should not allow guests to triage issues                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 23  | **R**  | G         | should allow members and technicians full update access                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 24  | **R**  | G         | denies reassign to unauthenticated and guest                                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 25  | **R**  | G         | requires machine ownership for members                                                                     | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 26  | **R**  | G         | grants unconditional reassign to technicians and admins                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 27  | **R**  | G         | resolves owner condition via OwnershipContext.machineOwnerId                                               | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 28  | **R**  | G         | should allow viewing comments by anyone                                                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 29  | **R**  | G         | should require authentication to add comments                                                              | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 30  | **R**  | G         | should only allow editing own comments for all roles                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 31  | **R**  | G         | should only allow deleting own comments for all roles                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 32  | **R**  | G         | should only allow admin to delete others comments                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 33  | **R**  | G         | should allow admin and technician to create machines                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 34  | **R**  | G         | should allow machine owners, technicians, and admins to edit machines                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 35  | **R**  | G         | allows members to export saved apron cards without edit permission                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 36  | **R**  | G         | should allow only machine owners and admins to delete machines                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 37  | **R**  | G         | should mirror machines.edit for PinballMap linking (owner/tech/admin)                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 38  | **R**  | G         | should allow machine owners, technicians and admins to push to Pinball Map                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 39  | **R**  | G         | should let only technicians and admins confirm the Pinball Map lineup                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 40  | **R**  | G         | should let any member refresh the Pinball Map lineup                                                       | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 41  | **R**  | G         | should require authentication to watch machines                                                            | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 42  | **R**  | G         | should allow owners, technicians, and admins to manage settings (PP-43q3)                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 43  | **R**  | G         | should restrict setting owner default to machine owners and admins (PP-leli.8)                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 44  | **R**  | G         | should restrict viewing private settings drafts to admins (PP-leli.8)                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 45  | **R**  | G         | should define machines.timeline.comment.add: members+ can post (PP-0x98)                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 46  | **R**  | G         | should define machines.timeline.comment.delete: own_or_owner for non-admin roles, true for admin (PP-0x98) | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 47  | **R**  | G         | should allow authenticated users to view ownerRequirements                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 48  | **R**  | G         | should only allow admin to access admin panel and manage roles                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 49  | **R**  | G         | should allow technician and admin to invite users                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 50  | **R**  | G         | should allow technician and admin to promote guests to members                                             | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 51  | **R**  | G         | should keep admin.users.roles admin-only (not accessible by technician)                                    | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 52  | **R**  | G         | should be included in getGrantedPermissions for technician                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 53  | **R**  | G         | should be included in getGrantedPermissions for admin                                                      | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 54  | **R**  | G         | should NOT be included in getGrantedPermissions for member                                                 | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 55  | **R**  | G         | should NOT be included in getGrantedPermissions for guest                                                  | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 56  | **R**  | G         | should exist in PERMISSIONS_BY_ID                                                                          | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 57  | **R**  | G         | is defined in the matrix                                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 58  | **R**  | G         | grants only admin access                                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 59  | **R**  | G         | is granted to member, technician, and admin                                                                | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 60  | **R**  | G         | is registered in PERMISSIONS_BY_ID                                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 61  | **R**  | G         | grants only admin access                                                                                   | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |
| 62  | **R**  | G         | is registered in PERMISSIONS_BY_ID                                                                         | Retain: Permission capability matrix / gate contract (CORE-ARCH-008, CORE-SEC-001) |

### `src/test/unit/role-defaults.test.ts`

| #   | Status | Bug Class | Test Name                                    | Rationale / Target Keeper                                                     |
| --- | ------ | --------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | **R**  | G         | should default to 'guest' for new signups    | Retain: Pure logic / unit validation of authentication or authorization rules |
| 2   | **R**  | G         | should have valid enum values                | Retain: Pure logic / unit validation of authentication or authorization rules |
| 3   | **R**  | G         | should default to 'member' for invited users | Retain: Pure logic / unit validation of authentication or authorization rules |
| 4   | **R**  | G         | should have valid enum values                | Retain: Pure logic / unit validation of authentication or authorization rules |
