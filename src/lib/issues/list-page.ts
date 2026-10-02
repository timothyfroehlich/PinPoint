import {
  and,
  count,
  countDistinct,
  eq,
  exists,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "~/server/db";
import { issues, machines } from "~/server/db/schema";
import { getUnifiedUsers } from "~/lib/users/queries";
import {
  buildOrderBy,
  buildWhereConditions,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import { OPEN_STATUSES } from "~/lib/issues/status";
import type {
  IssueListRow,
  IssueListSummary,
  IssueWidgetCounts,
  UnifiedUser,
  WidgetPopulation,
} from "~/lib/types";

/** Minimal user shapes sent to the client filter/assignee controls (CORE-SEC-006). */
export type IssueFilterUser = Pick<
  UnifiedUser,
  "id" | "name" | "machineCount" | "status"
>;
export type IssueAssigneeUser = Pick<UnifiedUser, "id" | "name">;

export interface IssueListPageData {
  issuesList: IssueListRow[];
  totalCount: number;
  filterUsers: IssueFilterUser[];
  assigneeUsers: IssueAssigneeUser[];
  page: number;
  pageSize: number;
  summary: IssueListSummary;
}

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

const OPEN_STATUS_SET: ReadonlySet<string> = new Set(OPEN_STATUSES);

/**
 * Counts one Summary Widget population (issue-widgets §3–§5) in two grouped
 * queries, so no issue rows leave the database (widgets §4.2).
 */
async function countIssuePopulation(where: SQL[]): Promise<IssueWidgetCounts> {
  const [groups, machineRows] = await Promise.all([
    db
      .select({
        status: issues.status,
        severity: issues.severity,
        priority: issues.priority,
        value: count(),
      })
      .from(issues)
      .where(and(...where))
      .groupBy(issues.status, issues.severity, issues.priority),
    db
      .select({ value: countDistinct(issues.machineInitials) })
      .from(issues)
      .where(and(...where, inArray(issues.status, [...OPEN_STATUSES]))),
  ]);

  const counts: IssueWidgetCounts = {
    total: 0,
    open: 0,
    machinesWithOpenIssues: machineRows[0]?.value ?? 0,
    byStatus: {
      new: 0,
      confirmed: 0,
      in_progress: 0,
      need_parts: 0,
      need_help: 0,
      wait_owner: 0,
      fixed: 0,
      wont_fix: 0,
      wai: 0,
      no_repro: 0,
      duplicate: 0,
    },
    bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 0 },
    byPriority: { low: 0, medium: 0, high: 0 },
  };
  for (const group of groups) {
    counts.total += group.value;
    counts.byStatus[group.status] += group.value;
    if (!OPEN_STATUS_SET.has(group.status)) continue;
    counts.open += group.value;
    counts.bySeverity[group.severity] += group.value;
    counts.byPriority[group.priority] += group.value;
  }
  return counts;
}

/**
 * Summary Widget counts for an issue list. All is every issue, open or
 * closed, on the host's On the Floor machines (issue-widgets §2.2), matching
 * the list's default view; Filtered is every issue matching the list's
 * filters across all pages. Only populations a widget uses load.
 */
async function loadIssueListSummary(
  filters: IssueFilters,
  filteredWhere: SQL[],
  scopeMachineInitials: string[] | undefined
): Promise<IssueListSummary> {
  const populations: Record<keyof IssueListSummary, WidgetPopulation> = {
    status: filters.statusWidget ?? "all",
    severity: filters.severityWidget ?? "all",
    priority: filters.priorityWidget ?? "all",
  };
  const used = new Set(Object.values(populations));
  const allWhere: SQL[] = [
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
  if (scopeMachineInitials !== undefined) {
    allWhere.push(inArray(issues.machineInitials, scopeMachineInitials));
  }
  const [all, filtered] = await Promise.all([
    used.has("all") ? countIssuePopulation(allWhere) : undefined,
    used.has("filtered") ? countIssuePopulation(filteredWhere) : undefined,
  ]);
  const pick = (population: WidgetPopulation): IssueWidgetCounts => {
    const counts = population === "all" ? all : filtered;
    if (counts === undefined) {
      throw new Error(`Issue widget population ${population} was not loaded`);
    }
    return counts;
  };
  return {
    status: pick(populations.status),
    severity: pick(populations.severity),
    priority: pick(populations.priority),
  };
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
  options: {
    isAdmin: boolean;
    /** The machines a group Issues tab is scoped to; absent on `/issues`. */
    scopeMachineInitials?: string[] | undefined;
  }
): Promise<IssueListPageData> {
  const where = buildWhereConditions(filters, db, { isAdmin: options.isAdmin });
  const orderBy = buildOrderBy(filters.sort);
  const pageSize = filters.pageSize ?? 15;
  const page = filters.page ?? 1;

  const [allUsers, issuesListRaw, totalCountResult, summary] =
    await Promise.all([
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
        // Comments people wrote (issues-list §3.4); system rows are timeline
        // events. The relational builder qualifies every column inside
        // `extras` with the root table's alias, so the subquery names its
        // own alias in plain SQL rather than through the schema objects.
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
      }),
      db
        .select({ value: count() })
        .from(issues)
        .where(and(...where)),
      loadIssueListSummary(filters, where, options.scopeMachineInitials),
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
    summary,
  };
}
