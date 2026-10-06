/**
 * Issue View URL state (spec issues-list.md §7, list-views §9): parsing with
 * the older parameters as aliases, validation, and the canonical form
 * relative to the Page Preset.
 */

import { ALL_STATUS_OPTIONS } from "~/lib/issues/status";
import {
  arraysEqual,
  canonicalFilterValues,
  canonicalPeopleValues,
  parsePageSize,
  positiveInteger,
  storedStateParams,
  UNASSIGNED_PERSON_ID,
  type ListSearchParams,
} from "~/lib/list-view/url-state";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import {
  ISSUE_FREQUENCY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  ISSUE_VIEW_SORT_FIELDS,
  type IssueStatus,
  type IssueViewDateRange,
  type IssueViewSavedState,
  type IssueViewSortDirection,
  type IssueViewSortField,
  type IssueViewState,
} from "~/lib/types";
import { ISSUE_VIEW_PRESET, ISSUE_VIEW_SORTS } from "./config";

/**
 * Every status in its canonical order: the status groups' order, so the
 * Open statuses read the same as the Page Preset's.
 */
export const ISSUE_STATUS_ORDER: readonly IssueStatus[] = ALL_STATUS_OPTIONS;

/** The value of `status` or `presence` that means every value (§7.1). */
export const ALL_VALUES = "all";

const NO_RANGE: IssueViewDateRange = { from: null, to: null };

export function isIssueViewSortField(
  value: string | null
): value is IssueViewSortField {
  return (
    value !== null && ISSUE_VIEW_SORT_FIELDS.some((field) => field === value)
  );
}

/** The composite sort older URLs carry, such as `updated_desc` (§7.2). */
const LEGACY_SORT_FIELDS: Record<string, IssueViewSortField> = {
  updated: "updated",
  created: "created",
  issue: "id",
  severity: "severity",
  priority: "priority",
  assignee: "assignee",
};

function parseSort(searchParams: ListSearchParams): {
  sort: IssueViewSortField;
  dir: IssueViewSortDirection;
} {
  const defaults = ISSUE_VIEW_PRESET;
  const requested = searchParams.get("sort");
  const legacy = /^([a-z]+)_(asc|desc)$/.exec(requested ?? "");
  const legacyField = legacy ? LEGACY_SORT_FIELDS[legacy[1] ?? ""] : undefined;
  if (legacy && legacyField) {
    return { sort: legacyField, dir: legacy[2] === "asc" ? "asc" : "desc" };
  }
  const sort = isIssueViewSortField(requested) ? requested : defaults.sort;
  const requestedDirection = searchParams.get("dir");
  const dir: IssueViewSortDirection =
    requestedDirection === "asc" || requestedDirection === "desc"
      ? requestedDirection
      : sort === defaults.sort
        ? defaults.dir
        : ISSUE_VIEW_SORTS[sort].preferredDirection;
  return { sort, dir };
}

/** A calendar day `YYYY-MM-DD`, or null when `value` is not a real day. */
export function parseDay(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === day
    ? day
    : null;
}

/**
 * A Created or Updated range: `from..to`, either end open (§7.1); older URLs
 * carry the ends as separate `*_from` and `*_to` parameters (§7.2).
 */
function parseRange(
  searchParams: ListSearchParams,
  name: "created" | "updated"
): IssueViewDateRange {
  const value = searchParams.get(name);
  if (value !== null) {
    const [from, to, extra] = value.split("..");
    if (extra !== undefined) return NO_RANGE;
    return { from: parseDay(from), to: parseDay(to) };
  }
  return {
    from: parseDay(searchParams.get(`${name}_from`)),
    to: parseDay(searchParams.get(`${name}_to`)),
  };
}

function serializeRange(range: IssueViewDateRange): string | null {
  if (range.from === null && range.to === null) return null;
  return `${range.from ?? ""}..${range.to ?? ""}`;
}

/**
 * A list a Page Preset sets by default (`status`, `presence`): absent means
 * the preset's values, `all` means every value, and a list keeps its valid
 * values; a list with none falls back to the preset (§9.3).
 */
