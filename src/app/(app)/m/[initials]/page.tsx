import type React from "react";
import { notFound } from "next/navigation";
import { getUnifiedUsers } from "~/lib/users/queries";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines, issues, userProfiles } from "~/server/db/schema";
import { eq, notInArray, sql } from "drizzle-orm";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
} from "~/lib/machines/status";
import {
  getMachinePresenceLabel,
  getMachinePresenceStyles,
  isOnTheFloor,
} from "~/lib/machines/presence";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { headers } from "next/headers";
import { resolveRequestUrl } from "~/lib/url";
import { MachineInfoDisplay } from "./machine-info-display";
import { EditMachineDialog } from "./update-machine-form";
import { QrCodeDialog } from "./qr-code-dialog";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { WatchMachineButton } from "~/components/machines/WatchMachineButton";
import { MachineTextFields } from "./machine-text-fields";
import { IssuesExpando } from "./issues-expando";
import {
  getAccessLevel,
  checkPermission,
  getPermissionDeniedReason,
  type OwnershipContext,
} from "~/lib/permissions/index";

/**
 * Machine Detail Page (Public Route)
 *
 * Full-width details pane with internal two-column layout:
 * - Left: machine metadata (initials, owner, status, dates, issue counts)
 * - Right: text fields (description, tournament notes, owner's requirements, owner's notes)
 *
 * Collapsible issues section below.
 * Permission-aware: unauthenticated users can view but not edit.
 */
