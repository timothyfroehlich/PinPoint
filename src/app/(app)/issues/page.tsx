import type React from "react";
import { type Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import { IssueSummaryWidgets } from "~/components/issues/IssueSummaryWidgets";
import { createClient } from "~/lib/supabase/server";
import { DEFAULT_ISSUE_SORT, parseIssueFilters } from "~/lib/issues/filters";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { loadIssueListPage } from "~/lib/issues/list-page";
import {
  getMachineChoices,
  getOwnedMachineInitials,
} from "~/lib/machines/queries";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
export const metadata: Metadata = {
  title: "Issues | PinPoint",
  description: "View and filter all pinball machine issues.",
};

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IssuesPage({
  searchParams,
}: IssuesPageProps): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawParams = await searchParams;
  // parseIssueFilters expects URLSearchParams, so flatten the raw record.
  const urlParams = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      urlParams.set(key, value.join(","));
    } else if (value !== undefined) {
      urlParams.set(key, value);
    }
  });

  const filters = parseIssueFilters(urlParams);

  // Fetch current user profile to check role for visibility (if authenticated)
  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : undefined;

  const isAdmin = currentUserProfile?.role === "admin"; // permissions-audit-allow: isAdmin flag for SQL/query filtering, not a request gate

  // Add currentUserId for watching filter (if authenticated)
  filters.currentUserId = user?.id;

  // The all-machines list (filter dropdown) and owned-machine initials
  // (My-machines toggle) are specific to this page; run them alongside the
  // shared issues-list load so everything still resolves in parallel.
  // Owned initials are computed server-side so no user IDs reach the client
  // (CORE-SEC-006).
  // Removed machines are offered only when the presence filter includes
  // them; a machine already selected stays listed (issues-list 4.5).
  const machinesPromise = getMachineChoices(db, {
    includeRemoved: filters.includeInactiveMachines === true,
    keepInitials: filters.machine ?? [],
  }).then((rows) => rows.map(({ initials, name }) => ({ initials, name })));
  const ownedMachineInitialsPromise = user?.id
    ? getOwnedMachineInitials(db, user.id)
    : Promise.resolve([]);

  const [
    {
      issuesList,
      totalCount,
      filterUsers,
      assigneeUsers,
      page,
      pageSize,
      summary,
    },
    allMachines,
    ownedMachineInitials,
  ] = await Promise.all([
    loadIssueListPage(filters, { isAdmin }),
    machinesPromise,
    ownedMachineInitialsPromise,
  ]);

  return (
    <PageContainer size="wide">
      <PageHeader title="All Issues" />

      <IssueSummaryWidgets summary={summary} />

      <p className="text-sm text-muted-foreground">
        Showing {issuesList.length} of {totalCount} issues
      </p>

      <div className="space-y-6">
        {/* Filters */}
        <IssueFilters
          users={filterUsers}
          machines={allMachines}
          filters={filters}
          currentUserId={user?.id ?? null}
          ownedMachineInitials={ownedMachineInitials}
        />

        {/* Issues List */}
        <IssueList
          issues={issuesList}
          totalCount={totalCount}
          sort={filters.sort ?? DEFAULT_ISSUE_SORT}
          page={page}
          pageSize={pageSize}
          allUsers={assigneeUsers}
          viewer={{
            userId: user?.id,
            accessLevel: getAccessLevel(currentUserProfile?.role),
          }}
        />
      </div>
    </PageContainer>
  );
}
