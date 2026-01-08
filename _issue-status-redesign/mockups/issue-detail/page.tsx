import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { ArrowLeft, User } from "lucide-react";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  getIssueSeverityLabel,
  getIssueSeverityStyles,
  getIssuePriorityLabel,
  getIssuePriorityStyles,
  getIssueConsistencyLabel,
  getIssueConsistencyStyles,
  ALL_STATUS_GROUPS,
  getStatusesForGroup,
  getIssueStatusGroupLabel,
  type IssueStatus,
} from "../badge-utils";

/**
 * Badge Preview - Issue Detail Page Layout
 *
 * Shows how badges appear on the issue detail page.
 * Shows ALL badges: Status, Severity, Priority, Consistency
 */

export default function IssueDetailPreviewPage(): React.JSX.Element {
  const mockIssue = {
    id: "1",
    title: "Ball stuck in Thing's box intermittently",
    machineInitials: "TAF",
    issueNumber: 1,
    machineName: "The Addams Family",
    status: "needs_parts" as IssueStatus,
    severity: "unplayable" as const,
    priority: "high" as const,
    consistency: "frequent" as const,
    description: "The ball gets stuck in Thing's box about 25% of the time. When it happens, you have to wait for the ball search to kick it out.",
    reporter: "Admin User",
    assignee: "Member User",
    createdAt: "Dec 25, 2025",
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - Issue Detail</h1>
          <p className="text-muted-foreground">
            How badges appear on the issue detail page.
            <br />
            Shows: <span className="text-primary">Status, Severity, Priority, Consistency</span> (all four!)
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to All Badges
          </Link>
        </div>

        {/* Mock Issue Detail Page */}
        <div className="space-y-6 border border-border rounded-lg p-6 bg-card">
          {/* Back button */}
          <Link
            href="#"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Issues
          </Link>

          {/* Header */}
          <div className="space-y-3">
            <Link
              href="#"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {mockIssue.machineName}
            </Link>
            <div className="space-y-3">
              <h1 className="flex items-center gap-3 text-2xl font-bold">
                <span className="text-muted-foreground font-mono">
                  {mockIssue.machineInitials}-{mockIssue.issueNumber}
                </span>{" "}
                {mockIssue.title}
              </h1>

              {/* All Four Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-semibold border",
                    getIssueStatusStyles(mockIssue.status)
                  )}
                >
                  {getIssueStatusLabel(mockIssue.status)}
                </Badge>

                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-semibold border",
                    getIssueSeverityStyles(mockIssue.severity)
                  )}
                >
                  {getIssueSeverityLabel(mockIssue.severity)}
                </Badge>

                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-semibold border",
                    getIssuePriorityStyles(mockIssue.priority)
                  )}
                >
                  {getIssuePriorityLabel(mockIssue.priority)} Priority
                </Badge>

                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-semibold border",
                    getIssueConsistencyStyles(mockIssue.consistency)
                  )}
                >
                  {getIssueConsistencyLabel(mockIssue.consistency)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
            {/* Main Content */}
            <section className="space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </h2>
              <p className="text-foreground">{mockIssue.description}</p>

              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pt-4">
                Activity
              </h2>
              <div className="text-muted-foreground text-sm italic">
                (Timeline would go here)
              </div>
            </section>

            {/* Sidebar */}
            <aside className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold border",
                          getIssueStatusStyles(mockIssue.status)
                        )}
                      >
                        {getIssueStatusLabel(mockIssue.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">(dropdown here)</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Severity</label>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold border",
                          getIssueSeverityStyles(mockIssue.severity)
                        )}
                      >
                        {getIssueSeverityLabel(mockIssue.severity)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Priority</label>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold border",
                          getIssuePriorityStyles(mockIssue.priority)
                        )}
                      >
                        {getIssuePriorityLabel(mockIssue.priority)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Consistency</label>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold border",
                          getIssueConsistencyStyles(mockIssue.consistency)
                        )}
                      >
                        {getIssueConsistencyLabel(mockIssue.consistency)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-border pt-4">
                    <label className="text-xs text-muted-foreground">Assigned to</label>
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="text-sm">{mockIssue.assignee}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Reported by</label>
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="text-sm">{mockIssue.reporter}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>

        {/* Status Dropdown Preview with Optgroups */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Status Dropdown with Optgroups
          </h2>
          <p className="text-sm text-muted-foreground">
            Preview of how the status dropdown will look with grouped options.
          </p>
          <div className="max-w-xs">
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {ALL_STATUS_GROUPS.map((group) => (
                <optgroup key={group} label={getIssueStatusGroupLabel(group)}>
                  {getStatusesForGroup(group).map((status) => (
                    <option key={status} value={status}>
                      {getIssueStatusLabel(status)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </section>

        {/* Layout Notes */}
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <h3 className="font-semibold">Issue Detail Badge Layout Notes</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>All four badges shown in header (Status, Severity, Priority, Consistency)</li>
            <li>Sidebar shows each field with its own edit control</li>
            <li>Priority badge includes "Priority" suffix for clarity</li>
            <li>Status dropdown uses optgroups to visually separate categories</li>
            <li>Larger badge size (px-3 py-1) for better visibility in header</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
