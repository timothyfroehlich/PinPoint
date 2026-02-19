import type { MachineFilters, MachineSort, MachineStatus } from "./filters";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

export interface MachineWithDerivedStatus {
  id: string;
  name: string;
  initials: string;
  status: MachineStatus;
  presenceStatus: MachinePresenceStatus;
  openIssuesCount: number;
  createdAt: Date | string;
  ownerId?: string | null;
  invitedOwnerId?: string | null;
}

const STATUS_PRIORITY: Record<MachineStatus, number> = {
  unplayable: 3,
  needs_service: 2,
  operational: 1,
};

/**
 * Filters a list of machines based on provided filters
 */
export function applyMachineFilters(
  machines: MachineWithDerivedStatus[],
  filters: MachineFilters
): MachineWithDerivedStatus[] {
  return machines.filter((machine) => {
    // 1. Search filter
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      const initialsMatch = machine.initials.toLowerCase() === q;
      const nameMatch = machine.name.toLowerCase().includes(q);
      if (!initialsMatch && !nameMatch) return false;
    }

    // 2. Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(machine.status)) return false;
    }

    // 3. Owner filter
    if (filters.owner && filters.owner.length > 0) {
      const matchesOwner =
        (machine.ownerId != null && filters.owner.includes(machine.ownerId)) ||
        (machine.invitedOwnerId != null &&
          filters.owner.includes(machine.invitedOwnerId));
      if (!matchesOwner) return false;
    }

    // 4. Presence filter
    if (filters.presence && filters.presence.length > 0) {
      if (!filters.presence.includes(machine.presenceStatus)) return false;
    }

    return true;
  });
}

/**
 * Sorts a list of machines based on the selected sort option
 */
export function sortMachines(
  machines: MachineWithDerivedStatus[],
  sort: MachineSort
): MachineWithDerivedStatus[] {
  return [...machines].sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "status_desc":
        return STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
      case "status_asc":
        return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      case "issues_desc":
        return b.openIssuesCount - a.openIssuesCount;
      case "issues_asc":
        return a.openIssuesCount - b.openIssuesCount;
      case "created_desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "created_asc":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      default:
        return 0;
    }
  });
}
