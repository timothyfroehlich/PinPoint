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

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import {
  machines,
  organizations,
  issueStatuses,
  priorities,
  issues,
} from "~/server/db/schema";
import { randomUUID } from "crypto";

// Security: Verify environment
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development" ||
    process.env.E2E_TEST === "true"
  );
}

// Security: Block in production
function ensureTestEnvironment(): void {
  if (!isTestEnvironment()) {
    throw new Error("Test setup API is only available in test environments");
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
  state: {
    machine: { qrCodeId: string | null; isPublic: boolean | null };
    organization: {
      allowAnonymousIssues: boolean;
      isPublic: boolean | null;
    };
    statusDefaults?: boolean;
    priorityDefaults?: boolean;
  };
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
async function productionPOSTHandler(): Promise<NextResponse> {
  return new NextResponse(null, { status: 404 });
}

/**
 * Development/Test handler: Full test setup API implementation
 * Only bundled in non-production builds
 *
 * ⚠️ WARNING: All operations in this handler perform direct database mutations
 * without authentication or organization scoping validation.
 */
async function developmentPOSTHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Defense-in-depth: Runtime check in case of misconfiguration
    ensureTestEnvironment();

    const body: TestSetupRequest = await request.json();

    switch (body.action) {
      case "enableAnonymousReporting": {
        /**
         * Enable Anonymous Reporting
         *
         * Modifies organization and machine settings to allow anonymous issue creation.
         *
         * ⚠️ SECURITY VIOLATION: No organization access validation
         * - Accepts organizationId as raw input without checking caller permissions
         * - Directly mutates organization settings bypassing RLS policies
         * - Can enable anonymous reporting for ANY organization
         *
         * Safe only in isolated test environments where:
         * - Single tenant per database
         * - No shared data between tests
         * - Database reset between test runs
         */

        // WARNING: Direct organization mutation without access validation
        // Violates CORE-SEC-001: Organization scoping requirement
        await db
          .update(organizations)
          .set({
            allow_anonymous_issues: true,
            is_public: true,
            updated_at: new Date(),
          })
          .where(eq(organizations.id, body.organizationId));

        // WARNING: Direct machine mutation without ownership validation
        await db
          .update(machines)
          .set({
            is_public: true,
            updated_at: new Date(),
          })
          .where(eq(machines.id, body.machineId));

        // Set default status if provided
        if (body.statusId) {
          // WARNING: Modifies ALL statuses in organization without scoping check
          await db
            .update(issueStatuses)
            .set({ is_default: false })
            .where(eq(issueStatuses.organization_id, body.organizationId));

          await db
            .update(issueStatuses)
            .set({ is_default: true })
            .where(
              and(
                eq(issueStatuses.id, body.statusId),
                eq(issueStatuses.organization_id, body.organizationId),
              ),
            );
        }

        // Set default priority if provided
        if (body.priorityId) {
          // WARNING: Modifies ALL priorities in organization without scoping check
          await db
            .update(priorities)
            .set({ is_default: false })
            .where(eq(priorities.organization_id, body.organizationId));

          await db
            .update(priorities)
            .set({ is_default: true })
            .where(
              and(
                eq(priorities.id, body.priorityId),
                eq(priorities.organization_id, body.organizationId),
              ),
            );
        }

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

        // WARNING: Query any machine without ownership validation
        const [machine] = await db
          .select({ qr_code_id: machines.qr_code_id })
          .from(machines)
          .where(eq(machines.id, body.machineId));

        if (machine?.qr_code_id) {
          return NextResponse.json({ qrCodeId: machine.qr_code_id });
        }

        // Generate new QR code ID
        const qrCodeId = `qr-${randomUUID()}`;

        // WARNING: Direct machine mutation without ownership validation
        await db
          .update(machines)
          .set({
            qr_code_id: qrCodeId,
            qr_code_url: null,
            qr_code_generated_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(machines.id, body.machineId));

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
        const [issue] = await db
          .select({ id: issues.id })
          .from(issues)
          .where(eq(issues.title, body.title))
          .orderBy(issues.created_at)
          .limit(1);

        if (!issue) {
          return NextResponse.json({ found: false, issueId: null });
        }

        return NextResponse.json({ found: true, issueId: issue.id });
      }

      case "captureState": {
        /**
         * Capture State
         *
         * Snapshots current machine and organization state for later restoration.
         *
         * ⚠️ SECURITY VIOLATION: No access validation
         * - Can capture state from ANY machine/organization
         * - No verification of caller permissions
         * - Exposes internal state without authorization
         */

        // WARNING: Read machine state without ownership validation
        const [machineData] = await db
          .select({
            qr_code_id: machines.qr_code_id,
            is_public: machines.is_public,
          })
          .from(machines)
          .where(eq(machines.id, body.machineId));

        // WARNING: Read organization state without access validation
        const [orgData] = await db
          .select({
            allow_anonymous_issues: organizations.allow_anonymous_issues,
            is_public: organizations.is_public,
          })
          .from(organizations)
          .where(eq(organizations.id, body.organizationId));

        let statusDefaults = false;
        let priorityDefaults = false;

        if (body.statusId) {
          const [status] = await db
            .select({ is_default: issueStatuses.is_default })
            .from(issueStatuses)
            .where(eq(issueStatuses.id, body.statusId));
          statusDefaults = status?.is_default ?? false;
        }

        if (body.priorityId) {
          const [priority] = await db
            .select({ is_default: priorities.is_default })
            .from(priorities)
            .where(eq(priorities.id, body.priorityId));
          priorityDefaults = priority?.is_default ?? false;
        }

        return NextResponse.json({
          machine: {
            qrCodeId: machineData?.qr_code_id ?? null,
            isPublic: machineData?.is_public ?? null,
          },
          organization: {
            allowAnonymousIssues: orgData?.allow_anonymous_issues ?? false,
            isPublic: orgData?.is_public ?? null,
          },
          statusDefaults,
          priorityDefaults,
        });
      }

      case "restoreState": {
        /**
         * Restore State
         *
         * Restores previously captured machine and organization state.
         *
         * ⚠️ SECURITY VIOLATION: No access validation
         * - Can restore state to ANY machine/organization
         * - No verification of caller permissions
         * - Direct state mutation bypassing all security controls
         * - Can overwrite production data if accidentally exposed
         */

        // WARNING: Direct machine state mutation without ownership validation
        await db
          .update(machines)
          .set({
            qr_code_id: body.state.machine.qrCodeId,
            is_public: body.state.machine.isPublic,
            updated_at: new Date(),
          })
          .where(eq(machines.id, body.machineId));

        // WARNING: Direct organization state mutation without access validation
        await db
          .update(organizations)
          .set({
            allow_anonymous_issues: body.state.organization.allowAnonymousIssues,
            is_public: body.state.organization.isPublic,
            updated_at: new Date(),
          })
          .where(eq(organizations.id, body.organizationId));

        return NextResponse.json({ success: true });
      }

      default: {
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 },
        );
      }
    }
  } catch (error) {
    console.error("Test setup API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
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
  process.env.NODE_ENV === "production"
    ? productionPOSTHandler
    : developmentPOSTHandler;
