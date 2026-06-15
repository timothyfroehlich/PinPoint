import type React from "react";
import { type Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import { createClient } from "~/lib/supabase/server";
import { parseIssueFilters } from "~/lib/issues/filters";
import { loadIssueListPage } from "~/lib/issues/list-page";
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
  const machinesPromise = db.query.machines.findMany({
    orderBy: (m, { asc }) => [asc(m.name)],
    columns: { initials: true, name: true },
  });
  const ownedMachineInitialsPromise = user?.id
    ? db.query.machines.findMany({
        where: (m, { eq }) => eq(m.ownerId, user.id),
        columns: { initials: true },
        orderBy: (m, { asc }) => [asc(m.initials)],
      })
    : Promise.resolve([]);

  const [
    { issuesList, totalCount, filterUsers, assigneeUsers, page, pageSize },
    allMachines,
    ownedMachineRows,
  ] = await Promise.all([
    loadIssueListPage(filters, { isAdmin }),
    machinesPromise,
    ownedMachineInitialsPromise,
  ]);

  const ownedMachineInitials = ownedMachineRows.map((m) => m.initials);

  return (
    <PageContainer size="wide">
      <PageHeader title="All Issues" />

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
          sort={filters.sort ?? "updated_desc"}
          page={page}
          pageSize={pageSize}
          allUsers={assigneeUsers}
        />
      </div>
    </PageContainer>
  );
}
