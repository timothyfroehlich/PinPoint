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
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueConsistency,
} from "~/lib/types";
import { ALL_ISSUE_STATUSES, OPEN_STATUSES } from "~/lib/issues/status";

export const ISSUE_PAGE_SIZES = [15, 25, 50] as const;
export type IssuePageSize = (typeof ISSUE_PAGE_SIZES)[number];

export interface IssueFilters {
  q?: string | undefined;
  status?: IssueStatus[] | undefined;
  machine?: string[] | undefined;
  severity?: IssueSeverity[] | undefined;
  priority?: IssuePriority[] | undefined;
  assignee?: string[] | undefined;
  owner?: string[] | undefined;
  reporter?: string | undefined;
  consistency?: IssueConsistency[] | undefined;
  createdFrom?: Date | undefined;
  createdTo?: Date | undefined;
  updatedFrom?: Date | undefined;
  updatedTo?: Date | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

const VALID_SEVERITIES: IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];
const VALID_PRIORITIES: IssuePriority[] = ["low", "medium", "high"];
const VALID_CONSISTENCIES: IssueConsistency[] = [
  "intermittent",
  "frequent",
  "constant",
];

/**
 * Parses URLSearchParams into a type-safe IssueFilters object
 */
export function parseIssueFilters(params: URLSearchParams): IssueFilters {
  const parseCommaList = <T extends string>(
    val: string | null,
    validValues: readonly T[]
  ): T[] | undefined => {
    if (!val) return undefined;
    const items = val
      .split(",")
      .filter((v): v is T => validValues.includes(v as T));
    return items.length > 0 ? items : undefined;
  };

  const filters: IssueFilters = {};

  const q = params.get("q");
  if (q) filters.q = q;

  const status = parseCommaList(params.get("status"), ALL_ISSUE_STATUSES);
  if (status) filters.status = status;

  const machine = params.get("machine")?.split(",");
  if (machine) filters.machine = machine;

  const severity = parseCommaList(params.get("severity"), VALID_SEVERITIES);
  if (severity) filters.severity = severity;

  const priority = parseCommaList(params.get("priority"), VALID_PRIORITIES);
  if (priority) filters.priority = priority;

  const assignee = params.get("assignee")?.split(",");
  if (assignee) filters.assignee = assignee;

  const owner = params.get("owner")?.split(",");
  if (owner) filters.owner = owner;

  const reporter = params.get("reporter");
  if (reporter) filters.reporter = reporter;

  const consistency = parseCommaList(
    params.get("consistency"),
    VALID_CONSISTENCIES
  );
  if (consistency) filters.consistency = consistency;

  filters.sort = params.get("sort") ?? "updated_desc";
  const p = parseInt(params.get("page") ?? "1", 10);
  filters.page = !isNaN(p) && p > 0 ? p : 1;
  const ps = parseInt(params.get("page_size") ?? "15", 10);
  filters.pageSize = !isNaN(ps) && ps > 0 ? ps : 15;

  const createdFrom = params.get("created_from");
  if (createdFrom) {
    const d = new Date(createdFrom);
    if (!isNaN(d.getTime())) filters.createdFrom = d;
  }

  const createdTo = params.get("created_to");
  if (createdTo) {
    const d = new Date(createdTo);
    if (!isNaN(d.getTime())) filters.createdTo = d;
  }

  const updatedFrom = params.get("updated_from");
  if (updatedFrom) {
    const d = new Date(updatedFrom);
    if (!isNaN(d.getTime())) filters.updatedFrom = d;
  }

  const updatedTo = params.get("updated_to");
  if (updatedTo) {
    const d = new Date(updatedTo);
    if (!isNaN(d.getTime())) filters.updatedTo = d;
  }

  return filters;
}

/**
 * Builds an array of Drizzle SQL conditions from filters
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
    conditions.push(
      inArray(issues.status, [...OPEN_STATUSES] as IssueStatus[])
    );
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

/**
 * Checks if any issue filters are active in the search params
 */
export function hasActiveIssueFilters(params: URLSearchParams): boolean {
  const filterKeys = [
    "q",
    "status",
    "machine",
    "severity",
    "priority",
    "assignee",
    "owner",
    "reporter",
    "consistency",
    "created_from",
    "created_to",
    "updated_from",
    "updated_to",
  ];
  return filterKeys.some((key) => {
    const val = params.get(key);
    return val !== null && val.length > 0;
  });
}
