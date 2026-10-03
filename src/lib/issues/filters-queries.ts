import {
  type SQL,
  inArray,
  desc,
  asc,
  gte,
  lte,
  or,
  ilike,
  eq,
  and,
  exists,
  isNull,
  sql,
} from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Schema } from "~/server/db";

import {
  issues,
  machines,
  issueWatchers,
  userProfiles,
  invitedUsers,
  issueComments,
} from "~/server/db/schema";
import { OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueFilters, IssueSort } from "./filters";

/**
 * Builds an array of Drizzle SQL conditions from filters
 * This should ONLY be called on the server.
 */
export function buildWhereConditions(
  filters: IssueFilters,
  db: PostgresJsDatabase<Schema>,
  options: { isAdmin?: boolean } = {}
): SQL[] {
  const { isAdmin = false } = options;
  const conditions: SQL[] = [];

  // Comprehensive search across all relevant text fields
  if (filters.q) {
    const search = `%${filters.q}%`;
    const searchConditions = [
      // Issue fields
      ilike(issues.title, search),
      sql`${issues.description}::text ilike ${search}`,
      ilike(issues.machineInitials, search),
      ilike(issues.reporterName, search),
    ];

    if (isAdmin) {
      searchConditions.push(ilike(issues.reporterEmail, search));
    }

    // Check if the query matches a pattern like "AFM-101" or "AFM 101"
    const issuePatternMatch = /^([a-zA-Z]{1,4})[- ](\d+)$/.exec(
      filters.q.trim()
    );
    if (issuePatternMatch) {
      const initials = issuePatternMatch[1];
      const num = issuePatternMatch[2];
      if (initials && num) {
        const issueNum = parseInt(num, 10);
        if (!isNaN(issueNum)) {
          const cond = and(
            ilike(issues.machineInitials, initials),
            eq(issues.issueNumber, issueNum)
          );
          if (cond) {
            searchConditions.push(cond);
          }
        }
      }
    } else {
      // Fallback: check if the query is just a number
      const numericMatch = /^\d+$/.exec(filters.q.trim());
      if (numericMatch) {
        const issueNum = parseInt(numericMatch[0], 10);
        if (!isNaN(issueNum)) {
          searchConditions.push(eq(issues.issueNumber, issueNum));
        }
      }
    }

    // Search in reporter's user profile name/email
    searchConditions.push(
      exists(
        db
          .select()
          .from(userProfiles)
          .where(
            and(
              eq(userProfiles.id, issues.reportedBy),
              or(
                ilike(userProfiles.name, search),
                isAdmin ? ilike(userProfiles.email, search) : sql`false`
              )
            )
          )
      )
    );

    // Search in invited reporter's name/email
    searchConditions.push(
      exists(
        db
          .select()
          .from(invitedUsers)
          .where(
            and(
              eq(invitedUsers.id, issues.invitedReportedBy),
              or(
                ilike(invitedUsers.name, search),
                isAdmin ? ilike(invitedUsers.email, search) : sql`false`
              )
            )
          )
      )
    );

    // Search in assignee's user profile name/email
    searchConditions.push(
      exists(
        db
          .select()
          .from(userProfiles)
          .where(
            and(
              eq(userProfiles.id, issues.assignedTo),
              or(
                ilike(userProfiles.name, search),
                isAdmin ? ilike(userProfiles.email, search) : sql`false`
              )
            )
          )
      )
    );

    // Search in machine names
    searchConditions.push(
      exists(
        db
          .select()
          .from(machines)
          .where(
            and(
              eq(machines.initials, issues.machineInitials),
              ilike(machines.name, search)
            )
          )
      )
    );

    // Search in issue comments
    searchConditions.push(
      exists(
        db
          .select()
          .from(issueComments)
          .where(
            and(
              eq(issueComments.issueId, issues.id),
              sql`${issueComments.content}::text ilike ${search}`
            )
          )
      )
    );

    if (searchConditions.length > 0) {
      const cond = or(...searchConditions);
      if (cond) {
        conditions.push(cond);
      }
    }
  }

  // Status
  if (filters.status === undefined) {
    // Default to open statuses if no status filter is provided in URL
    conditions.push(inArray(issues.status, [...OPEN_STATUSES]));
  } else if (filters.status.length > 0) {
    // Specific statuses selected
    conditions.push(inArray(issues.status, filters.status));
  }
  // If filters.status is [], it means "All" - no condition added

  if (filters.machine && filters.machine.length > 0) {
    conditions.push(inArray(issues.machineInitials, filters.machine));
  }

  if (filters.severity && filters.severity.length > 0) {
    conditions.push(inArray(issues.severity, filters.severity));
  }

  if (filters.priority && filters.priority.length > 0) {
    conditions.push(inArray(issues.priority, filters.priority));
  }

  if (filters.assignee && filters.assignee.length > 0) {
    // Check if "UNASSIGNED" special value is included
    const hasUnassigned = filters.assignee.includes("UNASSIGNED");
    const actualAssignees = filters.assignee.filter((a) => a !== "UNASSIGNED");

    if (hasUnassigned && actualAssignees.length > 0) {
      // Both unassigned and specific users
      const cond = or(
        isNull(issues.assignedTo),
        inArray(issues.assignedTo, actualAssignees)
      );
      if (cond) {
        conditions.push(cond);
      }
    } else if (hasUnassigned) {
      // Only unassigned
      conditions.push(isNull(issues.assignedTo));
    } else {
      // Only specific assignees
      conditions.push(inArray(issues.assignedTo, actualAssignees));
    }
  }

  if (filters.reporter && filters.reporter.length > 0) {
    conditions.push(inArray(issues.reportedBy, filters.reporter));
  }

  if (filters.owner && filters.owner.length > 0) {
    conditions.push(
      exists(
        db
          .select()
          .from(machines)
          .where(
            and(
              eq(machines.initials, issues.machineInitials),
              inArray(machines.ownerId, filters.owner)
            )
          )
      )
    );
  }

  if (filters.frequency && filters.frequency.length > 0) {
    conditions.push(inArray(issues.frequency, filters.frequency));
  }

  // Watching filter requires current user ID to be passed in
  if (filters.watching && filters.currentUserId) {
    conditions.push(
      exists(
        db
          .select()
          .from(issueWatchers)
          .where(
            and(
              eq(issueWatchers.issueId, issues.id),
              eq(issueWatchers.userId, filters.currentUserId)
            )
          )
      )
    );
  }

  if (filters.createdFrom) {
    conditions.push(gte(issues.createdAt, filters.createdFrom));
  }

  if (filters.createdTo) {
    const endOfDay = new Date(filters.createdTo);
    endOfDay.setUTCHours(23, 59, 59, 999);
    conditions.push(lte(issues.createdAt, endOfDay));
  }

  if (filters.updatedFrom) {
    conditions.push(gte(issues.updatedAt, filters.updatedFrom));
  }

  if (filters.updatedTo) {
    const endOfDay = new Date(filters.updatedTo);
    endOfDay.setUTCHours(23, 59, 59, 999);
    conditions.push(lte(issues.updatedAt, endOfDay));
  }

  // Default: exclude issues from machines not currently "on the floor"
  if (!filters.includeInactiveMachines) {
    conditions.push(
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
      )
    );
  }

  return conditions;
}

