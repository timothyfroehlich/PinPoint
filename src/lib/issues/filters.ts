import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
} from "~/lib/types";
import { ALL_ISSUE_STATUSES } from "~/lib/issues/status";

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
  reporter?: string[] | undefined;
  frequency?: IssueFrequency[] | undefined;
  watching?: boolean | undefined;
  includeInactiveMachines?: boolean | undefined;
  createdFrom?: Date | undefined;
  createdTo?: Date | undefined;
  updatedFrom?: Date | undefined;
  updatedTo?: Date | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  currentUserId?: string | undefined; // Server-side only, for watching filter
}

const VALID_SEVERITIES: IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];
const VALID_PRIORITIES: IssuePriority[] = ["low", "medium", "high"];
const VALID_FREQUENCIES: IssueFrequency[] = [
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
    if (val === null) return undefined;
    if (val === "all") return [];

    const items = val
      .split(",")
      .filter((v): v is T => validValues.includes(v as T));
    return items.length > 0 ? items : undefined;
  };

  const filters: IssueFilters = {};

  const q = params.get("q");
  if (q) filters.q = q;

  const status = parseCommaList(params.get("status"), ALL_ISSUE_STATUSES);
  if (status !== undefined) {
    filters.status = status;
  }

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

  const reporter = params.get("reporter")?.split(",");
  if (reporter) filters.reporter = reporter;

  const frequency = parseCommaList(params.get("frequency"), VALID_FREQUENCIES);
  if (frequency) filters.frequency = frequency;

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

  // Watching is a simple boolean flag
  const watching = params.get("watching");
  if (watching === "true") filters.watching = true;

  const includeInactive = params.get("include_inactive_machines");
  if (includeInactive === "true") {
    filters.includeInactiveMachines = true;
  }

  return filters;
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
    "frequency",
    "watching",
    "include_inactive_machines",
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
