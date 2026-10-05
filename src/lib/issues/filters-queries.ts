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
import type { AnyPgColumn } from "drizzle-orm/pg-core";
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
import { UNASSIGNED_PERSON_ID } from "~/lib/list-view/url-state";
import { FORMER_USER_NAME } from "~/lib/timeline/resolve-person";
import type { IssueViewSortDirection, IssueViewSortField } from "~/lib/types";
import type { IssueFilters } from "./filters";

// Postgres rejects a malformed uuid literal, so a person filter value that is
// not UUID-shaped can name nobody and never reaches the query.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A person filter's account ids and whether it includes Unassigned. */
function personValues(values: readonly string[]): {
  ids: string[];
  unassigned: boolean;
} {
  return {
    ids: values.filter((value) => UUID_PATTERN.test(value)),
    unassigned: values.includes(UNASSIGNED_PERSON_ID),
  };
}

/** Any of `conditions`, or a condition that matches nothing. */
function anyOf(conditions: (SQL | undefined)[]): SQL {
  const present = conditions.filter(
    (condition): condition is SQL => condition !== undefined
  );
  return or(...present) ?? sql`false`;
}

/**
 * Whether a ProseMirror doc column reads, as displayed, like `search` (an
 * ILIKE pattern). Matches what a reader sees, not the stored JSON:
 *
 * - Text nodes match on their text. Node types, attribute names, and link
 *   targets do not.
 * - A mention matches on the name it displays (`loadMentionNames`): the
 *   mentioned profile's current name, "Former user" when that account was
 *   deleted, or the stored label when the id is not UUID-shaped. The label
 *   frozen into the doc never matches once the person has a different name.
 *
 * Names only, never emails (CORE-SEC-007).
 *
 * The joined profile is referenced by a literal alias, not `${userProfiles.id}`:
 * the relational query API (`db.query.issues.findMany`) rewrites every column
 * in a raw fragment to the root table's alias, which would turn it into
 * `"issues"."id"`.
 */
function proseMatches(doc: AnyPgColumn, search: string): SQL {
  return sql`(
    exists (
      select 1
      from jsonb_path_query(${doc}, 'lax $.** ? (@.type == "text").text') as node(value)
      where node.value #>> '{}' ilike ${search}
    )
    or exists (
      select 1
      from jsonb_path_query(${doc}, 'lax $.** ? (@.type == "mention").attrs') as mention(attrs)
      left join ${userProfiles} as mentioned
        on mentioned.id::text = lower(mention.attrs ->> 'id')
      where coalesce(
        mentioned.name,
        case
          when mention.attrs ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then ${FORMER_USER_NAME}
          else mention.attrs ->> 'label'
        end
      ) ilike ${search}
    )
  )`;
}

/**
 * Builds an array of Drizzle SQL conditions from filters. A `scope` bounds
 * the issues to those machines whatever the filters say (issues-list §2.2);
 * an empty scope matches nothing. This should ONLY be called on the server.
 */
export function buildWhereConditions(
  filters: IssueFilters,
  db: PostgresJsDatabase<Schema>,
  options: { isAdmin?: boolean; scope?: readonly string[] | undefined } = {}
): SQL[] {
  const { isAdmin = false, scope } = options;
  const conditions: SQL[] = [];

  if (scope !== undefined) {
    conditions.push(
      scope.length > 0
        ? inArray(issues.machineInitials, [...scope])
        : sql`false`
    );
  }

  // Comprehensive search across all relevant text fields
  if (filters.q) {
    const search = `%${filters.q}%`;
    const searchConditions = [
      // Issue fields
      ilike(issues.title, search),
      proseMatches(issues.description, search),
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
              proseMatches(issueComments.content, search)
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
    const { ids, unassigned } = personValues(filters.assignee);
    conditions.push(
      anyOf([
        unassigned ? isNull(issues.assignedTo) : undefined,
        ids.length > 0 ? inArray(issues.assignedTo, ids) : undefined,
      ])
    );
  }

  // A reporter is an account or an invited person.
  if (filters.reporter && filters.reporter.length > 0) {
    const { ids } = personValues(filters.reporter);
    conditions.push(
      anyOf([
        ids.length > 0 ? inArray(issues.reportedBy, ids) : undefined,
        ids.length > 0 ? inArray(issues.invitedReportedBy, ids) : undefined,
      ])
    );
  }

  // A machine owner is an account or an invited person; Unassigned is a
  // machine with neither.
  if (filters.owner && filters.owner.length > 0) {
    const { ids, unassigned } = personValues(filters.owner);
    const owned = anyOf([
      unassigned
        ? and(isNull(machines.ownerId), isNull(machines.invitedOwnerId))
        : undefined,
      ids.length > 0 ? inArray(machines.ownerId, ids) : undefined,
      ids.length > 0 ? inArray(machines.invitedOwnerId, ids) : undefined,
    ]);
    conditions.push(
      exists(
        db
          .select()
          .from(machines)
          .where(and(eq(machines.initials, issues.machineInitials), owned))
      )
    );
  }

  if (filters.frequency && filters.frequency.length > 0) {
    conditions.push(inArray(issues.frequency, filters.frequency));
  }

  if (filters.watcherId) {
    conditions.push(
      exists(
        db
          .select()
          .from(issueWatchers)
          .where(
            and(
              eq(issueWatchers.issueId, issues.id),
              eq(issueWatchers.userId, filters.watcherId)
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

  // Machine Presence (issues-list §4.7): absent is the Page Preset's On the
  // Floor; empty is every presence state.
  const presence = filters.presence ?? ["on_the_floor"];
  if (presence.length > 0) {
    conditions.push(
      exists(
        db
          .select()
          .from(machines)
          .where(
            and(
              eq(machines.initials, issues.machineInitials),
              inArray(machines.presenceStatus, presence)
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
export function buildOrderBy(
  sort: IssueViewSortField = "updated",
  dir: IssueViewSortDirection = "desc"
): SQL[] {
  const order = dir === "asc" ? asc : desc;
  switch (sort) {
    case "created":
      return [order(issues.createdAt), ...ISSUE_ID_ORDER];
    case "updated":
      return [order(issues.updatedAt), ...ISSUE_ID_ORDER];
    case "id":
      return dir === "asc"
        ? ISSUE_ID_ORDER
        : [desc(issues.machineInitials), desc(issues.issueNumber)];
    case "severity":
      return [order(SEVERITY_RANK), ...ISSUE_ID_ORDER];
    case "priority":
      return [order(PRIORITY_RANK), ...ISSUE_ID_ORDER];
    case "assignee":
      return [
        dir === "asc"
          ? sql`${ASSIGNEE_NAME} asc nulls last`
          : sql`${ASSIGNEE_NAME} desc nulls last`,
        desc(issues.updatedAt),
        ...ISSUE_ID_ORDER,
      ];
  }
}
