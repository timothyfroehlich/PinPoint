import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
} from "~/lib/types";
import { ISSUE_FREQUENCY_VALUES } from "~/lib/types";
import { ALL_ISSUE_STATUSES } from "~/lib/issues/status";

export const ISSUE_PAGE_SIZES = [15, 25, 50] as const;
export type IssuePageSize = (typeof ISSUE_PAGE_SIZES)[number];

/**
 * Every issue sort (issues-list §5.1), each field in both directions, as the
 * composite `field_dir` value the URL carries today. Severity and Priority
 * "highest" mean the most severe / most urgent first.
 */
export const ISSUE_SORT_OPTIONS = [
  { value: "updated_desc", label: "Updated, newest" },
  { value: "updated_asc", label: "Updated, oldest" },
  { value: "created_desc", label: "Created, newest" },
  { value: "created_asc", label: "Created, oldest" },
  { value: "issue_asc", label: "Issue ID, A–Z" },
  { value: "issue_desc", label: "Issue ID, Z–A" },
  { value: "severity_desc", label: "Severity, highest" },
  { value: "severity_asc", label: "Severity, lowest" },
  { value: "priority_desc", label: "Priority, highest" },
  { value: "priority_asc", label: "Priority, lowest" },
  { value: "assignee_asc", label: "Assignee, A–Z" },
  { value: "assignee_desc", label: "Assignee, Z–A" },
] as const;
export type IssueSort = (typeof ISSUE_SORT_OPTIONS)[number]["value"];
export const DEFAULT_ISSUE_SORT: IssueSort = "updated_desc";

export function isIssueSort(value: string): value is IssueSort {
  return ISSUE_SORT_OPTIONS.some((option) => option.value === value);
}

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
  sort?: IssueSort | undefined;
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
const VALID_FREQUENCIES: readonly IssueFrequency[] = ISSUE_FREQUENCY_VALUES;

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

  // Unknown sort values (stale links, old column-header values) fall back to
  // the default rather than reaching the query unvalidated.
  const sort = params.get("sort");
  filters.sort = sort !== null && isIssueSort(sort) ? sort : DEFAULT_ISSUE_SORT;
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

  // The retired Widget Population parameters (`status_widget`,
  // `severity_widget`, `priority_widget`; issue-widgets §2.3) are ignored, so
  // the next URL the list writes drops them.
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
