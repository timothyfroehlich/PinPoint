import type React from "react";
import { type Metadata } from "next";
import { and } from "drizzle-orm";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import type { IssueListItem } from "~/lib/types";

import { parseIssueFilters } from "~/lib/issues/filters";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import { count } from "drizzle-orm";

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

  if (!user) {
    redirect("/login?next=%2Fissues");
  }

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
  // Add currentUserId for watching filter
  filters.currentUserId = user.id;
  const whereConditions = buildWhereConditions(filters);
  const orderBy = buildOrderBy(filters.sort);
  const pageSize = filters.pageSize ?? 15;
  const page = filters.page ?? 1;

  // 2. Start independent queries immediately
  const machinesPromise = db.query.machines.findMany({
    orderBy: (m, { asc }) => [asc(m.name)],
    columns: { initials: true, name: true },
  });

  const usersPromise = db.query.userProfiles.findMany({
    orderBy: (u, { asc }) => [asc(u.name)],
    columns: { id: true, name: true },
  });

  const issuesPromise = db.query.issues.findMany({
    where: and(...whereConditions),
    orderBy: orderBy,
    with: {
      machine: {
        columns: { id: true, name: true },
      },
      reportedByUser: {
        columns: { id: true, name: true, email: true },
      },
      invitedReporter: {
        columns: { id: true, name: true, email: true },
      },
      assignedToUser: {
        columns: { id: true, name: true, email: true },
      },
    },
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const totalCountPromise = db
    .select({ value: count() })
    .from(issues)
    .where(and(...whereConditions));

  // 3. Await all promises in parallel
  const [allMachines, allUsers, issuesListRaw, totalCountResult] =
    await Promise.all([
      machinesPromise,
      usersPromise,
      issuesPromise,
      totalCountPromise,
    ]);

  const totalCount = totalCountResult[0]?.value ?? 0;

  const issuesList = issuesListRaw as IssueListItem[];

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 sm:px-6">
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
          users={allUsers}
          machines={allMachines}
          filters={filters}
        />

        {/* Issues List */}
        <IssueList
          issues={issuesList}
          totalCount={totalCount}
          sort={filters.sort ?? "updated_desc"}
          page={page}
          pageSize={pageSize}
          allUsers={allUsers}
        />
      </div>
    </div>
  );
}
