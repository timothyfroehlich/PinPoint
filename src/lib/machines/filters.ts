import type { MachineStatus } from "~/lib/machines/status";
import {
  type MachinePresenceStatus,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
export type { MachineStatus };

export const VALID_MACHINE_STATUSES: MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

export const VALID_MACHINE_SORTS = [
  "name_asc",
  "name_desc",
  "status_desc",
  "status_asc",
  "issues_desc",
  "issues_asc",
  "created_desc",
  "created_asc",
] as const;

export type MachineSort = (typeof VALID_MACHINE_SORTS)[number];

export interface MachineFilters {
  q?: string | undefined;
  status?: MachineStatus[] | undefined;
  owner?: string[] | undefined;
  presence?: MachinePresenceStatus[] | undefined;
  sort?: MachineSort | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/**
 * Parses URLSearchParams into a type-safe MachineFilters object
 */
export function parseMachineFilters(params: URLSearchParams): MachineFilters {
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

  const filters: MachineFilters = {};

  const q = params.get("q");
  if (q) filters.q = q;

  const status = parseCommaList(params.get("status"), VALID_MACHINE_STATUSES);
  if (status !== undefined) {
    filters.status = status;
  }

  const owner = params.get("owner")?.split(",");
  if (owner) filters.owner = owner;

  const presence = parseCommaList(
    params.get("presence"),
    VALID_MACHINE_PRESENCE_STATUSES
  );
  if (presence !== undefined) {
    filters.presence = presence;
  }

  const sort = (params.get("sort") as MachineSort | null) ?? "name_asc";
  filters.sort = VALID_MACHINE_SORTS.includes(sort) ? sort : "name_asc";

  const p = parseInt(params.get("page") ?? "1", 10);
  filters.page = !isNaN(p) && p > 0 ? p : 1;
  const ps = parseInt(params.get("page_size") ?? "15", 10);
  filters.pageSize = !isNaN(ps) && ps > 0 ? ps : 15;

  return filters;
}

/**
 * Checks if any machine filters are active in the search params
 */
export function hasActiveMachineFilters(params: URLSearchParams): boolean {
  const filterKeys = ["q", "status", "owner", "presence"];
  return filterKeys.some((key) => {
    const val = params.get(key);
    return val !== null && val.length > 0;
  });
}
