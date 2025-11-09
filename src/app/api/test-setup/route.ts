/**
 * Test Setup API - E2E Test Helpers
 *
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * This API provides direct database access for E2E test setup WITHOUT any
 * authentication, authorization, or organization access validation.
 *
 * ENVIRONMENT RESTRICTIONS:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✓ ONLY for use in isolated E2E test environments
 * ✓ Assumes single-tenant test database (one test run = one database)
 * ✗ NO authentication or authorization checks
 * ✗ NO organization access validation
 * ✗ NO RLS policy enforcement on mutations
 *
 * SECURITY IMPLICATIONS:
 * ━━━━━━━━━━━━━━━━━━━━━━━
 * - Direct database mutations bypass ALL security boundaries
 * - Can modify ANY organization's data regardless of caller identity
 * - Can cause data corruption in shared/multi-tenant environments
 * - Violates CORE-SEC-001 (organization scoping) by design
 * - If exposed in production, can cause catastrophic data loss
 *
 * WHY NO ORGANIZATION SCOPING?
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━
 * This API intentionally violates organization scoping rules because:
 * 1. E2E tests run in isolated environments (one test = one database)
 * 2. Tests need to manipulate state across organization boundaries
 * 3. Test setup happens before authentication exists in the test flow
 * 4. Enforcing scoping would require complex test authentication setup
 * 5. Isolation provides security instead of access controls
 *
 * BUILD-TIME EXCLUSION:
 * ━━━━━━━━━━━━━━━━━━━━
 * - Conditionally exports handlers based on NODE_ENV
 * - Production builds only export a 404 handler
 * - Bundler can tree-shake all test setup logic from production
 * - Runtime environment check provides defense-in-depth
 *
 * SAFE USAGE PATTERNS:
 * ━━━━━━━━━━━━━━━━━━━━
 * ✓ Playwright E2E tests with isolated test database
 * ✓ Local development with `npm run db:reset` between runs
 * ✓ CI environments with ephemeral databases
 * ✓ Docker containers with database per test suite
 *
 * UNSAFE USAGE PATTERNS (DO NOT USE):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✗ Shared development databases with multiple developers
 * ✗ Staging environments with real/shared data
 * ✗ Any multi-tenant environment
 * ✗ Production (prevented by build-time exclusion + runtime check)
 * ✗ Integration tests that share database state
 *
 * TECHNICAL DETAILS:
 * ━━━━━━━━━━━━━━━━━━
 * - Direct Drizzle ORM access bypasses RLS policies
 * - No session validation or user context
 * - Organization IDs accepted as raw input without validation
 * - Machine IDs accepted without ownership checks
 * - State mutations are immediate and permanent
 *
 * ACTIONS PROVIDED:
 * ━━━━━━━━━━━━━━━━━
 * - enableAnonymousReporting: Enable org-wide anonymous issue creation
 * - ensureQRCode: Generate/retrieve QR code for machine
 * - findIssue: Query issues by title without scoping
 * - captureState: Snapshot machine/org state for restoration
 * - restoreState: Restore previously captured state
 *
 * @see {@link https://github.com/user/PinPoint/issues/3} - Security review findings
 * @see docs/CORE/NON_NEGOTIABLES.md - CORE-SEC-001 organization scoping requirement
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import {
  captureStateSnapshot,
  enableAnonymousReportingMutation,
  ensureQrCodeMutation,
  findIssueByTitle,
  restoreStateMutation,
  type TestSetupState,
} from "~/lib/test-support/test-setup-service";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Security: Verify environment
function isTestEnvironment(): boolean {
  return env.NODE_ENV !== "production" || env.CI === "true";
}

// Security: Block in production
function ensureTestEnvironment(): void {
  if (!isTestEnvironment()) {
    throw new Error("Test setup API is only available in test environments");
  }
}

// Security: Organization allowlist - only permit test org
function isAllowedOrganization(organizationId: string): boolean {
  return (
    organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary ||
    organizationId === SEED_TEST_IDS.ORGANIZATIONS.competitor
  );
}

// Security: Validate organization access
function ensureAllowedOrganization(organizationId: string): void {
  if (!isAllowedOrganization(organizationId)) {
    throw new Error(
      `Test setup API only allows operations on test organizations. ` +
        `Requested: ${organizationId}, Allowed: ${SEED_TEST_IDS.ORGANIZATIONS.primary}, ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`,
    );
  }
}

interface EnableAnonReportingRequest {
  action: "enableAnonymousReporting";
  machineId: string;
  organizationId: string;
  statusId?: string; // Optional: set default status
  priorityId?: string; // Optional: set default priority
}

interface EnsureQRCodeRequest {
  action: "ensureQRCode";
  machineId: string;
}

interface FindIssueRequest {
  action: "findIssue";
  title: string;
}

interface CaptureStateRequest {
  action: "captureState";
  machineId: string;
  organizationId: string;
  statusId?: string;
  priorityId?: string;
}

interface RestoreStateRequest {
  action: "restoreState";
  machineId: string;
  organizationId: string;
  state: TestSetupState;
}

type TestSetupRequest =
  | EnableAnonReportingRequest
  | EnsureQRCodeRequest
  | FindIssueRequest
  | CaptureStateRequest
  | RestoreStateRequest;

/**
 * Production handler: Returns 404 to exclude test setup API from production
 * This allows tree-shaking to remove all test setup logic from production bundles
 */
