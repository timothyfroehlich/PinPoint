import { deriveMachineStatus } from "~/lib/machines/status";
import type { CollectionMachine } from "./owner";

export interface CollectionSummary {
  total: number;
  operational: number;
  needsService: number;
  unplayable: number;
  openIssues: number;
}

/** Header counts for a collection. `machines[].issues` must be open-only. */
export function summarizeCollection(
  machines: CollectionMachine[]
): CollectionSummary {
  const summary: CollectionSummary = {
    total: machines.length,
    operational: 0,
    needsService: 0,
    unplayable: 0,
    openIssues: 0,
  };
  for (const machine of machines) {
    summary.openIssues += machine.issues.length;
    const status = deriveMachineStatus(machine.issues);
    if (status === "unplayable") summary.unplayable += 1;
    else if (status === "needs_service") summary.needsService += 1;
    else summary.operational += 1;
  }
  return summary;
}
