import { and, count, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "~/server/db";
import { issues, machines } from "~/server/db/schema";
import { getUnifiedUsers } from "~/lib/users/queries";
import {
  buildOrderBy,
  buildWhereConditions,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import {
  OPEN_STATUS_GROUPS,
  STATUS_GROUPS,
  type IssueStatus,
  type OpenStatusGroup,
} from "~/lib/issues/status";
import type {
  IssueListRow,
  IssueListSummary,
  IssueViewPersonOption,
} from "~/lib/types";

export interface IssueListPageData {
  issuesList: IssueListRow[];
  totalCount: number;
  /** People the filters and row assignee menus offer (CORE-SEC-006). */
  people: IssueViewPersonOption[];
  /** The page shown: the one asked for, or the last page (list-views §6.3). */
  page: number;
  pageSize: number;
  summary: IssueListSummary;
}

/** The page size when a caller sets none (list-views §5.7). */
const DEFAULT_PAGE_SIZE = 25;

/**
 * Issue columns a list row loads. `reporterEmail` is deliberately absent:
 * reporter emails never leave admin views (CORE-SEC-007).
 */
const ISSUE_LIST_COLUMNS = {
  id: true,
  issueNumber: true,
  title: true,
  status: true,
  severity: true,
  priority: true,
  frequency: true,
  createdAt: true,
  updatedAt: true,
  machineInitials: true,
  reporterName: true,
  assignedTo: true,
} as const;

/** The open status group each open status belongs to; closed ones are absent. */
const OPEN_STATUS_GROUP: ReadonlyMap<IssueStatus, OpenStatusGroup> = new Map(
  OPEN_STATUS_GROUPS.flatMap((group) =>
    STATUS_GROUPS[group].map((status) => [status, group] as const)
  )
);

/**
 * Summary Widget counts for an issue list (issue-widgets §2–§5): every issue,
 * open or closed, on the host's On the Floor machines (§2.2), whatever search
 * and filters the list carries (widgets §3.1). On a group Issues tab those are
 * the group's On the Floor machines. One grouped query, so no issue rows
 * leave the database (widgets §4.2).
 */
async function loadIssueListSummary(
  scopeMachineInitials: readonly string[] | undefined
): Promise<IssueListSummary> {
  const where: SQL[] = [
    exists(
      db
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.initials, issues.machineInitials),
            eq(machines.presenceStatus, "on_the_floor")
          )
        )
    ),
  ];
  // An empty scope, a group with no machines, counts nothing (widgets §4.5).
  if (scopeMachineInitials !== undefined) {
    where.push(
      scopeMachineInitials.length > 0
        ? inArray(issues.machineInitials, [...scopeMachineInitials])
        : sql`false`
    );
  }
  const groups = await db
    .select({
      status: issues.status,
      severity: issues.severity,
      priority: issues.priority,
      value: count(),
    })
    .from(issues)
    .where(and(...where))
    .groupBy(issues.status, issues.severity, issues.priority);

  const counts: IssueListSummary = {
    open: 0,
    byStatusGroup: { new: 0, in_progress: 0 },
    bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
    byPriority: { low: 0, medium: 0, high: 0 },
  };
  for (const group of groups) {
    const statusGroup = OPEN_STATUS_GROUP.get(group.status);
    if (statusGroup === undefined) continue;
    counts.open += group.value;
    counts.byStatusGroup[statusGroup] += group.value;
    counts.bySeverity[group.severity] += group.value;
    counts.byPriority[group.priority] += group.value;
  }
  return counts;
}

/** One page of issue rows for `where`, in `orderBy` order. */
function loadIssueRows(
  where: SQL[],
  orderBy: SQL[],
  page: number,
  pageSize: number
): Promise<IssueListRow[]> {
  return db.query.issues.findMany({
    where: and(...where),
    orderBy,
    with: {
      machine: { columns: { id: true, name: true, ownerId: true } },
      reportedByUser: { columns: { id: true, name: true } },
      invitedReporter: { columns: { id: true, name: true } },
      assignedToUser: { columns: { id: true, name: true } },
    },
    columns: ISSUE_LIST_COLUMNS,
    // Comments people wrote (issues-list §3.4); system rows are timeline
    // events. The relational builder qualifies every column inside `extras`
    // with the root table's alias, so the subquery names its own alias in
    // plain SQL rather than through the schema objects.
    extras: (table) => ({
      commentCount: sql<number>`(
        select count(*)::int from "issue_comments" "comment"
        where "comment"."issue_id" = ${table.id}
          and not "comment"."is_system"
      )`
        .mapWith(Number)
        .as("comment_count"),
    }),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
}

/**
 * Loads one page of an issue list (`/issues` and every Collection and Tag
 * Issues tab): filtering, sorting, pagination, and counts all run in SQL
 * (list-views §2.3). Runs the rows, the total, the Summary Widget counts,
 * and the people lookup in parallel; a page past the end shows the last page
 * (list-views §6.3). `scopeMachineInitials` bounds a tab to its machines,
 * whatever the filters (issues-list §2.2); an empty scope matches nothing.
 */
export async function loadIssueListPage(
  filters: IssueFilters,
  options: {
    isAdmin: boolean;
    /** The machines a group Issues tab is scoped to; absent on `/issues`. */
    scopeMachineInitials?: readonly string[] | undefined;
  }
): Promise<IssueListPageData> {
  const where = buildWhereConditions(filters, db, {
    isAdmin: options.isAdmin,
    scope: options.scopeMachineInitials,
  });
  const orderBy = buildOrderBy(filters.sort, filters.dir);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const requestedPage = filters.page ?? 1;

  const [allUsers, requestedRows, totalCountResult, summary] =
    await Promise.all([
      getUnifiedUsers(),
      loadIssueRows(where, orderBy, requestedPage, pageSize),
      db
        .select({ value: count() })
        .from(issues)
        .where(and(...where)),
      loadIssueListSummary(options.scopeMachineInitials),
    ]);

  const totalCount = totalCountResult[0]?.value ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, lastPage);
  const issuesList =
    page === requestedPage
      ? requestedRows
      : await loadIssueRows(where, orderBy, page, pageSize);

  return {
    issuesList,
    totalCount,
    people: allUsers.map((user) => ({ id: user.id, name: user.name })),
    page,
    pageSize,
    summary,
  };
}
