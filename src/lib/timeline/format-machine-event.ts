import type { MachineLifecycleEventData } from "~/lib/timeline/machine-event-types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import {
  personLabel,
  type ResolvedPerson,
} from "~/lib/timeline/resolve-person";

const PRESENCE_LABELS: Record<MachinePresenceStatus, string> = {
  on_the_floor: "On the floor",
  off_the_floor: "Off the floor",
  on_loan: "On loan",
  pending_arrival: "Pending arrival",
  removed: "Removed",
};

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
    case "owner_requirements_updated":
      return "Owner requirements updated";
    case "settings_set_created":
      return `Settings set "${event.setName}" created`;
    case "settings_set_updated":
      return `Settings set "${event.setName}" updated`;
    case "settings_set_deleted":
      return `Settings set "${event.setName}" removed`;
    case "settings_set_preferred":
      return `Marked "${event.setName}" as the preferred settings set`;
    // "Lineup" is Pinball Map's own word for the set of machines at a location,
    // and "listing" never appears in user-facing copy (spec 4.8).
    case "pinballmap_intent":
      switch (event.intent) {
        case "on":
          return "Set to be on the Pinball Map lineup";
        case "off":
          return "Set to be off the Pinball Map lineup";
        case "no_sync":
          return "Set to not sync with Pinball Map";
      }
    // eslint-disable-next-line no-fallthrough -- every arm above returns
    case "pinballmap_listing":
      switch (event.action) {
        case "listed":
          return "Added to the Pinball Map lineup";
        case "unlisted":
          return "Removed from the Pinball Map lineup";
        case "abandoned":
          return "Left an entry on the Pinball Map lineup";
        // Retired actions (PP-o355.21), rendered only for historical rows.
        case "linked":
          return "Linked to a Pinball Map entry";
        case "reconnected":
          return "Reconnected a Pinball Map entry";
        case "accepted_removal":
          return "Accepted that Pinball Map no longer carries this machine";
      }
  }
}
