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

## Port Requirements & Conflicts

### Default Port: 3000

E2E tests run on **port 3000** by default (configured in `.env.test`). This ensures:
- ✅ Consistent test URLs across environments
- ✅ No localhost subdomain routing issues
- ✅ Predictable authentication callbacks

### Port Conflict Resolution

If port 3000 is already in use (e.g., your dev server is running):

**Option 1: Stop Dev Server (Recommended)**
```bash
# Stop your dev server before running tests
npm run e2e
```

**Option 2: Use Alternate Port**
```bash
# Override port in .env.test temporarily
PORT=3100 npm run e2e
```

**Option 3: CI Mode (No Server Reuse)**
```bash
# Force fresh server start (slower)
CI=true npm run e2e
```

### Why Not `reuseExistingServer`?

Currently disabled (`reuseExistingServer: false`) to ensure clean test state. This prevents:
- ❌ Stale middleware state
- ❌ Module cache pollution
- ❌ Environment variable contamination

**Future:** May re-enable with `!process.env.CI` flag once test isolation is verified.

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

## Database State Management

### Architecture: Snapshot-Based Fast Restore

**Old Problem:** Re-seeding took 25-65 seconds on every test run, causing:
- Slow test startup
- Race conditions and timeouts
- Port binding conflicts
- Process management nightmares

**New Solution:** Database snapshots restore in 2-5 seconds (10-20x faster)

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ ONE-TIME SETUP (manual, when schema/seeds change)          │
├─────────────────────────────────────────────────────────────┤
│ 1. npm run db:reset                      (25-65s)           │
│ 2. npm run e2e:snapshot:create           (2s)               │
│    → e2e/fixtures/test-database.dump                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ EVERY TEST RUN (automatic, fast)                           │
├─────────────────────────────────────────────────────────────┤
│ global-setup.ts:                                            │
│   1. Restore snapshot via pg_restore     (2-5s)             │
│   2. Verify health endpoint              (1s)               │
│                                                              │
│ webServer:                                                   │
│   1. Start/reuse dev server              (0-10s)            │
│                                                              │
│ Tests run (parallel, fast)                                  │
│                                                              │
│ Total startup: 8-16s (down from 35-95s)                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **Snapshot Scripts**
```bash
# Create snapshot (after schema changes)
npm run e2e:snapshot:create

# Restore snapshot (automatic in globalSetup)
npm run e2e:snapshot:restore
```

**Scripts:**
- [`scripts/e2e-snapshot-create.sh`](../scripts/e2e-snapshot-create.sh) - `pg_dump` wrapper
- [`scripts/e2e-snapshot-restore.sh`](../scripts/e2e-snapshot-restore.sh) - `pg_restore` wrapper
- Snapshot stored at: [`e2e/fixtures/test-database.dump`](fixtures/) (gitignored, ~268KB)

#### 2. **Global Setup**
[`e2e/global-setup.ts`](global-setup.ts) runs **once before all tests**:
1. Restores database snapshot (2-5s)
2. Verifies database health via `/api/health/ready`
3. Exits if database not ready (explicit failure)

**Separation of Concerns:**
- ✅ Database state: Managed in `globalSetup`
- ✅ Server lifecycle: Managed in `webServer` config
- ✅ Authentication: Managed in `auth.setup.ts`

#### 3. **Health Check Endpoint**
[`/api/health/ready`](../src/app/api/health/ready/route.ts) uses row count validation:

```typescript
// Checks minimum thresholds (no data exposure)
const MINIMUM_THRESHOLDS = {
  organizations: 2,  // APC + PinPoint
  users: 3,          // Tim, Alice, Bob
  memberships: 3,
  roles: 6,
  priorities: 8,
  issue_statuses: 14,
  machines: 7,
  issues: 10,
};
```

**Security:**
- ✅ Only available in dev/test (404 in production)
- ✅ No actual database records exposed
- ✅ Single optimized SQL query (COUNT)
- ✅ Returns boolean checks only

### Manual Operations

```bash
# After schema changes, recreate snapshot
npm run db:reset && npm run e2e:snapshot:create

# Manual restore (for debugging)
npm run e2e:snapshot:restore

# Check database health
curl http://localhost:3000/api/health/ready
```

### Benefits

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Startup Time** | 35-95s | 8-16s | **4-10x faster** |
| **Local Dev** | Full rebuild | Reuse server | **∞x faster** |
| **Race Conditions** | Common | Eliminated | **100% reliable** |
| **Process Management** | Fragile | Robust | **No hung processes** |
| **Debugging** | Hard | Easy | **Clear errors** |

### Industry Standard

This pattern is used by:
- ✅ Supabase's own E2E tests (`pg_dump`/`pg_restore`)
- ✅ Vercel Next.js tests (Docker volumes)
- ✅ Playwright documentation recommendations
- ✅ Rails, Django, and other mature frameworks

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
