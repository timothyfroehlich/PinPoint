import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { eq, asc, and, ne, notInArray, sql } from "drizzle-orm";
import { IssueActivity } from "~/components/issues/IssueActivity";
import { IssueDetails } from "~/components/issues/IssueDetails";
import { InitialReport } from "~/components/issues/InitialReport";
import { IssueSummaryLine } from "~/components/issues/IssueSummaryLine";
import {
  OTHER_ISSUES_LIMIT,
  OtherIssues,
} from "~/components/issues/OtherIssues";
import { FloatingCommentButton } from "~/components/issues/FloatingCommentButton";
import {
  IssueSectionPanel,
  IssueSectionTabList,
  IssueSections,
} from "~/components/issues/IssueSectionTabs";
import { getMachineOwnerId } from "~/lib/issues/owner";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import type { IssueWithAllRelations } from "~/lib/types";
import { EditableIssueTitle } from "./editable-issue-title";
import { MoveIssueButton } from "./move-issue-button";
import { PageContainer } from "~/components/layout/PageContainer";
import { OwnerRequirementsCallout } from "~/components/machines/OwnerRequirementsCallout";
import {
  type OwnershipContext,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/helpers";
import { reportAuthError } from "~/lib/observability/report-error";

/**
 * Issue Detail Page
 *
 * Spec: docs/feature-specs/issue-detail.md. Mobile splits the page below the
 * header into Issue / Details / Other issues tabs; desktop shows two panes,
 * with Details and Other issues in the right column.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ initials: string; issueNumber: string }>;
}): Promise<React.JSX.Element> {
  // Get params (Next.js 16: params is a Promise)
  const { initials, issueNumber } = await params;

  // Load auth context for permission-aware rendering
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    // Backend glitch: keep rendering (as unauthenticated) rather than crash,
    // but capture the error so the silent guest-downgrade is observable.
    // AuthSessionMissingError is the normal no-session response for logged-out
    // visitors and is suppressed; only real token-validation failures reach Sentry.
    reportAuthError(authError, {
      action: "issue-detail-page.auth.getUser",
      bestEffort: true,
    });
  }

  const issueNum = parseInt(issueNumber, 10);

  if (isNaN(issueNum) || issueNum < 1) {
    notFound();
  }

  // CORE-PERF-003: parallelize what's safe before role is known; the roster
  // and machine-list fetches are gated below on permission.
  const otherOpenIssues = and(
    eq(issues.machineInitials, initials),
    ne(issues.issueNumber, issueNum),
    notInArray(issues.status, [...CLOSED_STATUSES])
  );

  const [issue, currentUserProfile, otherIssues, otherIssuesCount] =
    await Promise.all([
      // Query issue with all relations
      db.query.issues.findFirst({
        where: and(
          eq(issues.machineInitials, initials),
          eq(issues.issueNumber, issueNum)
        ),
        columns: { reporterEmail: false },
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
          assignedToUser: {
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
      // Fetch current user's profile for permission-aware rendering and to
      // gate the (potentially expensive + privacy-sensitive) assignee roster
      // fetch below.
      user?.id
        ? db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
            columns: { role: true },
          })
        : Promise.resolve(null),
      // The machine's other open issues: the newest few, and how many in all
      // (spec §10.5, §11.1).
      db.query.issues.findMany({
        where: otherOpenIssues,
        columns: {
          id: true,
          issueNumber: true,
          title: true,
          status: true,
          severity: true,
          priority: true,
          frequency: true,
          machineInitials: true,
          createdAt: true,
          reporterName: true,
        },
        orderBy: (otherIssue, { desc }) => [desc(otherIssue.createdAt)],
        limit: OTHER_ISSUES_LIMIT,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(otherOpenIssues)
        .then((rows) => rows[0]?.count ?? 0),
    ]);

  if (!issue) {
    notFound();
  }

  const issueWithRelations: IssueWithAllRelations = issue;
  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    reporterId: issueWithRelations.reportedBy,
    machineOwnerId: getMachineOwnerId(issueWithRelations),
  };

  // Don't serialize the member roster to viewers who can't open the picker —
  // privacy + payload regression with no benefit. Non-triage viewers still get
  // the currently-assigned user so AssignIssueForm's readonly path can display
  // their name instead of "Unassigned".
  const canTriage = checkPermission(
    "issues.update.triage",
    accessLevel,
    ownershipContext
  );
  const userCanReassign = checkPermission(
    "issues.reassign",
    accessLevel,
    ownershipContext
  );

  // Both gated queries run in parallel; viewers without the relevant
  // permission skip the round-trip entirely.
  const [allUsers, allMachines] = await Promise.all([
    canTriage
      ? db
          .select({ id: userProfiles.id, name: userProfiles.name })
          .from(userProfiles)
          .where(notInArray(userProfiles.role, ["guest"]))
          .orderBy(asc(userProfiles.name))
      : Promise.resolve(issue.assignedToUser ? [issue.assignedToUser] : []),
    userCanReassign
      ? db.query.machines.findMany({
          columns: { initials: true, name: true },
          orderBy: asc(machines.name),
        })
      : Promise.resolve([]),
  ]);

  const ownerRequirements = user
    ? (issue.machine.ownerRequirements ?? undefined)
    : undefined;
  const userCanEditTitle = checkPermission(
    "issues.update.reporting",
    accessLevel,
    ownershipContext
  );

  return (
    <>
      <PageContainer size="wide" className="max-w-[1120px] pb-28 md:pb-10">
        <IssueSections>
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
            <div className="min-w-0 space-y-5">
              <header className="space-y-2 md:border-b md:border-outline-variant md:pb-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex rounded-full border border-outline-variant bg-muted/40 px-2.5 py-0.5 font-mono text-xs font-bold text-muted-foreground">
                    {formatIssueId(initials, issue.issueNumber)}
                  </span>
                  <Link
                    href={`/m/${initials}`}
                    data-testid="machine-link"
                    className="font-semibold text-foreground transition-colors duration-150 hover:text-primary"
                  >
                    {issue.machine.name}
                  </Link>
                </div>
                <EditableIssueTitle
                  issueId={issue.id}
                  title={issue.title}
                  canEdit={userCanEditTitle}
                  actions={
                    userCanReassign ? (
                      <MoveIssueButton
                        issueId={issue.id}
                        currentInitials={initials}
                        machines={allMachines}
                      />
                    ) : undefined
                  }
                />
                <IssueSummaryLine
                  status={issue.status}
                  severity={issue.severity}
                  priority={issue.priority}
                />
              </header>

              <IssueSectionTabList otherIssuesCount={otherIssuesCount} />

              <IssueSectionPanel section="issue" className="space-y-6">
                <InitialReport issue={issueWithRelations} />
                {ownerRequirements && (
                  <OwnerRequirementsCallout
                    ownerRequirements={ownerRequirements}
                  />
                )}
                <IssueActivity
                  issue={issueWithRelations}
                  currentUserId={user?.id ?? null}
                  currentUserRole={accessLevel}
                />
              </IssueSectionPanel>
            </div>

            <div className="min-w-0 space-y-6 max-md:mt-5">
              <IssueSectionPanel section="details" className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground max-md:sr-only">
                  Details
                </h2>
                <IssueDetails
                  issue={issueWithRelations}
                  allUsers={allUsers}
                  currentUserId={user?.id ?? null}
                  accessLevel={accessLevel}
                  ownershipContext={ownershipContext}
                />
              </IssueSectionPanel>
              <IssueSectionPanel section="other">
                <OtherIssues
                  issues={otherIssues}
                  machineName={issue.machine.name}
                  machineInitials={initials}
                />
              </IssueSectionPanel>
            </div>
          </div>
        </IssueSections>
      </PageContainer>

      {accessLevel !== "unauthenticated" && (
        <FloatingCommentButton issueId={issue.id} />
      )}
    </>
  );
}
