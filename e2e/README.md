# PinPoint E2E Tests

## Current Status: Alpha Single-Org Mode

These tests are written for PinPoint in **Alpha Single-Org Mode**, where the application is hardcoded to Austin Pinball Collective (APC) organization.

## Test Structure

```
e2e/
├── auth.setup.ts                     # Authentication setup (creates user session)
├── auth-redirect.e2e.test.ts        # Unauthenticated access security tests
├── smoke-tests-auth.e2e.test.ts     # Authenticated user smoke tests
└── prod/                             # Production-specific tests (some skipped)
    ├── README.md                     # Multi-org test documentation
    ├── apc-alias-host-behavior.e2e.test.ts
    ├── generic-host-behavior.e2e.test.ts
    └── pre-beta-user-testing-auth.e2e.test.ts
```

## Running Tests

### All Tests
```bash
npm run e2e
```

### Specific Test File
```bash
npx playwright test e2e/smoke-tests-auth.e2e.test.ts
```

### With UI
```bash
npx playwright test --ui
```

### Debug Mode
```bash
npx playwright test --debug
```

## Test Categories

### 1. Authentication Setup (`auth.setup.ts`)
- **Purpose:** Creates authenticated user session for other tests
- **Output:** `e2e/.auth/user.json` with Tim dev user session
- **Run First:** This must succeed for authenticated tests to work

### 2. Auth Security Tests (`auth-redirect.e2e.test.ts`)
- **Purpose:** Verify unauthenticated users can't access protected routes
- **Tests:**
  - Unauthenticated access to /issues → redirect or error
  - Unauthenticated access to /dashboard → redirect or error
  - ⏭️ Subdomain redirect (SKIPPED - not in alpha mode)

### 3. Smoke Tests (`smoke-tests-auth.e2e.test.ts`)
- **Purpose:** Verify core authenticated user flows work
- **Tests:**
  - Dashboard access
  - View issues list
  - Open first issue
  - Create new issue (full flow with submission)

### 4. Production Tests (`prod/`)
- **Purpose:** Test production-specific behavior
- **Status:** Some tests skipped for multi-org features
- **See:** [prod/README.md](prod/README.md) for details

## Test Data Dependencies

All tests rely on seeded database data:

### Required Seed Data
- **Users:** Tim dev user (`tim.froehlich@example.com`)
- **Organization:** APC (`test-org-pinpoint`)
- **Issues:** At least one issue for list/detail tests
- **Machines:** At least one machine for issue creation

### Reset Database
```bash
npm run db:reset
```

This will re-seed all test data.

## Playwright Configuration

### Development Config (`playwright.config.ts`)
- **Base URL:** `http://localhost:3000`
- **Auto-starts:** Dev server (`npm run dev`)
- **Projects:**
  - `auth-setup`: Creates auth state
  - `chromium`, `firefox`, `webkit`: Unauthenticated browsers
  - `chromium-auth`, `firefox-auth`, `webkit-auth`: Authenticated browsers

### Production Config (`playwright.prod.config.ts`)
- **No auto-start:** Tests deployed environments
- **URLs:**
  - Generic: `PROD_GENERIC_URL` (default: pinpoint-tracker.vercel.app)
  - APC Alias: `PROD_APC_URL` (default: pinpoint.austinpinballcollective.org)

## Test Patterns

### ✅ Good Patterns
- Use `data-testid` attributes for element selection
- Use relative URLs (`/issues` not `http://localhost:3000/issues`)
- Use Playwright's built-in waiters (`waitForURL`, `toBeVisible`)
- Keep tests focused on user-visible behavior

### ❌ Anti-Patterns
- Hardcoded absolute URLs with subdomains
- Polling loops instead of proper waiters
- Excessive diagnostic collection in tests
- Testing implementation details instead of behavior

## Alpha Mode Limitations

### Not Tested (Multi-Org Features)
- ⏭️ Subdomain routing (`apc.localhost:3000`)
- ⏭️ Organization selection in sign-in
- ⏭️ Host-based organization locking
- ⏭️ Multi-organization access patterns

These features are preserved in archived documentation and will be re-enabled post-alpha.

## Troubleshooting

### Tests Timing Out
- Ensure dev server is running (`npm run dev`)
- Check database is seeded (`npm run db:reset`)
- Verify test data exists in database

### Authentication Failures
- Delete `e2e/.auth/user.json` and re-run auth setup
- Reset database to ensure dev users exist
- Check Supabase is running (`supabase status`)

### "Element not found" Errors
- Verify seed data exists (issues, machines)
- Check `data-testid` attributes in components
- Use Playwright trace viewer: `npx playwright show-trace <trace.zip>`

## Future Multi-Org Mode

When multi-tenant features are implemented:
1. Remove `test.skip()` from multi-org tests
2. Update environment to remove `ALPHA_ORG_ID`
3. Re-enable subdomain routing in middleware
4. Restore organization selection UI

See migration documentation:
- `docs/archive/subdomain-multitenancy-implementation.md`
- `docs/planning/single-org-alpha-simplification.md`
