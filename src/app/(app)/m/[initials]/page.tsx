import type React from "react";
import { notFound } from "next/navigation";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
  type IssueForStatus,
} from "~/lib/machines/status";
import {
  getIssuePriorityLabel,
  getIssuePriorityStyles,
} from "~/lib/issues/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { headers } from "next/headers";
import { resolveRequestUrl } from "~/lib/url";
import { UpdateMachineForm } from "./update-machine-form";
import { formatIssueId } from "~/lib/issues/utils";
import { QrCodeDialog } from "./qr-code-dialog";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";

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
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Await params (Next.js 15+ requirement)
  const { initials } = await params;

  // Query machine with issues (direct Drizzle query - no DAL)
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    with: {
      issues: {
        columns: {
          id: true,
          issueNumber: true,
          title: true,
          status: true,
          severity: true,
          priority: true,
          createdAt: true,
        },
        orderBy: (issues, { desc }) => [desc(issues.createdAt)],
      },
      owner: true,
    },
  });

  // Fetch all users for owner selection (Admin only)
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const isAdmin = currentUserProfile?.role === "admin";

  let allUsers: { id: string; name: string }[] = [];
  if (isAdmin) {
    allUsers = await db
      .select({ id: userProfiles.id, name: userProfiles.name })
      .from(userProfiles)
      .orderBy(asc(userProfiles.name));
  }

  // 404 if machine not found
  if (!machine) {
    notFound();
  }

  // Derive machine status
  const machineStatus = deriveMachineStatus(machine.issues as IssueForStatus[]);

  // Generate QR data for modal using dynamic host resolution
  const headersList = await headers();
  const dynamicSiteUrl = resolveRequestUrl(headersList);

  const reportUrl = buildMachineReportUrl({
    siteUrl: dynamicSiteUrl,
    machineInitials: machine.initials,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

  const openIssues = machine.issues.filter(
    (issue) => issue.status !== "resolved"
  );

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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Machine Info Card */}
            <Card className="border-outline-variant">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <CardTitle className="text-2xl text-on-surface">
                  Machine Information
                </CardTitle>
                <QrCodeDialog
                  machineName={machine.name}
                  machineInitials={machine.initials}
                  qrDataUrl={qrDataUrl}
                  reportUrl={reportUrl}
                />
              </CardHeader>
              <CardContent className="space-y-8">
                <UpdateMachineForm
                  machine={machine}
                  allUsers={allUsers}
                  isAdmin={isAdmin}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-outline-variant/50">
                  {/* Status */}
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">
                      Status
                    </p>
                    <Badge
                      className={cn(
                        getMachineStatusStyles(machineStatus),
                        "border px-3 py-1 text-sm font-semibold"
                      )}
                    >
                      {getMachineStatusLabel(machineStatus)}
                    </Badge>
                  </div>

                  {/* Open Issues Count */}
                  <div data-testid="detail-open-issues">
                    <p className="text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">
                      Open Issues
                    </p>
                    <p
                      className="text-2xl font-semibold text-on-surface"
                      data-testid="detail-open-issues-count"
                    >
                      {openIssues.length}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">
                      Added Date
                    </p>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-on-surface-variant" />
                      <p className="text-sm font-medium text-on-surface">
                        {new Date(machine.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Total Issues */}
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">
                      Total Issues
                    </p>
                    <p className="text-2xl font-semibold text-on-surface">
                      {machine.issues.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues Section */}
          <Card className="border-outline-variant">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-2xl text-on-surface">
                  Issues
                </CardTitle>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="bg-primary text-on-primary hover:bg-primary/90"
                    asChild
                  >
                    <Link
                      href={`/m/${machine.initials}/report`}
                      data-testid="machine-report-issue"
                    >
                      <Plus className="mr-2 size-4" />
                      Report Issue
                    </Link>
                  </Button>
                  {machine.issues.length > 0 ? (
                    <Button
                      asChild
                      variant="outline"
                      className="border-outline-variant text-on-surface"
                    >
                      <Link href={`/m/${machine.initials}/i`}>
                        View All Issues for {machine.name}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {openIssues.length === 0 ? (
                // Empty state
                <div className="py-12 text-center">
                  <p className="text-lg text-on-surface-variant mb-2">
                    No issues reported yet
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    Report an issue to get started
                  </p>
                </div>
              ) : (
                // Issues list
                <div className="space-y-3">
                  {openIssues.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/m/${machine.initials}/i/${issue.issueNumber}`}
                      className="block"
                    >
                      <div
                        data-testid="issue-card"
                        className="flex items-center justify-between p-4 rounded-lg border border-outline-variant bg-surface-variant hover:border-primary/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-primary">
                              {formatIssueId(
                                machine.initials,
                                issue.issueNumber
                              )}
                            </span>
                            <h3 className="font-medium text-on-surface">
                              {issue.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                            <span>
                              {new Date(issue.createdAt).toLocaleDateString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {issue.severity}
                            </Badge>
                            <Badge
                              className={cn(
                                getIssuePriorityStyles(issue.priority),
                                "border px-2 py-0.5 text-xs font-semibold"
                              )}
                            >
                              {getIssuePriorityLabel(issue.priority)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {issue.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
