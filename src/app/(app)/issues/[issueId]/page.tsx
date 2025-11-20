import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { readFlash } from "~/lib/flash";
import { Badge } from "~/components/ui/badge";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { SidebarLayout } from "~/components/layout/SidebarLayout";
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

const severityClasses: Record<IssueSeverity, string> = {
  minor: "bg-severity-minor text-severity-minor-text border-transparent",
  playable:
    "bg-severity-playable text-severity-playable-text border-transparent",
  unplayable:
    "bg-severity-unplayable text-severity-unplayable-text border-transparent",
};

const priorityCopy: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const priorityClasses: Record<IssuePriority, string> = {
  low: "bg-slate-100 text-slate-700 border-transparent",
  medium: "bg-blue-50 text-blue-700 border-transparent",
  high: "bg-orange-50 text-orange-700 border-transparent",
  critical: "bg-red-50 text-red-700 border-transparent",
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
    <SidebarLayout sidebar={<IssueSidebar issue={issue} allUsers={allUsers} />}>
      {/* Flash message */}
      {flash && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            flash.type === "error"
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-green-500/50 bg-green-500/10 text-green-700"
          }`}
        >
          {flash.message}
        </div>
      )}

      {/* Breadcrumbs / Back */}
      <div className="mb-6">
        <Link
          href="/issues"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Issues
        </Link>
      </div>

      {/* Header Section */}
      <div className="mb-8 space-y-4">
        {/* Game Title (Subtitle) */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link
            href={`/machines/${issue.machine.id}`}
            className="text-lg font-medium hover:text-primary transition-colors"
          >
            {issue.machine.name}
          </Link>
        </div>

        {/* Issue Title & Badges */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                {issue.title}
              </h1>

              {/* Status Badge */}
              <Badge
                variant="outline"
                className={`px-2.5 py-0.5 text-sm font-medium border-transparent ${
                  issue.status === "resolved"
                    ? "bg-status-resolved text-status-resolved-text"
                    : issue.status === "in_progress"
                      ? "bg-status-inprogress text-status-inprogress-text"
                      : "bg-status-new text-status-new-text"
                }`}
              >
                {issue.status === "in_progress"
                  ? "In Progress"
                  : issue.status.charAt(0).toUpperCase() +
                    issue.status.slice(1)}
              </Badge>

              {/* Severity Badge */}
              <Badge
                variant="outline"
                className={`px-2.5 py-0.5 text-sm font-medium ${severityClasses[issue.severity]}`}
              >
                {severityCopy[issue.severity]}
              </Badge>

              {/* Priority Badge */}
              <Badge
                variant="outline"
                className={`px-2.5 py-0.5 text-sm font-medium ${priorityClasses[issue.priority]}`}
              >
                {priorityCopy[issue.priority]}
              </Badge>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Reported by:
                </span>
                <span>{issue.reportedByUser?.name ?? "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span>
                  Opened {new Date(issue.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span>
                  Updated {new Date(issue.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <IssueTimeline issue={issue} />
    </SidebarLayout>
  );
}
