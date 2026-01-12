import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc, and, notInArray, sql } from "drizzle-orm";
import { PageShell } from "~/components/layout/PageShell";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { getMachineOwnerName } from "~/lib/issues/owner";
import { formatIssueId } from "~/lib/issues/utils";
import type { Issue, IssueWithAllRelations } from "~/lib/types";

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
  // Get params (Next.js 16: params is a Promise)
  const { initials, issueNumber } = await params;

  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/m/${initials}/i/${issueNumber}`);
    redirect(`/login?next=${next}`);
  }
  const issueNum = parseInt(issueNumber, 10);

  if (isNaN(issueNum) || issueNum < 1) {
    redirect(`/m/${initials}`);
  }

  // Fetch current user profile to check roles for visibility
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const isMemberOrAdmin =
    currentUserProfile?.role === "member" ||
    currentUserProfile?.role === "admin";

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
          with: {
            owner: {
              columns: {
                id: true,
                name: true,
              },
            },
            invitedOwner: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        reportedByUser: {
          columns: {
            id: true,
            name: true,
            ...(isMemberOrAdmin && { email: true }),
          },
        },
        invitedReporter: {
          columns: {
            id: true,
            name: true,
            ...(isMemberOrAdmin && { email: true }),
          },
        },
        assignedToUser: {
          columns: {
            id: true,
            name: true,
            ...(isMemberOrAdmin && { email: true }),
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
    // Fetch all members/admins for assignment dropdown (Restrict to actual users)
    db
      .select({
        id: userProfiles.id,
        name: userProfiles.name,
        email: isMemberOrAdmin
          ? sql<string | null>`COALESCE(${authUsers.email}, null)`
          : sql<null>`null`,
      })
      .from(userProfiles)
      .leftJoin(authUsers, eq(authUsers.id, userProfiles.id))
      .where(notInArray(userProfiles.role, ["guest"]))
      .orderBy(asc(userProfiles.name)),
  ]);

  if (!issue) {
    redirect(`/m/${initials}`);
  }

  // Cast issue to IssueWithAllRelations for type safety
  const issueWithRelations = issue as unknown as IssueWithAllRelations;
  const ownerName = getMachineOwnerName(issueWithRelations);

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/m/${initials}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {issue.machine.name}
          </Link>
          {ownerName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>•</span>
              <span>Owner:</span>
              <span className="font-medium text-foreground">{ownerName}</span>
              <OwnerBadge size="sm" />
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h1 className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-2xl">
              {formatIssueId(initials, issue.issueNumber)}
            </span>{" "}
            {issue.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <IssueBadgeGrid
              issue={
                issue as unknown as Pick<
                  Issue,
                  "status" | "severity" | "priority" | "consistency"
                >
              }
              variant="strip"
              size="lg"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5 lg:pr-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          <IssueTimeline issue={issueWithRelations} />
        </section>

        {/* Sticky Sidebar */}
        <IssueSidebar
          issue={issueWithRelations}
          allUsers={allUsers}
          currentUserId={user.id}
        />
      </div>
    </PageShell>
  );
}
