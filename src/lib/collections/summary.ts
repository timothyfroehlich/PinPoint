import type { MachineViewHealth } from "~/lib/types";
import type { CollectionMachine } from "./owner";

export interface CollectionSummary {
  total: number;
  operational: number;
  needsService: number;
  unplayable: number;
  openIssues: number;
}

/** Header counts from the same compact health aggregates Machine View uses. */
export function summarizeCollection(
  machines: CollectionMachine[],
  healthByInitials: ReadonlyMap<string, MachineViewHealth>
): CollectionSummary {
  const summary: CollectionSummary = {
    total: machines.length,
    operational: 0,
    needsService: 0,
    unplayable: 0,
    openIssues: 0,
  };
  for (const machine of machines) {
    const health = healthByInitials.get(machine.initials);
    summary.openIssues += health?.openIssues ?? 0;
    const status = health?.playability ?? "operational";
    if (status === "unplayable") summary.unplayable += 1;
    else if (status === "needs_service") summary.needsService += 1;
    else summary.operational += 1;
  }
  return summary;
}
