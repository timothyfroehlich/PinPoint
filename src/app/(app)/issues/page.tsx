import type React from "react";
import { type Metadata } from "next";
import { and } from "drizzle-orm";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { getUnifiedUsers } from "~/lib/users/queries";
import { IssueList } from "~/components/issues/IssueList";
import { createClient } from "~/lib/supabase/server";
import type { IssueListItem } from "~/lib/types";

import { parseIssueFilters } from "~/lib/issues/filters";
import { ISSUE_LIST_COLUMNS } from "~/lib/issues/queries";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import { count, eq } from "drizzle-orm";
import { PageShell } from "~/components/layout/PageShell";

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

  // 1. Parse filters from searchParams
  const rawParams = await searchParams;
  // Convert Record to URLSearchParams (parseIssueFilters expects URLSearchParams)
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

  const isAdmin = currentUserProfile?.role === "admin";

  // Add currentUserId for watching filter (if authenticated)
  filters.currentUserId = user?.id;
  const where = buildWhereConditions(filters, db, { isAdmin });
  const orderBy = buildOrderBy(filters.sort);
  const pageSize = filters.pageSize ?? 15;
  const page = filters.page ?? 1;

  // 2. Start independent queries immediately
  const machinesPromise = db.query.machines.findMany({
    orderBy: (m, { asc }) => [asc(m.name)],
    columns: { initials: true, name: true },
  });

  // Fetch owned machine initials for the "My machines" quick-select toggle.
  // Computed server-side so no user IDs are sent to the client (CORE-SEC-006).
  const ownedMachineInitialsPromise = user?.id
    ? db.query.machines.findMany({
        where: (m, { eq }) => eq(m.ownerId, user.id),
        columns: { initials: true },
        orderBy: (m, { asc }) => [asc(m.initials)],
      })
    : Promise.resolve([]);

  const usersPromise = getUnifiedUsers();

  const issuesPromise = db.query.issues.findMany({
    where: and(...where),
    orderBy: orderBy,
    with: {
      machine: {
        columns: { id: true, name: true },
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
    },
    columns: ISSUE_LIST_COLUMNS,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const totalCountPromise = db
    .select({ value: count() })
    .from(issues)
    .where(and(...where));

  // 3. Await all promises in parallel
  const [
    allMachines,
    allUsers,
    issuesListRaw,
    totalCountResult,
    ownedMachineRows,
  ] = await Promise.all([
    machinesPromise,
    usersPromise,
    issuesPromise,
    totalCountPromise,
    ownedMachineInitialsPromise,
  ]);

  const ownedMachineInitials = ownedMachineRows.map((m) => m.initials);

  const totalCount = totalCountResult[0]?.value ?? 0;

  const issuesList = issuesListRaw as IssueListItem[];

  // CORE-SEC-006: Map to minimal shapes before passing to client components
  const filterUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    machineCount: u.machineCount,
    status: u.status,
  }));

  const assigneeUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
  }));

  return (
    <PageShell size="wide" padded={false} className="py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Issues</h1>
          <p className="text-muted-foreground">
            Track and manage reported problems across the collection.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {issuesList.length} of {totalCount} issues
        </div>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <IssueFilters
          users={filterUsers}
          machines={allMachines}
          filters={filters}
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
    </PageShell>
  );
}
