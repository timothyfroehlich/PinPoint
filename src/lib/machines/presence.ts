export const VALID_MACHINE_PRESENCE_STATUSES = [
  "on_the_floor",
  "off_the_floor",
  "on_loan",
  "pending_arrival",
  "removed",
] as const;

export type MachinePresenceStatus =
  (typeof VALID_MACHINE_PRESENCE_STATUSES)[number];

export function getMachinePresenceLabel(status: MachinePresenceStatus): string {
  const labels: Record<MachinePresenceStatus, string> = {
    on_the_floor: "On the Floor",
    off_the_floor: "Off the Floor",
    on_loan: "On Loan",
    pending_arrival: "Pending Arrival",
    removed: "Removed",
  };

  return labels[status];
}

/**
 * CSS classes for presence badge.
 * Uses neutral/muted palette to differentiate from health status colors.
 */
export function getMachinePresenceStyles(
  status: MachinePresenceStatus
): string {
  const styles: Record<MachinePresenceStatus, string> = {
    on_the_floor:
      "bg-success-container text-on-success-container border-success",
    off_the_floor:
      "bg-surface-container-highest text-on-surface-variant border-outline-variant",
    on_loan: "bg-tertiary-container text-on-tertiary-container border-tertiary",
    pending_arrival:
      "bg-secondary-container text-on-secondary-container border-secondary",
    removed: "bg-surface-container text-on-surface-variant border-outline",
  };

  return styles[status];
}

export function isOnTheFloor(status: MachinePresenceStatus): boolean {
  return status === "on_the_floor";
}
