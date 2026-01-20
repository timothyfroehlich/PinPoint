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
} from "drizzle-orm";
import { db } from "~/server/db";
import {
  issues,
  machines,
  issueWatchers,
  userProfiles,
  invitedUsers,
  issueComments,
} from "~/server/db/schema";
import { OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueFilters } from "./filters";

/**
 * Builds an array of Drizzle SQL conditions from filters
 * This should ONLY be called on the server.
 */
export function buildWhereConditions(filters: IssueFilters): SQL[] {
  const conditions: SQL[] = [];

  // Comprehensive search across all relevant text fields
  if (filters.q) {
    const search = `%${filters.q}%`;
    const searchConditions = [
      // Issue fields
      ilike(issues.title, search),
      ilike(issues.description, search),
      ilike(issues.machineInitials, search),
      ilike(issues.reporterName, search),
      ilike(issues.reporterEmail, search),
    ];

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
                ilike(userProfiles.email, search)
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
                ilike(invitedUsers.email, search)
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
                ilike(userProfiles.email, search)
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
              ilike(issueComments.content, search)
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

  // Status (Default to OPEN_STATUSES if none specified)
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(issues.status, filters.status));
  } else {
    // Correctly cast OPEN_STATUSES to IssueStatus[] to avoid readonly mismatch
    conditions.push(inArray(issues.status, [...OPEN_STATUSES]));
  }

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

  if (filters.consistency && filters.consistency.length > 0) {
    conditions.push(inArray(issues.consistency, filters.consistency));
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

  return conditions;
}

/**
 * Builds Drizzle SortOrder from sort string
 * This should ONLY be called on the server.
 */
export function buildOrderBy(sort: string | undefined): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(issues.createdAt)];
    case "created_desc":
      return [desc(issues.createdAt)];
    case "updated_asc":
      return [asc(issues.updatedAt)];
    case "updated_desc":
      return [desc(issues.updatedAt)];
    case "issue_asc":
      return [asc(issues.machineInitials), asc(issues.issueNumber)];
    case "issue_desc":
      return [desc(issues.machineInitials), desc(issues.issueNumber)];
    case "assignee_asc":
      return [asc(issues.assignedTo), desc(issues.updatedAt)];
    case "assignee_desc":
      return [desc(issues.assignedTo), desc(issues.updatedAt)];
    default:
      return [desc(issues.updatedAt)];
  }
}