export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  // Await params (Next.js 15+ requirement)
  const { initials } = await params;

  // Auth check - user may be null (public route)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch current user profile only when authenticated
  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  // Compute access level and permissions
  const accessLevel = getAccessLevel(currentUserProfile?.role);

  // Execute independent queries in parallel (CORE-PERF-001)
  const [machine, totalIssuesCountResult] = await Promise.all([
    // Query 1: Machine with OPEN issues only + new text fields
    db.query.machines.findFirst({
      where: eq(machines.initials, initials),
      with: {
        issues: {
          // Filter to only OPEN issues to reduce payload
          where: notInArray(issues.status, [...CLOSED_STATUSES]),
          columns: {
            id: true,
            issueNumber: true,
            title: true,
            status: true,
            severity: true,
            priority: true,
            frequency: true,
            machineInitials: true,
            createdAt: true,
            reporterName: true,
          },
          orderBy: (issues, { desc }) => [desc(issues.createdAt)],
        },
        owner: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        invitedOwner: {
          columns: {
            id: true,
            name: true,
          },
        },
        watchers: {
          columns: {
            userId: true,
            watchMode: true,
          },
        },
      },
    }),

    // Query 2: Total count of ALL issues for this machine
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(eq(issues.machineInitials, initials)),
  ]);

  // 404 if machine not found
  if (!machine) {
    notFound();
  }

  // Build ownership context for permission checks
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };

  // Permission computations
  const canEdit = checkPermission(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const canWatch = checkPermission("machines.watch", accessLevel);
  const editDeniedReason = getPermissionDeniedReason(
    "machines.edit",
    accessLevel,
    ownershipContext
  );
  const isAdmin = accessLevel === "admin";
  const isOwner =
    !!user &&
    (user.id === machine.ownerId || user.id === machine.invitedOwnerId);

  // Text field permissions
  const canEditOwnerNotes = checkPermission(
    "machines.edit.ownerNotes",
    accessLevel,
    ownershipContext
  );
  const canViewOwnerRequirements = checkPermission(
    "machines.view.ownerRequirements",
    accessLevel
  );
  const canViewOwnerNotes = checkPermission(
    "machines.view.ownerNotes",
    accessLevel,
    ownershipContext
  );

  // Only fetch allUsers when user can edit (needs OwnerSelect data)
  // CORE-SEC-006: Map to minimal shape before passing to client components
  const allUsersRaw = canEdit
    ? await getUnifiedUsers({ includeEmails: false })
    : [];
  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
  }));

  const totalIssuesCount = totalIssuesCountResult[0]?.count ?? 0;
  // machine.issues now contains only open issues due to the filter in the query
  const openIssues = machine.issues;

  // Derive machine status
  const machineStatus = deriveMachineStatus(openIssues);

  // Generate QR data for modal using dynamic host resolution
  const headersList = await headers();
  const dynamicSiteUrl = resolveRequestUrl(headersList);

  const reportUrl = buildMachineReportUrl({
    siteUrl: dynamicSiteUrl,
    machineInitials: machine.initials,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

  // Watch state (only for authenticated users)
  const currentUserWatch = user
    ? machine.watchers.find((w) => w.userId === user.id)
    : undefined;
  const isWatching = !!currentUserWatch;
  const watchMode = currentUserWatch?.watchMode ?? "notify";

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/m">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-outline text-on-surface hover:bg-surface-variant"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-on-surface">
                    {machine.name}
                  </h1>
                  <Badge
                    data-testid="machine-status-badge"
                    className={cn(
                      getMachineStatusStyles(machineStatus),
                      "border px-3 py-1 text-sm font-semibold"
                    )}
                  >
                    {getMachineStatusLabel(machineStatus)}
                  </Badge>
                  {!isOnTheFloor(machine.presenceStatus) && (
                    <Badge
                      className={cn(
                        getMachinePresenceStyles(machine.presenceStatus),
                        "border px-3 py-1 text-sm font-semibold"
                      )}
                    >
                      {getMachinePresenceLabel(machine.presenceStatus)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Machine details and issue tracking
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {canWatch && (
                <WatchMachineButton
                  machineId={machine.id}
                  initialIsWatching={isWatching}
                  initialWatchMode={watchMode}
                />
              )}
              <Button
                className="bg-primary text-on-primary hover:bg-primary/90"
                asChild
              >
                <Link
                  href={`/report?machine=${machine.initials}`}
                  data-testid="machine-report-issue"
                >
                  <Plus className="mr-2 size-4" />
                  Report Issue
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto space-y-6 px-4 py-8">
        {!isOnTheFloor(machine.presenceStatus) && (
          <div className="rounded-md border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface-variant">
            This machine is currently{" "}
            <strong>
              {getMachinePresenceLabel(machine.presenceStatus).toLowerCase()}
            </strong>
            .
          </div>
        )}

        {/* Full-width Details Card */}
        <Card className="border-outline-variant bg-surface">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <CardTitle className="text-xl text-on-surface">
              Machine Information
            </CardTitle>
            <QrCodeDialog
              machineName={machine.name}
              machineInitials={machine.initials}
              qrDataUrl={qrDataUrl}
              reportUrl={reportUrl}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Left Column: Machine Metadata */}
              <div className="space-y-6">
                {/* Static read-only display */}
                <MachineInfoDisplay
                  machine={machine}
                  canEdit={canEdit}
                  editDeniedReason={editDeniedReason}
                  isAuthenticated={!!user}
                />

                {/* Edit button (active) - only shown when user has permission */}
                {canEdit && user && (
                  <EditMachineDialog
                    machine={machine}
                    allUsers={allUsers}
                    isAdmin={isAdmin}
                    isOwner={isOwner}
                  />
                )}

                <div className="space-y-4 border-t border-outline-variant/50 pt-6">
                  {/* Status & Issues Count Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Status
                      </p>
                      <Badge
                        className={cn(
                          getMachineStatusStyles(machineStatus),
                          "border px-2 py-0.5 text-[10px] font-bold"
                        )}
                      >
                        {getMachineStatusLabel(machineStatus)}
                      </Badge>
                    </div>

                    <div data-testid="detail-open-issues">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Open Issues
                      </p>
                      <p
                        className="text-xl font-bold text-on-surface"
                        data-testid="detail-open-issues-count"
                      >
                        {openIssues.length}
                      </p>
                    </div>
                  </div>

                  {/* Date & Total Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Added Date
                      </p>
                      <div className="flex items-center gap-1.5 text-on-surface-variant">
                        <Calendar className="size-3" />
                        <p className="text-xs font-medium">
                          {new Date(machine.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Total Issues
                      </p>
                      <p className="text-xl font-bold text-on-surface">
                        {totalIssuesCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Text Fields */}
              <div className="border-t border-outline-variant/50 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <MachineTextFields
                  machineId={machine.id}
                  description={machine.description}
                  tournamentNotes={machine.tournamentNotes}
                  ownerRequirements={machine.ownerRequirements}
                  ownerNotes={machine.ownerNotes}
                  canEditGeneral={canEdit}
                  canEditOwnerNotes={canEditOwnerNotes}
                  canViewOwnerRequirements={canViewOwnerRequirements}
                  canViewOwnerNotes={canViewOwnerNotes}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Issues Section */}
        <IssuesExpando
          issues={openIssues}
          machineName={machine.name}
          machineInitials={machine.initials}
          totalIssuesCount={totalIssuesCount}
        />
      </div>
    </main>
  );
}
