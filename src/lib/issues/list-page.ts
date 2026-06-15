import { and, count } from "drizzle-orm";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { getUnifiedUsers } from "~/lib/users/queries";
import { ISSUE_LIST_COLUMNS } from "~/lib/issues/queries";
import {
  buildOrderBy,
  buildWhereConditions,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import type { IssueListItem, UnifiedUser } from "~/lib/types";

/** Minimal user shapes sent to the client filter/assignee controls (CORE-SEC-006). */
export type IssueFilterUser = Pick<
  UnifiedUser,
  "id" | "name" | "machineCount" | "status"
>;
export type IssueAssigneeUser = Pick<UnifiedUser, "id" | "name">;

export interface IssueListPageData {
  issuesList: IssueListItem[];
  totalCount: number;
  filterUsers: IssueFilterUser[];
  assigneeUsers: IssueAssigneeUser[];
  page: number;
  pageSize: number;
}

/**
 * Shared loader for the paginated issues-list pages (`/issues` and the
 * collection Issues tab; a future `/c/tag/[slug]` is the third consumer).
 * Runs the list query, the total-count query, and the user lookup in parallel,
 * then projects users to the minimal client shapes (CORE-SEC-006) — keeping the
 * exposed field set identical across pages so the two can't drift.
 *
 * Callers parse and scope `filters` themselves (e.g. the collection page
 * force-scopes `filters.machine` to its set) and own their page chrome plus any
 * extra queries (all-machines list, owned-machine toggle). Because this returns
 * a promise, callers with extra queries can keep full parallelism by awaiting
 * it inside their own `Promise.all`.
 */
export async function loadIssueListPage(
  filters: IssueFilters,
  options: { isAdmin: boolean }
): Promise<IssueListPageData> {
  const where = buildWhereConditions(filters, db, { isAdmin: options.isAdmin });
  const orderBy = buildOrderBy(filters.sort);
  const pageSize = filters.pageSize ?? 15;
  const page = filters.page ?? 1;

  const [allUsers, issuesListRaw, totalCountResult] = await Promise.all([
    getUnifiedUsers(),
    db.query.issues.findMany({
      where: and(...where),
      orderBy,
      with: {
        machine: { columns: { id: true, name: true } },
        reportedByUser: { columns: { id: true, name: true } },
        invitedReporter: { columns: { id: true, name: true } },
        assignedToUser: { columns: { id: true, name: true } },
      },
      columns: ISSUE_LIST_COLUMNS,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(issues)
      .where(and(...where)),
  ]);

  const filterUsers: IssueFilterUser[] = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    machineCount: u.machineCount,
    status: u.status,
  }));
  const assigneeUsers: IssueAssigneeUser[] = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
  }));

  return {
    issuesList: issuesListRaw,
    totalCount: totalCountResult[0]?.value ?? 0,
    filterUsers,
    assigneeUsers,
    page,
    pageSize,
  };
}
