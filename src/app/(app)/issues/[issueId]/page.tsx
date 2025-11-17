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

const severityClasses: Record<IssueSeverity, string> = {
  minor: "bg-amber-50 text-amber-900 border-amber-200",
  playable: "bg-blue-50 text-blue-900 border-blue-200",
  unplayable: "bg-red-50 text-red-900 border-red-200",
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
          orderBy: (comments, { desc: orderDesc }) => [
            orderDesc(comments.createdAt),
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
    <main className="min-h-screen bg-surface py-8">
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
          className="mb-4 inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="size-4" />
          Back to Issues
        </Link>

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-on-surface flex items-center gap-2">
            {issue.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              data-testid="issue-status-badge"
              className={`px-2 py-1 text-sm font-semibold ${
                issue.status === "resolved"
                  ? "bg-green-100 text-green-800 border-green-300"
                  : issue.status === "in_progress"
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : "bg-gray-100 text-gray-800 border-gray-300"
              }`}
            >
              {issue.status === "in_progress"
                ? "In Progress"
                : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
            </Badge>
            <Badge
              data-testid="issue-severity-badge"
              className={`border px-2 py-1 text-sm font-semibold ${severityClasses[issue.severity]}`}
            >
              {severityCopy[issue.severity]}
            </Badge>
            <p className="text-sm text-on-surface-variant">
              Opened by{" "}
              {issue.reportedByUser?.name ??
                issue.reporterName ??
                "Anonymous"}{" "}
              on {new Date(issue.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-on-surface">
            <div className="flex flex-wrap gap-1">
              <span className="font-semibold">Machine:</span>
              <Link
                href={`/machines/${issue.machine.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {issue.machine.name}
              </Link>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="font-semibold">Reported by:</span>
              <span>
                {issue.reportedByUser?.name ??
                  issue.reporterName ??
                  "Anonymous"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 text-on-surface-variant">
              <span className="font-semibold text-on-surface">Reported:</span>
              <span>{new Date(issue.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Content (Timeline) */}
          <IssueTimeline issue={issue} />

          {/* Sticky Sidebar */}
          <IssueSidebar issue={issue} allUsers={allUsers} />
        </div>
      </div>
    </main>
  );
}
