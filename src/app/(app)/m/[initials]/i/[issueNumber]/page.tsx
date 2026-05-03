import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq, asc, and, notInArray } from "drizzle-orm";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueMetadata } from "~/components/issues/IssueMetadata";
import { StickyCommentComposer } from "~/components/issues/StickyCommentComposer";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { WatchButton } from "~/components/issues/WatchButton";
import {
  getMachineOwnerId,
  getMachineOwnerName,
  isUserMachineOwner,
} from "~/lib/issues/owner";
import { formatIssueId, resolveIssueReporter } from "~/lib/issues/utils";
import type { IssueWithAllRelations } from "~/lib/types";
import { BackToIssuesLink } from "~/components/issues/BackToIssuesLink";
import { getLastIssuesPath } from "~/lib/cookies/preferences";
import { EditableIssueTitle } from "./editable-issue-title";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { formatRelative } from "~/lib/dates";
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
  const reporter = resolveIssueReporter(issueWithRelations);
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
    <>
      <PageContainer
        size="narrow"
        className="pb-[calc(56px+64px+env(safe-area-inset-bottom))] md:pb-10"
      >
        <div className="space-y-2">
          <BackToIssuesLink href={issuesPath} className="md:hidden" />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex rounded-full border border-outline-variant bg-muted/40 px-2.5 py-0.5 font-mono text-xs font-bold">
              {formatIssueId(initials, issue.issueNumber)}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <Link
              href={`/m/${initials}`}
              data-testid="machine-link"
              className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
            >
              {issue.machine.name}
            </Link>
            {ownerName ? (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>Game Owner:</span>
                {issue.machine.owner?.id ? (
                  <Link
                    href={`/issues?owner=${issue.machine.owner.id}`}
                    className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
                  >
                    {ownerName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">
                    {ownerName}
                  </span>
                )}
              </>
            ) : null}
          </div>

          <PageHeader
            title={
              <EditableIssueTitle
                issueId={issue.id}
                title={issue.title}
                canEdit={userCanEditTitle}
                className="text-balance text-3xl font-bold tracking-tight"
              />
            }
          />

          <div
            data-testid="issue-detail-subtitle"
            className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
          >
            <span>
              by{" "}
              <span className="font-medium text-foreground">
                {reporter.name}
              </span>
            </span>
            {isUserMachineOwner(issueWithRelations, reporter.id) && (
              <OwnerBadge size="sm" />
            )}
            <span className="text-muted-foreground/50">·</span>
            <span title={`Last updated ${issue.updatedAt.toLocaleString()}`}>
              Updated {formatRelative(issue.updatedAt)}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>{issue.watchers.length} watching</span>
            {accessLevel !== "unauthenticated" && (
              <WatchButton
                issueId={issue.id}
                initialIsWatching={isWatching}
                iconOnly
                className="ml-1 h-7 w-7 rounded-full"
              />
            )}
          </div>
        </div>

        {ownerRequirements && (
          <OwnerRequirementsCallout
            ownerRequirements={ownerRequirements}
            machineName={issue.machine.name}
          />
        )}

        <IssueMetadata
          issue={issueWithRelations}
          allUsers={allUsers}
          currentUserId={user?.id ?? null}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />

        <section className="@container">
          <h2 className="hidden md:block text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-5">
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
      </PageContainer>

      {accessLevel !== "unauthenticated" && (
        <StickyCommentComposer issueId={issue.id} />
      )}
    </>
  );
}
