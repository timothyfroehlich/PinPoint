# Production E2E Tests

## Status: Multi-Org Only (Currently Skipped)

These tests are designed for **multi-organization subdomain architecture** which is not implemented in the current **Alpha Single-Org Mode**.

## Why These Tests Are Skipped

PinPoint is currently in alpha mode with a single organization (Austin Pinball Collective). The following multi-tenant features are **not yet implemented**:

1. **Subdomain routing** - No subdomain-based organization routing in middleware
2. **Organization selection UI** - Sign-in form has hardcoded single organization
3. **Host-based org locking** - Custom domains don't lock to specific orgs yet

## Test Files

### `apc-alias-host-behavior.e2e.test.ts`

Tests custom domain behavior for APC's production domain.

**Tests:**

- ✅ Root redirects to sign-in (ACTIVE)
- ⏭️ Sign-in hides org dropdown (SKIPPED - no dropdown in alpha)

### `generic-host-behavior.e2e.test.ts`

Tests generic PinPoint host with landing page and org selection.

**Tests:**

- ✅ Landing page and CTA (ACTIVE)
- ⏭️ Sign-in shows org dropdown (SKIPPED - no dropdown in alpha)

### `pre-beta-user-testing-auth.e2e.test.ts`

Tests dev authentication in production environments.

**Tests:**

- ✅ All tests ACTIVE (skip if dev login unavailable)

## When to Re-enable

These tests should be re-enabled when:

1. Multi-tenant architecture is implemented post-alpha
2. Middleware includes subdomain routing logic
3. Sign-in form includes organization selection UI
4. Host-based organization locking is functional

## Migration Path

See the archived subdomain implementation documentation:

- `docs/archive/subdomain-multitenancy-implementation.md`
- `docs/planning/single-org-alpha-simplification.md`

To restore multi-org functionality, follow the migration plan in those documents and remove the `test.skip()` calls from the skipped tests.