/** Severity rank, least to most severe (issues-list §5.1: rank, not alphabet). */
const SEVERITY_RANK = sql<number>`case ${issues.severity}
  when 'cosmetic' then 1 when 'minor' then 2 when 'major' then 3
  when 'unplayable' then 4 end`;

/** Priority rank, least to most urgent. */
const PRIORITY_RANK = sql<number>`case ${issues.priority}
  when 'low' then 1 when 'medium' then 2 when 'high' then 3 end`;

/**
 * The assignee's display name; null when unassigned. The relational query
 * builder qualifies every column in an ORDER BY with the root table's alias,
 * so the subquery names its own alias in plain SQL.
 */
const ASSIGNEE_NAME = sql<string | null>`(select "assignee"."name"
  from "user_profiles" "assignee"
  where "assignee"."id" = ${issues.assignedTo})`;

/** Issue ID order: machine initials, then number (issues-list §5.3). */
const ISSUE_ID_ORDER: SQL[] = [
  asc(issues.machineInitials),
  asc(issues.issueNumber),
];

/**
 * Builds the ORDER BY for an issue sort (issues-list §5.1–§5.3). Every sort
 * ends in issue ID order, so ties, and therefore pages, are deterministic.
 * Assignee sorts by display name with unassigned last in both directions,
 * then by Updated, newest first. An absent sort is the default, Updated
 * newest first. This should ONLY be called on the server.
 */
export function buildOrderBy(sort: IssueSort | undefined): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(issues.createdAt), ...ISSUE_ID_ORDER];
    case "created_desc":
      return [desc(issues.createdAt), ...ISSUE_ID_ORDER];
    case "updated_asc":
      return [asc(issues.updatedAt), ...ISSUE_ID_ORDER];
    case "issue_asc":
      return ISSUE_ID_ORDER;
    case "issue_desc":
      return [desc(issues.machineInitials), desc(issues.issueNumber)];
    case "severity_asc":
      return [asc(SEVERITY_RANK), ...ISSUE_ID_ORDER];
    case "severity_desc":
      return [desc(SEVERITY_RANK), ...ISSUE_ID_ORDER];
    case "priority_asc":
      return [asc(PRIORITY_RANK), ...ISSUE_ID_ORDER];
    case "priority_desc":
      return [desc(PRIORITY_RANK), ...ISSUE_ID_ORDER];
    case "assignee_asc":
      return [
        sql`${ASSIGNEE_NAME} asc nulls last`,
        desc(issues.updatedAt),
        ...ISSUE_ID_ORDER,
      ];
    case "assignee_desc":
      return [
        sql`${ASSIGNEE_NAME} desc nulls last`,
        desc(issues.updatedAt),
        ...ISSUE_ID_ORDER,
      ];
    case "updated_desc":
    case undefined:
      return [desc(issues.updatedAt), ...ISSUE_ID_ORDER];
  }
}
