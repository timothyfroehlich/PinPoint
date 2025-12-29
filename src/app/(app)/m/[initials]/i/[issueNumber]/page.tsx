import type React from "react";
import { redirect } from "next/navigation";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { Badge } from "~/components/ui/badge";
import { PageShell } from "~/components/layout/PageShell";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import {
  getIssueStatusStyles,
  getIssueSeverityStyles,
  getIssuePriorityStyles,
} from "~/lib/issues/status";
import {
  type IssueSeverity,
  type IssuePriority,
} from "~/lib/types";
import { formatIssueId } from "~/lib/issues/utils";

const severityCopy: Record<IssueSeverity, string> = {
  minor: "Minor",
  playable: "Playable",
  unplayable: "Unplayable",
};

const priorityCopy: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * Issue Detail Page (Protected Route)
 *
 * Displays issue details, timeline, and update actions.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ initials: string; issueNumber: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Get params (Next.js 16: params is a Promise)
  const { initials, issueNumber } = await params;
  const issueNum = parseInt(issueNumber, 10);

  if (isNaN(issueNum) || issueNum < 1) {
    redirect(`/m/${initials}`);
  }

  // CORE-PERF-003: Execute independent queries in parallel to avoid waterfall
  const [issue, allUsers] = await Promise.all([
    // Query issue with all relations
    db.query.issues.findFirst({
      where: and(
        eq(issues.machineInitials, initials),
        eq(issues.issueNumber, issueNum)
      ),
      with: {
        machine: {
          columns: {
            id: true,
            name: true,
            initials: true,
          },
        },
        reportedByUser: {
          columns: {
            id: true,
            name: true,
          },
        },
        assignedToUser: {
          columns: {
            id: true,
            name: true,
          },
        },
        comments: {
          orderBy: (comments, { asc: orderAsc }) => [
            orderAsc(comments.createdAt),
          ],
          with: {
            author: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        watchers: {
          columns: { userId: true },
        },
      },
    }),
    // Fetch all users for assignment dropdown
    db
      .select({
        id: userProfiles.id,
        name: userProfiles.name,
        email: authUsers.email,
      })
      .from(userProfiles)
      .leftJoin(authUsers, eq(authUsers.id, userProfiles.id))
      .orderBy(asc(userProfiles.name)),
  ]);

  if (!issue) {
    redirect(`/m/${initials}`);
  }

  return (
    <PageShell className="space-y-8" size="wide">
      {/* Back button */}
      <Link
        href={`/m/${initials}/i`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Issues
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/m/${initials}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {issue.machine.name}
        </Link>
        <div className="space-y-3">
          <h1 className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-2xl">
              {formatIssueId(initials, issue.issueNumber)}
            </span>{" "}
            {issue.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              data-testid="issue-status-badge"
              className={cn(
                "px-3 py-1 text-xs font-semibold border",
                getIssueStatusStyles(issue.status)
              )}
            >
              {issue.status === "in_progress"
                ? "In Progress"
                : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
            </Badge>

            <Badge
              data-testid="issue-severity-badge"
              className={cn(
                "px-3 py-1 text-xs font-semibold border",
                getIssueSeverityStyles(issue.severity)
              )}
            >
              {severityCopy[issue.severity]}
            </Badge>

            <Badge
              data-testid="issue-priority-badge"
              className={cn(
                "px-3 py-1 text-xs font-semibold border",
                getIssuePriorityStyles(issue.priority)
              )}
            >
              {priorityCopy[issue.priority]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5 lg:pr-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          <IssueTimeline issue={issue} />
        </section>

        {/* Sticky Sidebar */}
        <IssueSidebar
          issue={issue}
          allUsers={allUsers}
          currentUserId={user.id}
        />
      </div>
    </PageShell>
  );
}
