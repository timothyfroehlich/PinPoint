import {
  type SQL,
  inArray,
  desc,
  asc,
  gte,
  lte,
  or,
  like,
  eq,
  and,
  exists,
} from "drizzle-orm";
import { db } from "~/server/db";
import { issues, machines } from "~/server/db/schema";
import { OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueFilters } from "./filters";

/**
 * Builds an array of Drizzle SQL conditions from filters
 * This should ONLY be called on the server.
 */
export function buildWhereConditions(filters: IssueFilters): SQL[] {
  const conditions: SQL[] = [];

  // Search query (Title, ID, Machine)
  if (filters.q) {
    const search = `%${filters.q}%`;
    const searchConditions = [
      like(issues.title, search),
      like(issues.machineInitials, search),
    ];

    // Check if the query is a number or contains a number (e.g. AFM-101 or 101)
    const numericMatch = /\d+/.exec(filters.q);
    if (numericMatch) {
      const issueNum = parseInt(numericMatch[0], 10);
      if (!isNaN(issueNum)) {
        searchConditions.push(eq(issues.issueNumber, issueNum));
      }
    }

    conditions.push(or(...searchConditions)!);
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
    conditions.push(inArray(issues.assignedTo, filters.assignee));
  }

  if (filters.reporter) {
    conditions.push(eq(issues.reportedBy, filters.reporter));
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
