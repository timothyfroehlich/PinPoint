import {
  MACHINE_VIEW_FIELD_IDS,
  type MachineViewFieldId,
  type MachineViewPageSize,
  type MachineViewPresetId,
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
} from "~/lib/machines/view/config";

const MACHINE_STATUS_VALUES: MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];
function isMachineViewField(value: string | null): value is MachineViewFieldId {
  return (
    value !== null && MACHINE_VIEW_FIELD_IDS.some((field) => field === value)
  );
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

function parseCanonicalList<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T[] {
  if (!value) return [];
  const allowedSet = new Set<string>(allowed);
  return [...new Set(value.split(","))].filter((item): item is T =>
    allowedSet.has(item)
  );
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function presenceEqual(
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
      : parseCanonicalList(presenceValue, VALID_MACHINE_PRESENCE_STATUSES);
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
  const pageSize: MachineViewPageSize =
    requestedPageSize === 25 ||
    requestedPageSize === 50 ||
    requestedPageSize === 100
      ? requestedPageSize
      : defaults.pageSize;
  const requestedColumns = parseCanonicalList(
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
    status: parseCanonicalList(
      searchParams.get("status"),
      MACHINE_STATUS_VALUES
    ),
    owner: [...new Set(searchParams.get("owner")?.split(",") ?? [])].filter(
      Boolean
    ),
    sort,
    dir,
    page: positiveInteger(searchParams.get("page"), defaults.page),
    pageSize,
    columns,
  };
}

export function serializeMachineViewState(
  state: MachineViewState,
  presetId: MachineViewPresetId
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

  return params;
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
