import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { AlertTriangle, CheckCircle2, Wrench, XCircle } from "lucide-react";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  getIssueSeverityLabel,
  getIssueSeverityStyles,
  type IssueStatus,
  type IssueSeverity,
} from "../badge-utils";

/**
 * Badge Preview - Dashboard Layout
 *
 * Shows how badges appear on the main dashboard.
 * Note: Dashboard does NOT show consistency or priority badges.
 */

interface MockIssue {
  id: string;
  title: string;
  machineInitials: string;
  issueNumber: number;
  machineName: string;
  status: IssueStatus;
  severity: IssueSeverity;
  reporter?: string;
  createdAt: string;
}

const mockAssignedIssues: MockIssue[] = [
  {
    id: "1",
    title: "Left flipper not responding",
    machineInitials: "TAF",
    issueNumber: 3,
    machineName: "The Addams Family",
    status: "in_progress",
    severity: "major",
    createdAt: "2 days ago",
  },
  {
    id: "2",
    title: "Ball stuck in Thing's box",
    machineInitials: "TAF",
    issueNumber: 1,
    machineName: "The Addams Family",
    status: "needs_parts",
    severity: "unplayable",
    createdAt: "1 week ago",
  },
  {
    id: "3",
    title: "Dim GI lighting on left side",
    machineInitials: "MM",
    issueNumber: 2,
    machineName: "Medieval Madness",
    status: "confirmed",
    severity: "cosmetic",
    createdAt: "3 days ago",
  },
];

const mockRecentIssues: MockIssue[] = [
  {
    id: "4",
    title: "Right ramp switch intermittent",
    machineInitials: "AFM",
    issueNumber: 5,
    machineName: "Attack from Mars",
    status: "new",
    severity: "minor",
    reporter: "Player Jane",
    createdAt: "1 hour ago",
  },
  {
    id: "5",
    title: "Bookcase target not registering",
    machineInitials: "TAF",
    issueNumber: 4,
    machineName: "The Addams Family",
    status: "diagnosing",
    severity: "major",
    reporter: "Member User",
    createdAt: "Yesterday",
  },
  {
    id: "6",
    title: "Coil burnt out on left slingshot",
    machineInitials: "MM",
    issueNumber: 1,
    machineName: "Medieval Madness",
    status: "fixed",
    severity: "major",
    reporter: "Admin User",
    createdAt: "2 days ago",
  },
];

const mockUnplayableMachines = [
  { name: "The Addams Family", initials: "TAF", unplayableCount: 1 },
  { name: "Creature from the Black Lagoon", initials: "CFTBL", unplayableCount: 2 },
];

export default function DashboardPreviewPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - Dashboard</h1>
          <p className="text-muted-foreground">
            How badges appear on the main dashboard. Shows: Status, Severity.
            <span className="text-amber-400"> Does NOT show: Priority, Consistency.</span>
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to All Badges
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stats Section */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-semibold text-foreground mb-4">Quick Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-primary/20 bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Open Issues
                    </CardTitle>
                    <AlertTriangle className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">12</div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Machines Needing Service
                    </CardTitle>
                    <Wrench className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">4</div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Assigned to Me
                    </CardTitle>
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">3</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Issues Assigned to Me */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-foreground mb-4">Issues Assigned to Me</h2>
            <div className="space-y-3">
              {mockAssignedIssues.map((issue) => (
                <Card
                  key={issue.id}
                  className={cn(
                    "transition-all h-full cursor-pointer",
                    issue.status === "fixed"
                      ? "border-border/40 bg-muted/30 opacity-60"
                      : "border-primary/20 bg-card hover:border-primary"
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-base text-foreground mb-1">
                          <span className="text-muted-foreground font-mono mr-2">
                            {issue.machineInitials}-{issue.issueNumber}
                          </span>{" "}
                          {issue.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{issue.machineName}</p>
                      </div>
                      <div className="flex gap-2">
                        {/* Status Badge */}
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs font-semibold border",
                            getIssueStatusStyles(issue.status)
                          )}
                        >
                          {getIssueStatusLabel(issue.status)}
                        </Badge>
                        {/* Severity Badge */}
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs font-semibold border",
                            getIssueSeverityStyles(issue.severity)
                          )}
                        >
                          {getIssueSeverityLabel(issue.severity)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {/* Unplayable Machines */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-foreground mb-4">Unplayable Machines</h2>
            <div className="space-y-3">
              {mockUnplayableMachines.map((machine) => (
                <Card
                  key={machine.initials}
                  className="border-destructive/30 bg-destructive/10 hover:border-destructive transition-all cursor-pointer"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base text-destructive mb-1">
                          {machine.name}
                        </CardTitle>
                        <p className="text-xs text-destructive/80">
                          {machine.unplayableCount} unplayable{" "}
                          {machine.unplayableCount === 1 ? "issue" : "issues"}
                        </p>
                      </div>
                      <XCircle className="size-5 text-destructive" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          {/* Recently Reported Issues */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-semibold text-foreground mb-4">Recently Reported Issues</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mockRecentIssues.map((issue) => (
                <Card
                  key={issue.id}
                  className={cn(
                    "transition-all h-full cursor-pointer",
                    issue.status === "fixed"
                      ? "border-border/40 bg-muted/30 opacity-60"
                      : "border-secondary/20 bg-card hover:border-secondary"
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-base text-foreground mb-1">
                          <span className="text-muted-foreground font-mono mr-2">
                            {issue.machineInitials}-{issue.issueNumber}
                          </span>{" "}
                          {issue.title}
                        </CardTitle>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>{issue.machineName}</span>
                          <span>
                            Reported by {issue.reporter ?? "Unknown"} • {issue.createdAt}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {/* Status Badge */}
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs font-semibold border",
                            getIssueStatusStyles(issue.status)
                          )}
                        >
                          {getIssueStatusLabel(issue.status)}
                        </Badge>
                        {/* Severity Badge */}
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs font-semibold border",
                            getIssueSeverityStyles(issue.severity)
                          )}
                        >
                          {getIssueSeverityLabel(issue.severity)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Layout Notes */}
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <h3 className="font-semibold">Dashboard Badge Layout Notes</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Shows <strong>Status</strong> and <strong>Severity</strong> badges side by side</li>
            <li>Does NOT show Priority or Consistency (too much visual noise)</li>
            <li>Badges are stacked vertically in the "Recently Reported" section for better readability</li>
            <li>Resolved/Fixed issues are grayed out with reduced opacity</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