function parseDefaultedList<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: readonly T[]
): T[] {
  if (value === null) return [...fallback];
  if (value === ALL_VALUES) return [];
  const values = canonicalFilterValues(value.split(","), allowed);
  return values.length > 0 ? values : [...fallback];
}

function serializeDefaultedList(
  values: readonly string[],
  fallback: readonly string[]
): string | null {
  if (arraysEqual(values, fallback)) return null;
  return values.length === 0 ? ALL_VALUES : values.join(",");
}

/** Machine initials in their canonical order: upper case, sorted. */
export function canonicalMachineValues(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^[A-Z0-9]{2,6}$/.test(value))
    ),
  ].sort();
}

function listParam(searchParams: ListSearchParams, name: string): string[] {
  return searchParams.get(name)?.split(",") ?? [];
}

/**
 * Parses an Issue View URL (issues-list §7). Invalid values are ignored
 * (list-views §9.3); older parameters open as their canonical equivalents
 * (§7.2); the retired Widget Population parameters are ignored
 * (issue-widgets §2.3). People and machines are checked against what exists
 * when the list loads.
 */
export function parseIssueViewState(
  searchParams: ListSearchParams
): IssueViewState {
  const defaults = ISSUE_VIEW_PRESET;
  // `include_inactive_machines` showed every presence state (§7.2).
  const presenceValue =
    searchParams.get("presence") ??
    (searchParams.get("include_inactive_machines") === "true"
      ? ALL_VALUES
      : null);
  const assignee = listParam(searchParams, "assignee").map((value) =>
    // The older Unassigned value (§7.2).
    value === "UNASSIGNED" ? UNASSIGNED_PERSON_ID : value
  );
  return {
    q: searchParams.get("q")?.trim() ?? defaults.q,
    status: parseDefaultedList(
      searchParams.get("status"),
      ISSUE_STATUS_ORDER,
      defaults.status
    ),
    severity: canonicalFilterValues(
      listParam(searchParams, "severity"),
      ISSUE_SEVERITY_VALUES
    ),
    priority: canonicalFilterValues(
      listParam(searchParams, "priority"),
      ISSUE_PRIORITY_VALUES
    ),
    machine: canonicalMachineValues(listParam(searchParams, "machine")),
    assignee: canonicalPeopleValues(assignee),
    presence: parseDefaultedList(
      presenceValue,
      VALID_MACHINE_PRESENCE_STATUSES,
      defaults.presence
    ),
    created: parseRange(searchParams, "created"),
    updated: parseRange(searchParams, "updated"),
    frequency: canonicalFilterValues(
      listParam(searchParams, "frequency"),
      ISSUE_FREQUENCY_VALUES
    ),
    owner: canonicalPeopleValues(listParam(searchParams, "owner")),
    reporter: canonicalPeopleValues(listParam(searchParams, "reporter")),
    watching: searchParams.get("watching") === "true",
    ...parseSort(searchParams),
    page: positiveInteger(searchParams.get("page"), defaults.page),
    pageSize: parsePageSize(
      searchParams.get("pageSize") ?? searchParams.get("page_size"),
      defaults.pageSize
    ),
  };
}

/**
 * Serializes view state relative to the Page Preset (list-views §9.3,
 * §9.5). `view` is the validated `view` reference (§9.6), appended last.
 */
