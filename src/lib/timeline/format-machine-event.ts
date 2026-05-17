import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { STATUS_CONFIG } from "~/lib/issues/status";

const PRESENCE_LABELS: Record<MachinePresenceStatus, string> = {
  on_the_floor: "On the floor",
  off_the_floor: "Off the floor",
  on_loan: "On loan",
  pending_arrival: "Pending arrival",
  removed: "Removed",
};

function issueStatusLabel(value: string): string {
  const config = (
    STATUS_CONFIG as Record<string, { label: string } | undefined>
  )[value];
  return config?.label ?? value;
}

export function formatMachineEvent(event: MachineTimelineEventData): string {
  switch (event.kind) {
    case "machine_added":
      return "Machine added";
    case "owner_set":
      return `Owner set to ${event.toOwnerName}`;
    case "owner_changed":
      if (event.toOwnerName === null && event.fromOwnerName !== null) {
        return `Owner removed (was ${event.fromOwnerName})`;
      }
      if (event.fromOwnerName === null && event.toOwnerName !== null) {
        return `Owner set to ${event.toOwnerName}`;
      }
      return `Owner changed from ${event.fromOwnerName ?? "—"} to ${event.toOwnerName ?? "—"}`;
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
    case "issue_opened":
      return `Issue #${String(event.issueNumber)} opened by ${event.openedByName}`;
    case "issue_closed":
      return `Issue #${String(event.issueNumber)} closed by ${event.closedByName}`;
    case "issue_status_changed":
      return `Issue #${String(event.issueNumber)} status changed from ${issueStatusLabel(event.from)} to ${issueStatusLabel(event.to)}`;
    case "issue_assigned":
      return `Issue #${String(event.issueNumber)} assigned to ${event.assigneeName}`;
    case "issue_unassigned":
      return `Issue #${String(event.issueNumber)} unassigned`;
    case "issue_reassigned_out":
      return `Issue #${String(event.issueNumber)} moved to ${event.toMachineName}`;
    case "issue_reassigned_in":
      return `Issue #${String(event.issueNumber)} received from ${event.fromMachineName}`;
  }
}
