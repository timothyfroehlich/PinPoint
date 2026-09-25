import type React from "react";
import { parseIssueFilters } from "~/lib/issues/filters";
import { loadIssueListPage } from "~/lib/issues/list-page";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueList } from "~/components/issues/IssueList";
import type { CollectionMachine } from "~/lib/collections/owner";

interface MachineGroupIssuesTabProps {
  machines: CollectionMachine[];
  searchParams: Record<string, string | string[] | undefined>;
  viewer: { userId: string | undefined; isAdmin: boolean };
}

/**
 * Machine group Issues tab, shared by Collections, Owner Collections, and
 * tags (spec collections-and-tags 4.4).
 */
export async function MachineGroupIssuesTab({
  machines,
  searchParams: rawParams,
  viewer,
}: MachineGroupIssuesTabProps): Promise<React.JSX.Element> {
  const urlParams = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (Array.isArray(value)) urlParams.set(key, value.join(","));
    else if (value !== undefined) urlParams.set(key, value);
  });
  const filters = parseIssueFilters(urlParams);

  // Force-scope to the collection. Requested machine filters narrow WITHIN
  // the set; they can never widen it. Empty scope -> no query (an empty
  // machine[] is dropped by buildWhereConditions, which would unscope).
  const collectionInitials = machines.map((m) => m.initials);
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

  filters.currentUserId = viewer.userId;
  const { issuesList, totalCount, filterUsers, assigneeUsers, page, pageSize } =
    await loadIssueListPage(filters, { isAdmin: viewer.isAdmin });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Showing {issuesList.length} of {totalCount} issues
      </p>
      <IssueFilters
        users={filterUsers}
        machines={machines.map((m) => ({
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
