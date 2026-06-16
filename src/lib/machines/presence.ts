export const VALID_MACHINE_PRESENCE_STATUSES = [
  "on_the_floor",
  "off_the_floor",
  "on_loan",
  "pending_arrival",
  "removed",
] as const;

export type MachinePresenceStatus =
  (typeof VALID_MACHINE_PRESENCE_STATUSES)[number];

/**
 * Sort rank for machine presence — ascending is most-present → least-present,
 * matching the declared order of {@link VALID_MACHINE_PRESENCE_STATUSES}.
 * Mirrors `MACHINE_STATUS_RANK`. Keep the keys in sync with that array.
 */
export const MACHINE_PRESENCE_RANK: Record<MachinePresenceStatus, number> = {
  on_the_floor: 0,
  off_the_floor: 1,
  on_loan: 2,
  pending_arrival: 3,
  removed: 4,
};

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
      "bg-surface-container-highest text-muted-foreground border-outline-variant",
    on_loan: "bg-tertiary-container text-on-tertiary-container border-tertiary",
    pending_arrival:
      "bg-secondary-container text-on-secondary-container border-secondary",
    removed: "bg-surface-container text-muted-foreground border-outline",
  };

  return styles[status];
}

export function isOnTheFloor(status: MachinePresenceStatus): boolean {
  return status === "on_the_floor";
}
