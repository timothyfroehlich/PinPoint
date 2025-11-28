import type React from "react";
import { redirect } from "next/navigation";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { readFlash } from "~/lib/flash";
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
  type IssueWithAllRelations,
  type IssueSeverity,
  type IssuePriority,
} from "~/lib/types";

const severityCopy: Record<IssueSeverity, string> = {
  minor: "Minor",
  playable: "Playable",
  unplayable: "Unplayable",
};

const priorityCopy: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Issue Detail Page (Protected Route)
 *
 * Displays issue details, timeline, and update actions.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get params (Next.js 16: params is a Promise)
  const { issueId } = await params;

  // Query issue with all relations
  const issue: IssueWithAllRelations | undefined =
    await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        machine: {
          columns: {
            id: true,
            name: true,
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
      },
    });

  if (!issue) {
    redirect("/issues");
  }

  // Fetch all users for assignment dropdown
  const allUsers = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      email: authUsers.email,
    })
    .from(userProfiles)
    .leftJoin(authUsers, eq(authUsers.id, userProfiles.id))
    .orderBy(asc(userProfiles.name));

  // Read flash message
  const flash = await readFlash();

  return (
    <PageShell className="space-y-8" size="wide">
      {/* Flash message */}
      {flash && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            flash.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
          role="status"
        >
          {flash.message}
        </div>
      )}

      {/* Back button */}
      <Link
        href="/issues"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Issues
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/machines/${issue.machine.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {issue.machine.name}
        </Link>
        <div className="space-y-3">
          <h1>{issue.title}</h1>
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
        <IssueSidebar issue={issue} allUsers={allUsers} />
      </div>
    </PageShell>
  );
}
