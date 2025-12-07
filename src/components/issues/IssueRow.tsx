import type React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleDot } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";

interface IssueRowProps {
  issue: {
    id: string;
    issueNumber: number;
    title: string;
    status: "new" | "in_progress" | "resolved";
    severity: "minor" | "playable" | "unplayable";
    priority: "low" | "medium" | "high" | "critical";
    createdAt: Date;
    machineInitials: string;
    machine: {
      name: string;
    } | null;
    reportedByUser: {
      name: string;
    } | null;
  };
}

export function IssueRow({ issue }: IssueRowProps): React.JSX.Element {
  const statusIcon = {
    new: <AlertCircle className="size-5 text-yellow-600" />,
    in_progress: <CircleDot className="size-5 text-blue-600" />,
    resolved: <CheckCircle2 className="size-5 text-green-600" />,
    // closed: <CheckCircle2 className="size-5 text-gray-500" />, // closed not in DB enum
  };

  const severityColor = {
    minor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    playable:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    unplayable: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border p-4 transition-colors",
        issue.status === "resolved"
          ? "bg-muted/30 opacity-60 hover:opacity-100"
          : "hover:bg-muted/40"
      )}
    >
      <div className="mt-0.5 shrink-0">{statusIcon[issue.status]}</div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
            className="font-semibold text-foreground hover:text-primary transition-colors truncate"
          >
            {issue.title}
          </Link>
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 font-medium border-0",
              severityColor[issue.severity]
            )}
          >
            {issue.severity}
          </Badge>
          {issue.priority === "critical" && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 h-5 font-medium"
            >
              critical
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">
            {issue.machineInitials}-{issue.issueNumber}
          </span>
          <span>•</span>
          <span className="font-medium text-foreground/80">
            {issue.machine?.name ?? issue.machineInitials}
          </span>
          <span>•</span>
          <span>
            opened on {new Date(issue.createdAt).toLocaleDateString()}
          </span>
          <span>by {issue.reportedByUser?.name ?? "Unknown"}</span>
        </div>
      </div>
    </div>
  );
}
