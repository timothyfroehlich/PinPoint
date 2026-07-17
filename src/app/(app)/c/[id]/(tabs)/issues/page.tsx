import type React from "react";
import { notFound } from "next/navigation";
import { parseIssueFilters } from "~/lib/issues/filters";
import { loadIssueListPage } from "~/lib/issues/list-page";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import { getCollectionForLayout, getViewer } from "~/app/(app)/c/[id]/_data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionIssuesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();
  const collection = data.collection;

  // Request-deduped with the layout/resolver — one getUser() + role read.
  const viewer = await getViewer();

  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (Array.isArray(value)) urlParams.set(key, value.join(","));
    else if (value !== undefined) urlParams.set(key, value);
  });
  const filters = parseIssueFilters(urlParams);

  // Force-scope to the collection. Requested machine filters narrow WITHIN
  // the set; they can never widen it. Empty scope -> no query (an empty
  // machine[] is dropped by buildWhereConditions, which would unscope).
  const collectionInitials = collection.machines.map((m) => m.initials);
  if (collectionInitials.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        This collection has no machines yet.
      </p>
    );
  }

  const requested = filters.machine ?? [];
  const scoped =
    requested.length > 0
      ? requested.filter((i) => collectionInitials.includes(i))
      : collectionInitials;

  if (scoped.length === 0) {
    // The collection has machines, but the requested ?machine= filter selects
    // none of them (a stale bookmark or hand-edited param — the filter UI only
    // offers this collection's machines). Name the cause rather than implying
    // the collection itself is empty.
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No issues match the selected machine filter.
      </p>
    );
  }
  filters.machine = scoped;

  const isAdmin = viewer.role === "admin"; // permissions-audit-allow: SQL visibility flag, mirrors /issues page

  filters.currentUserId = viewer.userId;
  const { issuesList, totalCount, filterUsers, assigneeUsers, page, pageSize } =
    await loadIssueListPage(filters, { isAdmin });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Showing {issuesList.length} of {totalCount} issues
      </p>
      <IssueFilters
        users={filterUsers}
        machines={collection.machines.map((m) => ({
          initials: m.initials,
          name: m.name,
        }))}
        filters={filters}
        currentUserId={viewer.userId ?? null}
      />
      <IssueList
        issues={issuesList}
        totalCount={totalCount}
        sort={filters.sort ?? "updated_desc"}
        page={page}
        pageSize={pageSize}
        allUsers={assigneeUsers}
      />
    </div>
  );
}
