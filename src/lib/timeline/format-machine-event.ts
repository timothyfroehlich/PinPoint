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
  // Narrow via `in` rather than an unsafe cast (PP-0x98 review).
  if (value in STATUS_CONFIG) {
    return STATUS_CONFIG[value as keyof typeof STATUS_CONFIG].label;
  }
  return value;
}

/**
 * Renders the "Issue #N" anchor plus the title clause when present:
 *   - with title:    `Issue #42 "Flipper sticking"`
 *   - without title: `Issue #42`
 * The leading `Issue #N` token stays first so the system-row renderer can
 * regex-replace it with a `<Link>` to the issue.
 */
function issueAnchor(issueNumber: number, title: string | undefined): string {
  const base = `Issue #${String(issueNumber)}`;
  return title ? `${base} "${title}"` : base;
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
      return `${issueAnchor(event.issueNumber, event.title)} opened by ${event.openedByName}`;
    case "issue_closed":
      return `${issueAnchor(event.issueNumber, event.title)} closed by ${event.closedByName}`;
    case "issue_status_changed":
      return `${issueAnchor(event.issueNumber, event.title)} status changed from ${issueStatusLabel(event.from)} to ${issueStatusLabel(event.to)}`;
    case "issue_assigned":
      return `${issueAnchor(event.issueNumber, event.title)} assigned to ${event.assigneeName}`;
    case "issue_unassigned":
      return `${issueAnchor(event.issueNumber, event.title)} unassigned`;
    case "issue_reassigned_out":
      return `${issueAnchor(event.issueNumber, event.title)} moved to ${event.toMachineName}`;
    case "issue_reassigned_in":
      return `${issueAnchor(event.issueNumber, event.title)} received from ${event.fromMachineName}`;
  }
}
