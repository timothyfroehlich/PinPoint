import type { MachineViewHealth } from "~/lib/types";
import { isRemoved } from "~/lib/machines/presence";
import type { CollectionMachine } from "./types";

export interface CollectionSummary {
  total: number;
  operational: number;
  needsService: number;
  unplayable: number;
  openIssues: number;
}

/**
 * Header counts from the same compact health aggregates Machine View uses.
 * Removed machines and their issues are left out (collections-and-tags 4.2).
 */
export function summarizeCollection(
  machines: CollectionMachine[],
  healthByInitials: ReadonlyMap<string, MachineViewHealth>
): CollectionSummary {
  const counted = machines.filter(
    (machine) => !isRemoved(machine.presenceStatus)
  );
  const summary: CollectionSummary = {
    total: counted.length,
    operational: 0,
    needsService: 0,
    unplayable: 0,
    openIssues: 0,
  };
  for (const machine of counted) {
    const health = healthByInitials.get(machine.initials);
    summary.openIssues += health?.openIssues ?? 0;
    const status = health?.playability ?? "operational";
    if (status === "unplayable") summary.unplayable += 1;
    else if (status === "needs_service") summary.needsService += 1;
    else summary.operational += 1;
  }
  return summary;
}
