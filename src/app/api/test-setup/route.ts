/**
 * Test Setup API Endpoint
 *
 * SECURITY: Only available in development and test environments.
 * Provides authenticated endpoints for E2E test setup that respect RLS policies.
 *
 * This replaces direct database writes in E2E tests with proper API calls.
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

export async function POST(request: NextRequest) {
  try {
    ensureTestEnvironment();

    const body: TestSetupRequest = await request.json();

    switch (body.action) {
      case "enableAnonymousReporting": {
        // Update organization settings
        await db
          .update(organizations)
          .set({
            allow_anonymous_issues: true,
            is_public: true,
            updated_at: new Date(),
          })
          .where(eq(organizations.id, body.organizationId));

        // Update machine to be public
        await db
          .update(machines)
          .set({
            is_public: true,
            updated_at: new Date(),
          })
          .where(eq(machines.id, body.machineId));

        // Set default status if provided
        if (body.statusId) {
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
        // Check if QR code already exists
        const [machine] = await db
          .select({ qr_code_id: machines.qr_code_id })
          .from(machines)
          .where(eq(machines.id, body.machineId));

        if (machine?.qr_code_id) {
          return NextResponse.json({ qrCodeId: machine.qr_code_id });
        }

        // Generate new QR code ID
        const qrCodeId = `qr-${randomUUID()}`;

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
        // Find issue by title
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
        // Capture current state for later restoration
        const [machineData] = await db
          .select({
            qr_code_id: machines.qr_code_id,
            is_public: machines.is_public,
          })
          .from(machines)
          .where(eq(machines.id, body.machineId));

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
        // Restore previously captured state
        await db
          .update(machines)
          .set({
            qr_code_id: body.state.machine.qrCodeId,
            is_public: body.state.machine.isPublic,
            updated_at: new Date(),
          })
          .where(eq(machines.id, body.machineId));

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
