import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq, asc, and, notInArray } from "drizzle-orm";
import { PageShell } from "~/components/layout/PageShell";
import { IssueTimeline } from "~/components/issues/IssueTimeline";
import { IssueSidebar } from "~/components/issues/IssueSidebar";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { MobileDetailsPanel } from "~/components/issues/MobileDetailsPanel";
import { getMachineOwnerId, getMachineOwnerName } from "~/lib/issues/owner";
import { formatIssueId } from "~/lib/issues/utils";
import { ImageGallery } from "~/components/images/ImageGallery";
import type { Issue, IssueWithAllRelations } from "~/lib/types";
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
 * Mobile-first layout:
 * - Back nav row + issue ID chip
 * - Machine context link
 * - Inline badge strip
 * - Owner requirements callout (conditional)
 * - Assignee + Watch + Edit Details row (with collapsible details panel)
 * - Images section
 * - Activity/Timeline
 *
 * Desktop (md:) falls back to the original two-column sidebar layout.
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

  const issueId = formatIssueId(initials, issue.issueNumber);
  const ownerRequirements = user
    ? (issue.machine.ownerRequirements ?? undefined)
    : undefined;

  return (
    <PageShell
      className="space-y-0 px-0 py-0 sm:px-8 sm:py-10 lg:px-10"
      size="wide"
    >
      <div className="px-4 py-4 sm:px-0 sm:py-0 space-y-4 sm:space-y-8">
        {/* ── MOBILE: Back nav row + issue ID chip ── */}
        <div
          className="flex items-center justify-between gap-2 md:hidden"
          data-testid="mobile-nav-row"
        >
          <Link
            href={issuesPath}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to issues"
          >
            <ArrowLeft className="size-4" />
            <span>Issues</span>
          </Link>
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
            {issueId}
          </span>
        </div>

        {/* ── DESKTOP: Back button (hidden on mobile) ── */}
        <div className="hidden md:block">
          <Link
            href={issuesPath}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Issues
          </Link>
        </div>

        {/* ── Machine context link ── */}
        <Link
          href={`/m/${initials}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          data-testid="mobile-machine-link"
        >
          {issue.machine.name}
        </Link>

        {/* ── DESKTOP: Issue ID + machine + owner (hidden on mobile) ── */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono font-bold">
            {issueId}
          </span>
          {ownerName && (
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
                <span className="font-medium text-foreground">{ownerName}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Issue title ── */}
        <div className="space-y-3">
          <EditableIssueTitle
            issueId={issue.id}
            title={issue.title}
            canEdit={userCanEditTitle}
          />

          {/* ── Badge strip ── */}
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="mobile-badge-strip"
          >
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

        {/* ── Owner requirements callout (mobile: above fold; desktop: in timeline) ── */}
        {ownerRequirements && (
          <div className="md:hidden">
            <OwnerRequirementsCallout
              ownerRequirements={ownerRequirements}
              machineName={issue.machine.name}
            />
          </div>
        )}

        {/* ── MOBILE: Collapsible details panel (replaces sidebar) ── */}
        <MobileDetailsPanel
          issue={issueWithRelations}
          allUsers={allUsers}
          currentUserId={user?.id ?? null}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />

        {/* ── Main content area (two-column on desktop) ── */}
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-5 lg:pr-4" data-testid="mobile-timeline">
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
              ownerRequirements={
                // On mobile, owner requirements are shown above the fold.
                // On desktop (md:), show them in the timeline after the initial report.
                ownerRequirements
              }
              machineName={issue.machine.name}
            />
          </section>

          {/* ── DESKTOP: Sticky Sidebar (hidden on mobile via md: grid) ── */}
          <IssueSidebar
            issue={issueWithRelations}
            allUsers={allUsers}
            currentUserId={user?.id ?? null}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </div>
      </div>
    </PageShell>
  );
}
