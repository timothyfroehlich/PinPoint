import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq, asc, and, notInArray } from "drizzle-orm";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { SidebarActions } from "~/components/issues/SidebarActions";
import { WatchButton } from "~/components/issues/WatchButton";
import { getMachineOwnerId, getMachineOwnerName } from "~/lib/issues/owner";
import { formatIssueId } from "~/lib/issues/utils";
import type { IssueWithAllRelations } from "~/lib/types";
import { BackToIssuesLink } from "~/components/issues/BackToIssuesLink";
import { getLastIssuesPath } from "~/lib/cookies/preferences";
import { EditableIssueTitle } from "./editable-issue-title";
import { OwnerRequirementsCallout } from "~/components/machines/OwnerRequirementsCallout";
import {
  type OwnershipContext,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/helpers";

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
  const ownerRequirements = user
    ? (issue.machine.ownerRequirements ?? undefined)
    : undefined;
  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    reporterId: issueWithRelations.reportedBy,
    machineOwnerId: getMachineOwnerId(issueWithRelations),
  };

  // Compute title edit permission
  const userCanEditTitle = checkPermission(
    "issues.update.reporting",
    accessLevel,
    ownershipContext
  );
  const isWatching = user?.id
    ? issue.watchers.some((watcher) => watcher.userId === user.id)
    : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <div className="space-y-4 sm:space-y-8">
        <div className="hidden md:block">
          <BackToIssuesLink href={issuesPath} />
        </div>

        <div className="space-y-4">
          <div
            className="flex items-center gap-2 md:hidden"
            data-testid="mobile-nav-row"
          >
            <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-xs font-bold text-muted-foreground">
              {formatIssueId(initials, issue.issueNumber)}
            </span>
            <Link
              href={`/m/${initials}`}
              data-testid="machine-link"
              className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {issue.machine.name}
            </Link>
          </div>

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <span className="font-mono font-bold text-muted-foreground">
              {formatIssueId(initials, issue.issueNumber)}
            </span>
            <Link
              href={`/m/${initials}`}
              data-testid="machine-link"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {issue.machine.name}
            </Link>
            {ownerName ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>•</span>
                <span>Game Owner:</span>
                {issue.machine.owner?.id ? (
                  <Link
                    href={`/issues?owner=${issue.machine.owner.id}`}
                    className="font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {ownerName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {ownerName}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <EditableIssueTitle
            issueId={issue.id}
            title={issue.title}
            canEdit={userCanEditTitle}
            className="text-xl font-extrabold tracking-tight md:text-3xl"
          />

          <div className="space-y-2 md:hidden">
            <div className="flex items-center gap-2 border-y py-2">
              <div className="min-w-0 flex-1">
                <SidebarActions
                  issue={issueWithRelations}
                  allUsers={allUsers}
                  currentUserId={user?.id ?? null}
                  accessLevel={accessLevel}
                  ownershipContext={ownershipContext}
                  compact
                  only="assignee"
                />
              </div>
              {accessLevel !== "unauthenticated" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <WatchButton
                    issueId={issue.id}
                    initialIsWatching={isWatching}
                    iconOnly
                  />
                  <span className="text-sm text-muted-foreground">
                    {issue.watchers.length}
                  </span>
                </div>
              ) : null}
            </div>

            <div data-testid="issue-badge-strip">
              <SidebarActions
                issue={issueWithRelations}
                allUsers={allUsers}
                currentUserId={user?.id ?? null}
                accessLevel={accessLevel}
                ownershipContext={ownershipContext}
                compact
                exclude="assignee"
                rowLayout
              />
            </div>

            {ownerRequirements ? (
              <OwnerRequirementsCallout
                ownerRequirements={ownerRequirements}
                machineName={issue.machine.name}
              />
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-5 lg:pr-4">
            <IssueTimeline
              issue={issueWithRelations}
              currentUserId={user?.id ?? null}
              currentUserRole={accessLevel}
              currentUserInitials={
                currentUserProfile?.name.slice(0, 2).toUpperCase() ?? "??"
              }
              ownerRequirements={ownerRequirements}
              machineName={issue.machine.name}
            />
          </section>

          <div className="hidden md:block">
            <IssueSidebar
              issue={issueWithRelations}
              allUsers={allUsers}
              currentUserId={user?.id ?? null}
              accessLevel={accessLevel}
              ownershipContext={ownershipContext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
