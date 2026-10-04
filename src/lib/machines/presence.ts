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
 * CSS classes for presence badge. State-color tokens (globals.css, design
 * bible §1); On the Floor shares the Operational green.
 */
export function getMachinePresenceStyles(
  status: MachinePresenceStatus
): string {
  const styles: Record<MachinePresenceStatus, string> = {
    on_the_floor:
      "bg-presence-on-the-floor/15 text-presence-on-the-floor border-presence-on-the-floor/45",
    off_the_floor:
      "bg-presence-off-the-floor/15 text-presence-off-the-floor border-presence-off-the-floor/45",
    on_loan:
      "bg-presence-on-loan/15 text-presence-on-loan border-presence-on-loan/45",
    pending_arrival:
      "bg-presence-pending-arrival/15 text-presence-pending-arrival border-presence-pending-arrival/45",
    removed:
      "bg-presence-removed/15 text-presence-removed border-presence-removed/45",
  };

  return styles[status];
}

export function isOnTheFloor(status: MachinePresenceStatus): boolean {
  return status === "on_the_floor";
}

/**
 * Removed is the archived presence state (PP-s363). The SQL counterpart is
 * `machineNotRemoved()` in `~/lib/machines/queries`.
 */
export function isRemoved(status: MachinePresenceStatus): boolean {
  return status === "removed";
}

/**
 * Summary Widget colors per presence: `text` for the count, `fill` for the bar
 * segment. Same tokens as {@link getMachinePresenceStyles}. The Presence
 * Widget does not count Removed machines (machine-widgets §3.2).
 */
export const MACHINE_PRESENCE_WIDGET_COLORS: Record<
  Exclude<MachinePresenceStatus, "removed">,
  { text: string; fill: string }
> = {
  on_the_floor: {
    text: "text-presence-on-the-floor",
    fill: "bg-presence-on-the-floor-bar",
  },
  off_the_floor: {
    text: "text-presence-off-the-floor",
    fill: "bg-presence-off-the-floor",
  },
  on_loan: { text: "text-presence-on-loan", fill: "bg-presence-on-loan-bar" },
  pending_arrival: {
    text: "text-presence-pending-arrival",
    fill: "bg-presence-pending-arrival",
  },
};
