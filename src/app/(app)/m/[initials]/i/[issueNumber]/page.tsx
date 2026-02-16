import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq, asc, and, notInArray } from "drizzle-orm";
import { PageShell } from "~/components/layout/PageShell";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { getMachineOwnerId, getMachineOwnerName } from "~/lib/issues/owner";
import { formatIssueId } from "~/lib/issues/utils";
import { ImageGallery } from "~/components/images/ImageGallery";
import type { Issue, IssueWithAllRelations } from "~/lib/types";
import { BackToIssuesLink } from "~/components/issues/BackToIssuesLink";
import { getLastIssuesPath } from "~/lib/cookies/preferences";
import { canEditIssueTitle } from "~/lib/permissions";
import { EditableIssueTitle } from "./editable-issue-title";
import {
  type OwnershipContext,
  getAccessLevel,
} from "~/lib/permissions/helpers";
import { OwnerRequirementsCallout } from "~/components/machines/OwnerRequirementsCallout";

/**
 * Issue Detail Page
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

  // Read user preferences from cookies
  const issuesPath = await getLastIssuesPath();

  // Load auth context for permission-aware rendering
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const issueNum = parseInt(issueNumber, 10);

  if (isNaN(issueNum) || issueNum < 1) {
    redirect(`/m/${initials}`);
  }

  // CORE-PERF-003: Execute independent queries in parallel to avoid waterfall
  const [issue, allUsers, currentUserProfile] = await Promise.all([
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
            ownerRequirements: true,
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
          },
        },
        invitedReporter: {
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
            images: {
              where: (images, { isNull }) => isNull(images.deletedAt),
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
        frequency: true,
        issueNumber: true,
        machineInitials: true,
        reporterName: true,
        assignedTo: true,
        reportedBy: true,
        invitedReportedBy: true,
      },
    }),
    // Fetch all members/admins for assignment dropdown (Restrict to actual users)
    db
      .select({
        id: userProfiles.id,
        name: userProfiles.name,
      })
      .from(userProfiles)
      .where(notInArray(userProfiles.role, ["guest"]))
      .orderBy(asc(userProfiles.name)),
    // Fetch current user's profile for timeline permissions
    user?.id
      ? db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
          columns: { name: true, role: true },
        })
      : Promise.resolve(null),
  ]);

  if (!issue) {
    redirect(`/m/${initials}`);
  }

  // Cast issue to IssueWithAllRelations for type safety
  const issueWithRelations = issue as unknown as IssueWithAllRelations;
  const ownerName = getMachineOwnerName(issueWithRelations);
  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    reporterId: issueWithRelations.reportedBy,
    machineOwnerId: getMachineOwnerId(issueWithRelations),
  };

  // Compute title edit permission
  const userCanEditTitle = user
    ? canEditIssueTitle(
        { id: user.id, role: currentUserProfile?.role ?? "guest" },
        { reportedBy: issue.reportedBy, assignedTo: issue.assignedTo }
      )
    : false;

  return (
    <PageShell className="space-y-8" size="wide">
      {/* Back button */}
      <BackToIssuesLink href={issuesPath} />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono font-bold">
            {formatIssueId(initials, issue.issueNumber)}
          </span>
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
              {/* Only link for registered owners - invited owner IDs won't filter correctly */}
              {issue.machine.owner?.id ? (
                <Link
                  href={`/issues?owner=${issue.machine.owner.id}`}
                  className="font-medium text-foreground transition-colors hover:text-primary"
                >
                  {ownerName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{ownerName}</span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <EditableIssueTitle
            issueId={issue.id}
            title={issue.title}
            canEdit={userCanEditTitle}
          />
          <div className="flex flex-wrap items-center gap-2">
            <IssueBadgeGrid
              issue={
                issue as unknown as Pick<
                  Issue,
                  "status" | "severity" | "priority" | "frequency"
                >
              }
              variant="strip"
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Owner's Requirements Callout - only for authenticated users */}
      {user && issue.machine.ownerRequirements && (
        <OwnerRequirementsCallout
          ownerRequirements={issue.machine.ownerRequirements}
          machineName={issue.machine.name}
        />
      )}

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5 lg:pr-4">
          {issue.images.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Images ({issue.images.length})
              </h2>
              <ImageGallery
                images={issue.images.map((img) => ({
                  id: img.id,
                  fullImageUrl: img.fullImageUrl,
                  originalFilename: img.originalFilename,
                }))}
              />
            </div>
          )}

          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          <IssueTimeline
            issue={issueWithRelations}
            currentUserId={user?.id ?? null}
            currentUserRole={accessLevel}
            currentUserInitials={
              currentUserProfile?.name.slice(0, 2).toUpperCase() ?? "??"
            }
          />
        </section>

        {/* Sticky Sidebar */}
        <IssueSidebar
          issue={issueWithRelations}
          allUsers={allUsers}
          currentUserId={user?.id ?? null}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
      </div>
    </PageShell>
  );
}
