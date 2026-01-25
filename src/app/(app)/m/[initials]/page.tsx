import type React from "react";
import { notFound, redirect } from "next/navigation";
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
  type IssueForStatus,
} from "~/lib/machines/status";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { Issue } from "~/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { headers } from "next/headers";
import { resolveRequestUrl } from "~/lib/url";
import { UpdateMachineForm } from "./update-machine-form";
import { QrCodeDialog } from "./qr-code-dialog";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { IssueCard } from "~/components/issues/IssueCard";

/**
 * Machine Detail Page (Protected Route)
 *
 * Shows machine details and its associated issues.
 * Displays derived status based on open issues.
 */
export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  // Await params (Next.js 15+ requirement)
  const { initials } = await params;

  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/m/${initials}`);
    redirect(`/login?next=${next}`);
  }

  // Fetch current user profile to check role
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const isMemberOrAdmin =
    currentUserProfile?.role === "member" ||
    currentUserProfile?.role === "admin";
  const isAdmin = currentUserProfile?.role === "admin";

  // Execute independent queries in parallel (CORE-PERF-001)
  const [machine, totalIssuesCountResult, allUsers] = await Promise.all([
    // Query 1: Machine with OPEN issues only
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
          },
          orderBy: (issues, { desc }) => [desc(issues.createdAt)],
        },
        owner: {
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
            ...(isMemberOrAdmin && { email: true }),
          },
        },
        invitedOwner: {
          columns: {
            id: true,
            name: true,
            ...(isMemberOrAdmin && { email: true }),
          },
        },
      },
    }),

    // Query 2: Total count of ALL issues for this machine
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(eq(issues.machineInitials, initials)),

    // Query 3: All users (if admin)
    isAdmin ? getUnifiedUsers() : Promise.resolve([]),
  ]);

  // 404 if machine not found
  if (!machine) {
    notFound();
  }

  const totalIssuesCount = totalIssuesCountResult[0]?.count ?? 0;
  // machine.issues now contains only open issues due to the filter in the query
  const openIssues = machine.issues;

  // Derive machine status
  const machineStatus = deriveMachineStatus(openIssues as IssueForStatus[]);

  // Generate QR data for modal using dynamic host resolution
  const headersList = await headers();
  const dynamicSiteUrl = resolveRequestUrl(headersList);

  const reportUrl = buildMachineReportUrl({
    siteUrl: dynamicSiteUrl,
    machineInitials: machine.initials,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

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
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Machine details and issue tracking
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
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
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar - Machine Info (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-outline-variant bg-surface sticky top-24">
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
              <CardContent className="space-y-6">
                <UpdateMachineForm
                  machine={machine}
                  allUsers={allUsers}
                  isAdmin={isAdmin}
                />

                <div className="pt-6 border-t border-outline-variant/50 space-y-4">
                  {/* Status & Issues Count Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
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
                      <p className="text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
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
                      <p className="text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
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
                      <p className="text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                        Total Issues
                      </p>
                      <p className="text-xl font-bold text-on-surface">
                        {totalIssuesCount}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Issues (8 cols) */}
          <div className="lg:col-span-8">
            <Card className="border-outline-variant bg-surface">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl text-on-surface font-bold">
                  Issues
                </CardTitle>
                <div className="flex gap-2">
                  {totalIssuesCount > 5 && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/5"
                    >
                      <Link href={`/m/${machine.initials}/i`}>
                        View All ({totalIssuesCount})
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {openIssues.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex size-12 items-center justify-center rounded-full bg-surface-variant mb-4">
                      <Plus className="size-6 text-on-surface-variant" />
                    </div>
                    <p className="text-lg font-medium text-on-surface mb-1">
                      No open issues
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      The game is operational. Great job!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openIssues.slice(0, 50).map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue as unknown as Issue}
                        machine={{ name: machine.name }}
                      />
                    ))}

                    {openIssues.length > 5 && (
                      <div className="pt-2 text-center">
                        <p className="text-xs text-on-surface-variant italic">
                          Showing top 5 issues. Use "View All" to see the full
                          list.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
