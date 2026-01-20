import type React from "react";
import { type Metadata } from "next";
import { and } from "drizzle-orm";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "~/lib/utils";
import type { IssueListItem } from "~/lib/types";

import {
  parseIssueFilters,
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters";
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
  const whereConditions = buildWhereConditions(filters);

  const orderBy = buildOrderBy(filters.sort);

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
    limit: filters.pageSize,
    offset: (filters.page! - 1) * filters.pageSize!,
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
          machines={allMachines}
          users={allUsers}
          filters={filters}
        />

        {/* Issues List */}
        <IssueList
          issues={issuesList}
          totalCount={totalCount}
          sort={filters.sort!}
          page={filters.page!}
          pageSize={filters.pageSize!}
          allUsers={allUsers}
        />

        {/* Results Info & Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(filters.page! - 1) * filters.pageSize! + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(filters.page! * filters.pageSize!, totalCount)}
            </span>{" "}
            of <span className="font-medium text-foreground">{totalCount}</span>{" "}
            results
          </div>

          {totalCount > filters.pageSize! && (
            <div className="flex items-center gap-1">
              <Link
                href={{
                  query: { ...rawParams, page: Math.max(1, filters.page! - 1) },
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3",
                  filters.page === 1 && "pointer-events-none opacity-50"
                )}
              >
                Previous
              </Link>

              <div className="flex items-center gap-1 mx-2">
                {(() => {
                  const totalPages = Math.ceil(totalCount / filters.pageSize!);
                  const currentPage = filters.page!;
                  const pages: (number | string)[] = [];

                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");

                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);

                    for (let i = start; i <= end; i++) {
                      if (!pages.includes(i)) pages.push(i);
                    }

                    if (currentPage < totalPages - 2) pages.push("...");
                    if (!pages.includes(totalPages)) pages.push(totalPages);
                  }

                  return pages.map((p, i) => {
                    if (p === "...") {
                      return (
                        <span
                          key={`dots-${i}`}
                          className="w-9 h-9 flex items-center justify-center text-muted-foreground"
                        >
                          ...
                        </span>
                      );
                    }
                    const pageNum = p as number;
                    return (
                      <Link
                        key={pageNum}
                        href={{ query: { ...rawParams, page: pageNum } }}
                        className={cn(
                          "inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9",
                          filters.page === pageNum
                            ? "bg-primary text-primary-foreground shadow"
                            : "hover:bg-accent hover:text-accent-foreground border border-transparent"
                        )}
                      >
                        {pageNum}
                      </Link>
                    );
                  });
                })()}
              </div>

              <Link
                href={{
                  query: {
                    ...rawParams,
                    page: Math.min(
                      Math.ceil(totalCount / filters.pageSize!),
                      filters.page! + 1
                    ),
                  },
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3",
                  filters.page! >= Math.ceil(totalCount / filters.pageSize!) &&
                    "pointer-events-none opacity-50"
                )}
              >
                Next
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
