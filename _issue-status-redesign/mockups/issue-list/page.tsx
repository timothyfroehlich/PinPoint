import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  getIssueSeverityLabel,
  getIssueSeverityStyles,
  getIssuePriorityLabel,
  getIssuePriorityStyles,
  getIssueConsistencyLabel,
  getIssueConsistencyStyles,
  type IssueStatus,
  type IssueSeverity,
  type IssuePriority,
  type IssueConsistency,
} from "../badge-utils";

/**
 * Badge Preview - Issue List Layout
 *
 * Shows how badges appear in the issue list (machine page, all issues page).
 * Shows: Status, Severity, Priority (if high), Consistency
 */

interface MockIssue {
  id: string;
  title: string;
  machineInitials: string;
  issueNumber: number;
  machineName: string;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  consistency: IssueConsistency;
  reporter?: string;
  createdAt: string;
}

const mockIssues: MockIssue[] = [
  {
    id: "1",
    title: "Left flipper not responding",
    machineInitials: "TAF",
    issueNumber: 3,
    machineName: "The Addams Family",
    status: "in_progress",
    severity: "major",
    priority: "high",
    consistency: "constant",
    reporter: "Member User",
    createdAt: "Dec 29, 2025",
  },
  {
    id: "2",
    title: "Ball stuck in Thing's box intermittently",
    machineInitials: "TAF",
    issueNumber: 1,
    machineName: "The Addams Family",
    status: "needs_parts",
    severity: "unplayable",
    priority: "high",
    consistency: "frequent",
    reporter: "Admin User",
    createdAt: "Dec 25, 2025",
  },
  {
    id: "3",
    title: "Dim GI lighting on left side",
    machineInitials: "TAF",
    issueNumber: 4,
    machineName: "The Addams Family",
    status: "confirmed",
    severity: "cosmetic",
    priority: "low",
    consistency: "constant",
    reporter: "Guest Player",
    createdAt: "Dec 26, 2025",
  },
  {
    id: "4",
    title: "Right ramp switch sometimes misses",
    machineInitials: "AFM",
    issueNumber: 5,
    machineName: "Attack from Mars",
    status: "new",
    severity: "minor",
    priority: "medium",
    consistency: "intermittent",
    reporter: "Jane Doe",
    createdAt: "Dec 30, 2025",
  },
  {
    id: "5",
    title: "Bookcase target not registering hits",
    machineInitials: "TAF",
    issueNumber: 2,
    machineName: "The Addams Family",
    status: "diagnosing",
    severity: "major",
    priority: "medium",
    consistency: "unsure",
    reporter: "Player Joe",
    createdAt: "Dec 28, 2025",
  },
  {
    id: "6",
    title: "Coil burnt out on left slingshot",
    machineInitials: "MM",
    issueNumber: 1,
    machineName: "Medieval Madness",
    status: "fixed",
    severity: "major",
    priority: "high",
    consistency: "constant",
    reporter: "Admin User",
    createdAt: "Dec 20, 2025",
  },
];

// Simple status indicator dot
function StatusIndicator({ status }: { status: IssueStatus }): React.JSX.Element {
  const colorMap: Record<string, string> = {
    new: "bg-cyan-500",
    unconfirmed: "bg-teal-500",
    confirmed: "bg-emerald-500",
    diagnosing: "bg-violet-500",
    diagnosed: "bg-purple-500",
    in_progress: "bg-fuchsia-500",
    needs_parts: "bg-purple-400",
    parts_ordered: "bg-violet-400",
    needs_expert: "bg-pink-500",
    fixed: "bg-green-500",
    wont_fix: "bg-zinc-500",
    not_reproducible: "bg-slate-500",
    duplicate: "bg-neutral-500",
  };

  return (
    <div className={cn("size-3 rounded-full", colorMap[status] || "bg-gray-500")} />
  );
}

export default function IssueListPreviewPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - Issue List</h1>
          <p className="text-muted-foreground">
            How badges appear in issue lists (machine page, all issues page).
            <br />
            Shows: <span className="text-primary">Status, Severity, Consistency</span>.
            <span className="text-amber-400"> Priority shown only if HIGH.</span>
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to All Badges
          </Link>
        </div>

        {/* Issue List - Variant 1: Compact Row */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Variant A: Compact Row (Current Style)
          </h2>
          <p className="text-sm text-muted-foreground">
            All badges inline with title. Good for scanning.
          </p>
          <div className="border border-border rounded-lg overflow-hidden">
            {mockIssues.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  "flex items-start gap-3 border-b border-border p-4 transition-colors last:border-b-0",
                  issue.status === "fixed"
                    ? "bg-muted/30 opacity-60 hover:opacity-100"
                    : "hover:bg-muted/40"
                )}
              >
                <div className="mt-1.5 shrink-0">
                  <StatusIndicator status={issue.status} />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">
                      {issue.title}
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 font-medium border",
                        getIssueSeverityStyles(issue.severity)
                      )}
                    >
                      {getIssueSeverityLabel(issue.severity)}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 font-medium border",
                        getIssueConsistencyStyles(issue.consistency)
                      )}
                    >
                      {getIssueConsistencyLabel(issue.consistency)}
                    </Badge>
                    {issue.priority === "high" && (
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-5 font-medium border",
                          getIssuePriorityStyles(issue.priority)
                        )}
                      >
                        High Priority
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {issue.machineInitials}-{issue.issueNumber}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground/80">{issue.machineName}</span>
                    <span>•</span>
                    <span>opened on {issue.createdAt}</span>
                    <span>by {issue.reporter ?? "Unknown"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Issue List - Variant 2: Two-column badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Variant B: Two-Column Layout
          </h2>
          <p className="text-sm text-muted-foreground">
            Badges on the right side in a column. Better for many badges.
          </p>
          <div className="border border-border rounded-lg overflow-hidden">
            {mockIssues.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  "flex items-start gap-3 border-b border-border p-4 transition-colors last:border-b-0",
                  issue.status === "fixed"
                    ? "bg-muted/30 opacity-60 hover:opacity-100"
                    : "hover:bg-muted/40"
                )}
              >
                <div className="mt-1.5 shrink-0">
                  <StatusIndicator status={issue.status} />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <span className="font-semibold text-foreground">
                    {issue.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {issue.machineInitials}-{issue.issueNumber}
                    </span>
                    <span>•</span>
                    <span>{issue.machineName}</span>
                    <span>•</span>
                    <span>{issue.createdAt}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-5 font-medium border",
                      getIssueStatusStyles(issue.status)
                    )}
                  >
                    {getIssueStatusLabel(issue.status)}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-5 font-medium border",
                      getIssueSeverityStyles(issue.severity)
                    )}
                  >
                    {getIssueSeverityLabel(issue.severity)}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-5 font-medium border",
                      getIssueConsistencyStyles(issue.consistency)
                    )}
                  >
                    {getIssueConsistencyLabel(issue.consistency)}
                  </Badge>
                  {issue.priority === "high" && (
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 font-medium border",
                        getIssuePriorityStyles(issue.priority)
                      )}
                    >
                      High
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Layout Notes */}
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <h3 className="font-semibold">Issue List Badge Layout Notes</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Status is shown via the colored dot indicator (like current design)</li>
            <li><strong>Severity</strong> badge always shown</li>
            <li><strong>Consistency</strong> badge always shown (new field)</li>
            <li><strong>Priority</strong> badge only shown when HIGH (to avoid clutter)</li>
            <li>Variant A: Inline badges - compact, good for mobile</li>
            <li>Variant B: Column badges - cleaner, but needs more width</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
