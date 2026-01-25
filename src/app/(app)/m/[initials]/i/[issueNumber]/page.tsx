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

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ initials: string; issueNumber: string }>;
}): Promise<React.JSX.Element> {
  const { initials, issueNumber } = await params;

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

  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const isMemberOrAdmin =
    currentUserProfile?.role === "member" ||
    currentUserProfile?.role === "admin";

  const [issue, allUsers] = await Promise.all([
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
            email: true,
          },
        },
        invitedReporter: {
          columns: {
            id: true,
            name: true,
            email: true,
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
        images: {
          where: (images, { isNull }) => isNull(images.deletedAt),
        },
        watchers: {
          columns: { userId: true },
        },
      },
      columns: {
        id: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        description: true,
        status: true,
        severity: true,
        priority: true,
        consistency: true,
        issueNumber: true,
        machineInitials: true,
        reporterName: true,
        reporterEmail: true,
      },
    }),
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

  const issueWithRelations = issue as unknown as IssueWithAllRelations;
  const ownerName = getMachineOwnerName(issueWithRelations);

  return (
    <PageShell className="space-y-8" size="wide">
      <Link
        href={`/m/${initials}/i`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Issues
      </Link>

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
              <span>Game Owner:</span>
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

        <IssueSidebar
          issue={issueWithRelations}
          allUsers={allUsers}
          currentUserId={user.id}
        />
      </div>
    </PageShell>
  );
}