function productionPOSTHandler(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

/**
 * Development/Test handler: Full test setup API implementation
 * Only bundled in non-production builds
 *
 * ⚠️ WARNING: All operations in this handler perform direct database mutations
 * without authentication or organization scoping validation.
 */
async function developmentPOSTHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // Defense-in-depth: Runtime check in case of misconfiguration
    ensureTestEnvironment();

    const body = (await request.json()) as TestSetupRequest;

    switch (body.action) {
      case "enableAnonymousReporting": {
        /**
         * Enable Anonymous Reporting
         *
         * Modifies organization and machine settings to allow anonymous issue creation.
         *
         * SECURITY: Organization allowlist validation
         * - Only permits test organizations (test-org-pinpoint, test-org-competitor)
         * - Test orgs only exist in dev/preview environments (not production)
         * - Physical database constraint prevents production misuse
         * - Directly mutates organization settings bypassing RLS policies
         *
         * Safe only in isolated test environments where:
         * - Single tenant per database
         * - No shared data between tests
         * - Database reset between test runs
         */
        ensureAllowedOrganization(body.organizationId);

        await enableAnonymousReportingMutation({
          machineId: body.machineId,
          organizationId: body.organizationId,
          ...(body.statusId ? { statusId: body.statusId } : {}),
          ...(body.priorityId ? { priorityId: body.priorityId } : {}),
        });

        return NextResponse.json({ success: true });
      }

      case "ensureQRCode": {
        /**
         * Ensure QR Code Exists
         *
         * Generates or retrieves QR code for a machine.
         *
         * ⚠️ SECURITY VIOLATION: No machine ownership validation
         * - Accepts machineId as raw input without checking ownership
         * - Can generate QR codes for ANY machine in the database
         * - No verification that caller has access to this machine
         */
        const qrCodeId = await ensureQrCodeMutation(body.machineId);

        return NextResponse.json({ qrCodeId });
      }

      case "findIssue": {
        /**
         * Find Issue by Title
         *
         * Queries issues across ALL organizations without scoping.
         *
         * ⚠️ SECURITY VIOLATION: No organization scoping
         * - Searches ALL issues in database regardless of organization
         * - Can find issues from ANY organization
         * - Potential data leakage if used in shared environments
         */

        // WARNING: Query issues without organization scoping
        // Violates CORE-SEC-001: Returns issues from ANY organization
        const issueId = await findIssueByTitle(body.title);
        if (!issueId) {
          return NextResponse.json({ found: false, issueId: null });
        }

        return NextResponse.json({ found: true, issueId });
      }

      case "captureState": {
        /**
         * Capture State
         *
         * Snapshots current machine and organization state for later restoration.
         *
         * SECURITY: Organization allowlist validation
         * - Only permits test organizations (test-org-pinpoint, test-org-competitor)
         * - Test orgs only exist in dev/preview environments (not production)
         * - Exposes internal state without authorization
         */
        ensureAllowedOrganization(body.organizationId);

        const state = await captureStateSnapshot({
          machineId: body.machineId,
          organizationId: body.organizationId,
        });

        return NextResponse.json(state);
      }

      case "restoreState": {
        /**
         * Restore State
         *
         * Restores previously captured machine and organization state.
         *
         * SECURITY: Organization allowlist validation
         * - Only permits test organizations (test-org-pinpoint, test-org-competitor)
         * - Test orgs only exist in dev/preview environments (not production)
         * - Direct state mutation bypassing all security controls
         */
        ensureAllowedOrganization(body.organizationId);

        await restoreStateMutation({
          machineId: body.machineId,
          organizationId: body.organizationId,
          state: body.state,
        });

        return NextResponse.json({ success: true });
      }

      default: {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
    }
  } catch (error) {
    console.error("Test setup API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Conditional export: Use production 404 handler in production builds,
 * full test setup handler in development/test builds.
 *
 * This enables tree-shaking to remove all test setup code from production bundles.
 */
export const POST =
  env.NODE_ENV === "production"
    ? productionPOSTHandler
    : developmentPOSTHandler;
