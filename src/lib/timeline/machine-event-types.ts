import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { IssueFrequency, IssueSeverity, IssueStatus } from "~/lib/types";

/**
 * Discriminated union of every structured event variant that can be stored
 * in `timeline_events.event_data`. The `kind` field is the discriminator.
 *
 * Comment rows (sourceType='comment') have eventData = null and store the
 * ProseMirror document in `content` instead.
 */
export type MachineTimelineEventData =
  // === sourceType='lifecycle' (auto-emitted from machine mutation actions) ===
  | { kind: "machine_added" }
  | { kind: "owner_set"; toOwnerId: string; toOwnerName: string }
  | {
      kind: "owner_changed";
      fromOwnerId: string | null;
      fromOwnerName: string | null;
      toOwnerId: string | null;
      toOwnerName: string | null;
    }
  | { kind: "name_changed"; from: string; to: string }
  | {
      kind: "presence_changed";
      from: MachinePresenceStatus;
      to: MachinePresenceStatus;
    }
  | { kind: "description_updated" }
  | { kind: "tournament_notes_updated" }
  | { kind: "owner_requirements_updated" }
  | { kind: "owner_notes_updated" }
  // === sourceType='issue' (duplicate-written from issue actions) ===
  | {
      kind: "issue_opened";
      issueId: string;
      issueNumber: number;
      openedByName: string;
      title: string;
      // Snapshot of the issue's metadata at the moment of opening. Optional
      // because pre-PP-0x98-badges rows (and the backfill against historical
      // issues that lack at-open-time facts in the audit trail) carry just
      // the current value of these fields. Renderers omit the badges when
      // the snapshot is missing.
      severity?: IssueSeverity;
      frequency?: IssueFrequency;
    }
  | {
      kind: "issue_closed";
      issueId: string;
      issueNumber: number;
      closedByName: string;
      title: string;
      // Which closed-group status was chosen — `fixed`, `wont_fix`, `wai`,
      // `no_repro`, or `duplicate`. Acts as the "close reason" because
      // PinPoint doesn't have a separate close-reason field; the closing
      // status IS the resolution. Optional for legacy rows from the
      // backfill (which only knew "it's closed", not how).
      closedAsStatus?: IssueStatus;
    }
  | {
      kind: "issue_status_changed";
      issueId: string;
      issueNumber: number;
      from: string;
      to: string;
      // Optional: pre-PP-0x98-title rows have no title. Renderer omits the
      // title clause when missing rather than printing "undefined".
      title?: string;
    }
  | {
      kind: "issue_assigned";
      issueId: string;
      issueNumber: number;
      assigneeName: string;
      title?: string;
    }
  | {
      kind: "issue_unassigned";
      issueId: string;
      issueNumber: number;
      title?: string;
    }
  | {
      kind: "issue_reassigned_out";
      issueId: string;
      issueNumber: number;
      toMachineName: string;
      toMachineId: string;
      title?: string;
    }
  | {
      kind: "issue_reassigned_in";
      issueId: string;
      issueNumber: number;
      fromMachineName: string;
      fromMachineId: string;
      title?: string;
    };

export type MachineTimelineEventKind = MachineTimelineEventData["kind"];