export function serializeIssueViewState(
  state: IssueViewState,
  view: string | null = null
): URLSearchParams {
  const defaults = ISSUE_VIEW_PRESET;
  const params = new URLSearchParams();
  const set = (name: string, value: string | null): void => {
    if (value !== null) params.set(name, value);
  };
  const list = (name: string, values: readonly string[]): void =>
    set(name, values.length > 0 ? values.join(",") : null);

  set("q", state.q === defaults.q ? null : state.q);
  set("status", serializeDefaultedList(state.status, defaults.status));
  list("severity", state.severity);
  list("priority", state.priority);
  list("machine", state.machine);
  list("assignee", state.assignee);
  set("presence", serializeDefaultedList(state.presence, defaults.presence));
  set("created", serializeRange(state.created));
  set("updated", serializeRange(state.updated));
  list("frequency", state.frequency);
  list("owner", state.owner);
  list("reporter", state.reporter);
  set("watching", state.watching ? "true" : null);
  if (state.sort !== defaults.sort || state.dir !== defaults.dir) {
    params.set("sort", state.sort);
    params.set("dir", state.dir);
  }
  set("page", state.page === defaults.page ? null : String(state.page));
  set(
    "pageSize",
    state.pageSize === defaults.pageSize ? null : String(state.pageSize)
  );
  set("view", view);
  return params;
}

/** Parameters that carry view configuration, older ones included (§7.2). */
const ISSUE_VIEW_CONFIGURATION_PARAMS = [
  "q",
  "status",
  "severity",
  "priority",
  "machine",
  "assignee",
  "presence",
  "created",
  "updated",
  "frequency",
  "owner",
  "reporter",
  "watching",
  "sort",
  "dir",
  "pageSize",
  "view",
  "page_size",
  "include_inactive_machines",
  "created_from",
  "created_to",
  "updated_from",
  "updated_to",
] as const;

/**
 * Whether a URL carries view configuration other than `page` (list-views
 * §10.10). On the Issues page a URL without any opens the Default View.
 */
export function hasIssueViewConfiguration(
  searchParams: ListSearchParams
): boolean {
  return ISSUE_VIEW_CONFIGURATION_PARAMS.some(
    (name) => searchParams.get(name) !== null
  );
}

/** The configuration a Saved View stores: everything but the page (§10.2). */
export function toIssueViewSavedState(
  state: IssueViewState
): IssueViewSavedState {
  const { page: _page, ...saved } = state;
  return saved;
}

/** A stored configuration at `page`. */
export function issueViewStateAt(
  saved: IssueViewSavedState,
  page: number
): IssueViewState {
  return { ...saved, page };
}

/**
 * A Built-in View applied to the current configuration (list-views §1): its
 * search, filters, and sorting at the page size already showing.
 */
export function applyIssueBuiltInView(
  view: { state: IssueViewSavedState },
  current: IssueViewSavedState
): IssueViewSavedState {
  return { ...view.state, pageSize: current.pageSize };
}

/** The keys of a stored configuration that are also URL parameters. */
const SAVED_LIST_KEYS = [
  "q",
  "status",
  "severity",
  "priority",
  "machine",
  "assignee",
  "presence",
  "frequency",
  "owner",
  "reporter",
  "watching",
  "sort",
  "dir",
  "pageSize",
] as const satisfies readonly (keyof IssueViewSavedState)[];

function storedRange(stored: object, key: "created" | "updated"): string {
  const value: unknown = Object.getOwnPropertyDescriptor(stored, key)?.value;
  if (typeof value !== "object" || value === null) return "";
  const end = (name: "from" | "to"): string => {
    const day: unknown = Object.getOwnPropertyDescriptor(value, name)?.value;
    return typeof day === "string" ? day : "";
  };
  return `${end("from")}..${end("to")}`;
}

/**
 * Validates a configuration to store, or one read back from storage, exactly
 * as URL parameters are validated (list-views §9.3, §10.14). A stored empty
 * status or presence list means every value, as `all` does in a URL; a
 * missing key takes the Page Preset's value.
 */
export function normalizeIssueViewSavedState(
  stored: unknown
): IssueViewSavedState {
  const params = storedStateParams(stored, SAVED_LIST_KEYS);
  for (const key of ["status", "presence"] as const) {
    if (params.get(key) === "") params.set(key, ALL_VALUES);
  }
  if (typeof stored === "object" && stored !== null) {
    params.set("created", storedRange(stored, "created"));
    params.set("updated", storedRange(stored, "updated"));
  }
  return toIssueViewSavedState(parseIssueViewState(params));
}
