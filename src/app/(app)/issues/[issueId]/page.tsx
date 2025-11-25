import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { readFlash } from "~/lib/flash";
import { Badge } from "~/components/ui/badge";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { type IssueWithAllRelations, type IssueSeverity } from "~/lib/types";

const severityCopy: Record<IssueSeverity, string> = {
  minor: "Minor",
  playable: "Playable",
  unplayable: "Unplayable",
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
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto px-4">
        {/* Flash message */}
        {flash && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${
              flash.type === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-green-300 bg-green-50 text-green-800"
            }`}
          >
            {flash.message}
          </div>
        )}

        {/* Back button */}
        <Link
          href="/issues"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Issues
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-1">
            <Link
              href={`/machines/${issue.machine.id}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {issue.machine.name}
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {issue.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground mr-1">
              Status:
            </span>
            <Badge
              data-testid="issue-status-badge"
              className={`px-2.5 py-0.5 text-sm font-medium border ${
                issue.status === "resolved"
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : issue.status === "in_progress"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {issue.status === "in_progress"
                ? "In Progress"
                : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
            </Badge>

            <span className="text-sm font-medium text-foreground ml-2 mr-1">
              Severity:
            </span>
            <Badge
              data-testid="issue-severity-badge"
              className={`px-2.5 py-0.5 text-sm font-medium border ${
                issue.severity === "unplayable"
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : issue.severity === "playable"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              {severityCopy[issue.severity]}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Content (Timeline) */}
          <IssueTimeline issue={issue} />

          {/* Sticky Sidebar */}
          <IssueSidebar issue={issue} allUsers={allUsers} />
        </div>
      </div>
    </div>
  );
}
