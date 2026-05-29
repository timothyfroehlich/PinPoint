import type { MachineLifecycleEventData } from "~/lib/timeline/machine-event-types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { ResolvedPerson } from "~/lib/timeline/resolve-person";

const PRESENCE_LABELS: Record<MachinePresenceStatus, string> = {
  on_the_floor: "On the floor",
  off_the_floor: "Off the floor",
  on_loan: "On loan",
  pending_arrival: "Pending arrival",
  removed: "Removed",
};

/**
 * Display a resolved person with an `(invited)` marker when they have not yet
 * signed up. Names resolve live (PP-tv9l) — never snapshotted, never email.
 */
function personLabel(person: ResolvedPerson): string {
  return person.isInvited
    ? `${person.displayName} (invited)`
    : person.displayName;
}

/**
 * Format a lifecycle event (machine added, owner/name/presence changes, prose
 * markers) for the single-line system row. Issue-side events are formatted by
 * MachineTimelineIssueRow, not here.
 *
 * `people` carries the live-resolved owner references (`to_owner`/`from_owner`)
 * for the owner events; which are present distinguishes set / changed /
 * removed.
 */
export function formatMachineEvent(
  event: MachineLifecycleEventData,
  people: Record<string, ResolvedPerson>
): string {
  switch (event.kind) {
    case "machine_added":
      return "Machine added";
    case "owner_set": {
      const to = people["to_owner"];
      return to ? `Owner set to ${personLabel(to)}` : "Owner set";
    }
    case "owner_changed": {
      const from = people["from_owner"];
      const to = people["to_owner"];
      if (!to && from) return `Owner removed (was ${personLabel(from)})`;
      if (to && !from) return `Owner set to ${personLabel(to)}`;
      if (to && from) {
        return `Owner changed from ${personLabel(from)} to ${personLabel(to)}`;
      }
      return "Owner changed";
    }
    case "name_changed":
      return `Name changed from "${event.from}" to "${event.to}"`;
    case "presence_changed":
      return `Availability changed from ${PRESENCE_LABELS[event.from]} to ${PRESENCE_LABELS[event.to]}`;
    case "description_updated":
      return "Description updated";
    case "tournament_notes_updated":
      return "Tournament notes updated";
    case "owner_requirements_updated":
      return "Owner requirements updated";
    case "owner_notes_updated":
      return "Owner notes updated";
  }
}
