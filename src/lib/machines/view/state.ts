import {
  ISSUE_SEVERITY_VALUES,
  MACHINE_VIEW_FIELD_IDS,
  type MachineViewFieldId,
  type MachineViewPageSize,
  type MachineViewPresetId,
  type MachineViewSavedState,
  type MachineViewSortDirection,
  type MachineViewState,
} from "~/lib/types";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import type { MachineStatus } from "~/lib/machines/status";
import {
  getMachineViewPreset,
  MACHINE_VIEW_FIELDS,
  ME_OWNER_ID,
  UNASSIGNED_OWNER_ID,
} from "~/lib/machines/view/config";

/** Playability values in their canonical order (machine-views §3.12). */
export const MACHINE_STATUS_VALUES: readonly MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

/** Page sizes (list-views §5.7). */
export const MACHINE_VIEW_PAGE_SIZES: readonly MachineViewPageSize[] = [
  25, 50, 100,
];

export function isMachineViewField(
  value: string | null
): value is MachineViewFieldId {
  return (
    value !== null && MACHINE_VIEW_FIELD_IDS.some((field) => field === value)
  );
}

export function isMachineViewPageSize(
  value: number
): value is MachineViewPageSize {
  return MACHINE_VIEW_PAGE_SIZES.some((size) => size === value);
}

export interface MachineViewSearchParams {
  get(name: string): string | null;
}

export function toMachineViewSearchParams(
  values: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) params.set(key, value.join(","));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

/** The values of a URL list that `allowed` names, in the URL's order. */
function parseList<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T[] {
  if (!value) return [];
  const allowedSet = new Set<string>(allowed);
  return [...new Set(value.split(","))].filter((item): item is T =>
    allowedSet.has(item)
  );
}

/**
 * The values of `values` that `allowed` names, in `allowed`'s order. A filter
 * selection is a set, so one order keeps the same selection the same
 * configuration however it was made (list-views §9.3, §10.3).
 */
export function canonicalFilterValues<T extends string>(
  values: readonly string[],
  allowed: readonly T[]
): T[] {
  const selected = new Set(values);
  return allowed.filter((value) => selected.has(value));
}

const OWNER_SHORTCUTS = [ME_OWNER_ID, UNASSIGNED_OWNER_ID];

/**
 * An Owner selection in its canonical order: Me, then Unassigned, then
 * people by id. Ids are the only order every selection shares, since names
 * can change and an id may name nobody on this Surface (list-views §10.18).
 */
