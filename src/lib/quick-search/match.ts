import type {
  QuickSearchMachineIndexEntry,
  QuickSearchMachineResult,
} from "~/lib/quick-search/types";

export const QUICK_SEARCH_MIN_QUERY_LENGTH = 2;
export const QUICK_SEARCH_MAX_QUERY_LENGTH = 80;
export const QUICK_SEARCH_RESULT_LIMIT = 5;

export function normalizeQuickSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, QUICK_SEARCH_MAX_QUERY_LENGTH);
}

/**
 * Rank one machine against a lowercased query, or null when nothing matches.
 * Exact initials first, then prefixes, then contained text (spec 4.3, 4.4).
 */
function machineRank(
  machine: QuickSearchMachineIndexEntry,
  query: string
): number | null {
  const initials = machine.initials.toLowerCase();
  const name = machine.name.toLowerCase();
  const modelFields = [machine.modelName, machine.manufacturer, machine.year]
    .filter((field) => field !== null)
    .map((field) => field.toLowerCase());

  if (
    !initials.includes(query) &&
    !name.includes(query) &&
    !modelFields.some((field) => field.includes(query))
  ) {
    return null;
  }
  if (initials === query) return 0;
  if (initials.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (modelFields.some((field) => field.startsWith(query))) return 3;
  return 4;
}

/**
 * Match quick search machines in the browser (spec 5.9, 7.5). Runs on every
 * keystroke, so it stays a single pass over the viewer's machines.
 */
export function matchQuickSearchMachines(
  machines: readonly QuickSearchMachineIndexEntry[],
  rawQuery: string
): QuickSearchMachineResult[] {
  const query = normalizeQuickSearchQuery(rawQuery).toLowerCase();
  if (query.length < QUICK_SEARCH_MIN_QUERY_LENGTH) return [];

  return machines
    .flatMap((machine) => {
      const rank = machineRank(machine, query);
      return rank === null ? [] : [{ machine, rank }];
    })
    .sort(
      (a, b) => a.rank - b.rank || a.machine.name.localeCompare(b.machine.name)
    )
    .slice(0, QUICK_SEARCH_RESULT_LIMIT)
    .map(({ machine }) => ({
      id: machine.id,
      initials: machine.initials,
      name: machine.name,
      modelName: machine.modelName,
    }));
}
