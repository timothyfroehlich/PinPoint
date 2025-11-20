import type React from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
  type IssueForStatus,
} from "~/lib/machines/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { readFlash } from "~/lib/flash";

/**
 * Machine Detail Page (Protected Route)
 *
 * Shows machine details and its associated issues.
 * Displays derived status based on open issues.
 */
export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  // Await params (Next.js 15+ requirement)
  const { machineId } = await params;

  // Query machine with issues (direct Drizzle query - no DAL)
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    with: {
      issues: {
        columns: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
        },
        orderBy: (issues, { desc }) => [desc(issues.createdAt)],
      },
    },
  });

  // 404 if machine not found
  if (!machine) {
    notFound();
  }

  // Derive machine status
  const machineStatus = deriveMachineStatus(machine.issues as IssueForStatus[]);
  const openIssues = machine.issues.filter(
    (issue) => issue.status !== "resolved"
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/machines">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-input text-foreground hover:bg-accent"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-foreground">
                    {machine.name}
                  </h1>
                  <Badge
                    data-testid="machine-status-badge"
                    className={`${getMachineStatusStyles(machineStatus)} border px-3 py-1 text-sm font-semibold`}
                  >
                    {getMachineStatusLabel(machineStatus)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
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
          {/* Flash message */}
          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                flash.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground"
              }`}
              role="alert"
            >
              {flash.message}
            </div>
          )}

          {/* Machine Info Card */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">
                Machine Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    className={`${getMachineStatusStyles(machineStatus)} border px-3 py-1 text-sm font-semibold`}
                  >
                    {getMachineStatusLabel(machineStatus)}
                  </Badge>
                </div>

                {/* Open Issues Count */}
                <div data-testid="detail-open-issues">
                  <p className="text-xs text-muted-foreground mb-1">
                    Open Issues
                  </p>
                  <p
                    className="text-lg font-semibold text-foreground"
                    data-testid="detail-open-issues-count"
                  >
                    {openIssues.length}
                  </p>
                </div>

                {/* Created Date */}
                <div>
                  <p className="text-muted-foreground py-8 text-center">
                    Added Date
                  </p>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">
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
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Issues
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {machine.issues.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues Section */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-2xl text-foreground">
                  Issues
                </CardTitle>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="bg-primary text-on-primary hover:bg-primary/90"
                    asChild
                  >
                    <Link href={`/issues/new?machineId=${machine.id}`}>
                      <Plus className="mr-2 size-4" />
                      Report Issue
                    </Link>
                  </Button>
                  {machine.issues.length > 0 ? (
                    <Button
                      asChild
                      variant="outline"
                      className="border-border text-foreground"
                    >
                      <Link href={`/issues?machineId=${machine.id}`}>
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
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    No issues reported yet
                  </p>
                  <p className="text-muted-foreground">
                    Issues will be available in Task 8
                  </p>
                </div>
              ) : (
                // Issues list (placeholder UI ready for Task 8)
                <div className="space-y-3">
                  {openIssues.map((issue) => (
                    <div
                      key={issue.id}
                      data-testid="issue-card"
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">
                          {issue.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {new Date(issue.createdAt).toLocaleDateString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {issue.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {issue.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
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