export function canonicalOwnerValues(values: readonly string[]): string[] {
  const unique = [...new Set(values)].filter(Boolean);
  const people = unique
    .filter((value) => !OWNER_SHORTCUTS.includes(value))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return [...canonicalFilterValues(unique, OWNER_SHORTCUTS), ...people];
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function arraysEqual<T>(
  left: readonly T[],
  right: readonly T[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function presenceEqual(
  left: MachineViewState["presence"],
  right: MachineViewState["presence"]
): boolean {
  if (left === "all" || right === "all") return left === right;
  return arraysEqual(left, right);
}

export function parseMachineViewState(
  searchParams: MachineViewSearchParams,
  presetId: MachineViewPresetId
): MachineViewState {
  const preset = getMachineViewPreset(presetId);
  const defaults = preset.defaultState;
  const presenceValue = searchParams.get("presence");
  const parsedPresence =
    presenceValue === "all"
      ? "all"
      : canonicalFilterValues(
          presenceValue?.split(",") ?? [],
          VALID_MACHINE_PRESENCE_STATUSES
        );
  const presence: "all" | MachinePresenceStatus[] =
    parsedPresence === "all" || parsedPresence.length > 0
      ? parsedPresence
      : defaults.presence;
  const requestedSort = searchParams.get("sort");
  const sort =
    isMachineViewField(requestedSort) &&
    preset.permittedFields.includes(requestedSort)
      ? requestedSort
      : defaults.sort;
  const requestedDirection = searchParams.get("dir");
  const dir: MachineViewSortDirection =
    requestedDirection === "asc" || requestedDirection === "desc"
      ? requestedDirection
      : sort === defaults.sort
        ? defaults.dir
        : MACHINE_VIEW_FIELDS[sort].preferredDirection;
  const requestedPageSize = positiveInteger(
    searchParams.get("pageSize"),
    defaults.pageSize
  );
  const pageSize: MachineViewPageSize = isMachineViewPageSize(requestedPageSize)
    ? requestedPageSize
    : defaults.pageSize;
  // Displayed fields keep the URL's order: it is the order they show in.
  const requestedColumns = parseList(
    searchParams.get("columns"),
    MACHINE_VIEW_FIELD_IDS
  ).filter((field) => preset.permittedFields.includes(field));
  const columns =
    requestedColumns.length === 0
      ? defaults.columns
      : [
          "machine" as const,
          ...requestedColumns.filter((field) => field !== "machine"),
        ];

  return {
    q: searchParams.get("q")?.trim() ?? defaults.q,
    presence,
    status: canonicalFilterValues(
      searchParams.get("status")?.split(",") ?? [],
      MACHINE_STATUS_VALUES
    ),
    severity: canonicalFilterValues(
      searchParams.get("severity")?.split(",") ?? [],
      ISSUE_SEVERITY_VALUES
    ),
    owner: canonicalOwnerValues(searchParams.get("owner")?.split(",") ?? []),
    sort,
    dir,
    page: positiveInteger(searchParams.get("page"), defaults.page),
    pageSize,
    columns,
  };
}

/**
 * Serializes view state relative to the Page Preset (list-views §9.3, §9.5). `view`
 * is the validated `view` reference (§9.6): an owned Saved View id or a
 * Built-in View id; it is appended last and never changes the other
 * parameters.
 */
export function serializeMachineViewState(
  state: MachineViewState,
  presetId: MachineViewPresetId,
  view: string | null = null
): URLSearchParams {
  const defaults = getMachineViewPreset(presetId).defaultState;
  const params = new URLSearchParams();

  if (state.q !== defaults.q) params.set("q", state.q);
  if (!presenceEqual(state.presence, defaults.presence)) {
    params.set(
      "presence",
      state.presence === "all" ? "all" : state.presence.join(",")
    );
  }
  if (state.status.length > 0) params.set("status", state.status.join(","));
  if (state.severity.length > 0) {
    params.set("severity", state.severity.join(","));
  }
  if (state.owner.length > 0) params.set("owner", state.owner.join(","));
  if (state.sort !== defaults.sort || state.dir !== defaults.dir) {
    params.set("sort", state.sort);
    params.set("dir", state.dir);
  }
  if (state.page !== defaults.page) params.set("page", String(state.page));
  if (state.pageSize !== defaults.pageSize) {
    params.set("pageSize", String(state.pageSize));
  }
  if (!arraysEqual(state.columns, defaults.columns)) {
    params.set("columns", state.columns.join(","));
  }
  if (view) params.set("view", view);

  return params;
}

const MACHINE_VIEW_CONFIGURATION_PARAMS = [
  "q",
  "presence",
  "status",
  "severity",
  "owner",
  "sort",
  "dir",
  "pageSize",
  "columns",
  "view",
] as const;

/**
 * Whether a URL carries view configuration other than `page` (list-views §10.10).
 * On the Machines page a URL without any opens the account's Default View.
 */
export function hasMachineViewConfiguration(
  searchParams: MachineViewSearchParams
): boolean {
  return MACHINE_VIEW_CONFIGURATION_PARAMS.some(
    (name) => searchParams.get(name) !== null
  );
}

/** The configuration a Saved View stores: everything but the page (§10.2). */
export function toMachineViewSavedState(
  state: MachineViewState
): MachineViewSavedState {
  const { page: _page, ...saved } = state;
  return saved;
}

/**
 * The canonical URL parameters that open a Saved View: its configuration at
 * page 1 (list-views §10.6), relative to the Page Preset (§9.5), naming the view.
 */
export function savedMachineViewSearchParams(
  saved: MachineViewSavedState,
  presetId: MachineViewPresetId,
  viewId: string
): URLSearchParams {
  return serializeMachineViewState({ ...saved, page: 1 }, presetId, viewId);
}

/** The keys of a stored configuration, which are also its URL parameters. */
const SAVED_STATE_KEYS = [
  "q",
  "presence",
  "status",
  "severity",
  "owner",
  "sort",
  "dir",
  "pageSize",
  "columns",
] as const satisfies readonly (keyof MachineViewSavedState)[];

/**
 * A Saved View belongs to the Machine View host, not a Surface (list-views
 * §10.5), so one preset fills any key a stored configuration lacks. The
 * stored configuration is absolute, so this choice never changes a value it
 * carries.
 */
const SAVED_STATE_PRESET: MachineViewPresetId = "machines";

function storedParamValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(",");
  }
  return null;
}

/**
 * Validates a configuration to store or one read back from storage exactly as
 * URL parameters are validated (list-views §9.3, §10.14): values that no
 * longer exist are dropped, keys the parser does not know are ignored, and a
 * missing key takes the preset's default. Ignored keys include the retired
 * Widget Population keys older views still carry (machine-widgets §2.2); the
 * normalized result never holds them, so saving a view never writes them
 * back. Owners are checked against the
 * people who exist on read and again when the view is applied; fields a
 * particular Surface does not permit are dropped when it is applied there.
 */
export function normalizeMachineViewSavedState(
  stored: unknown
): MachineViewSavedState {
  const params = new URLSearchParams();
  if (typeof stored === "object" && stored !== null) {
    for (const key of SAVED_STATE_KEYS) {
      const value = storedParamValue(
        Object.getOwnPropertyDescriptor(stored, key)?.value
      );
      if (value !== null) params.set(key, value);
    }
  }
  return toMachineViewSavedState(
    parseMachineViewState(params, SAVED_STATE_PRESET)
  );
}

/** Whether two configurations are the same view, ignoring the page. */
export function machineViewSavedStatesEqual(
  left: MachineViewSavedState,
  right: MachineViewSavedState,
  presetId: MachineViewPresetId
): boolean {
  return (
    serializeMachineViewState({ ...left, page: 1 }, presetId).toString() ===
    serializeMachineViewState({ ...right, page: 1 }, presetId).toString()
  );
}

export function nextMachineViewSort(
  current: Pick<MachineViewState, "sort" | "dir">,
  field: MachineViewFieldId,
  presetId: MachineViewPresetId
): Pick<MachineViewState, "sort" | "dir"> {
  const preferred = MACHINE_VIEW_FIELDS[field].preferredDirection;
  if (current.sort !== field) return { sort: field, dir: preferred };
  if (current.dir === preferred) {
    return { sort: field, dir: preferred === "asc" ? "desc" : "asc" };
  }
  const defaults = getMachineViewPreset(presetId).defaultState;
  return { sort: defaults.sort, dir: defaults.dir };
}
