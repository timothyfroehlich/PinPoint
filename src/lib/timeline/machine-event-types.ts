import type { MachinePresenceStatus } from "~/lib/machines/presence";

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
    }
  | {
      kind: "issue_closed";
      issueId: string;
      issueNumber: number;
      closedByName: string;
      title: string;
    }
  | {
      kind: "issue_status_changed";
      issueId: string;
      issueNumber: number;
      from: string;
      to: string;
    }
  | {
      kind: "issue_assigned";
      issueId: string;
      issueNumber: number;
      assigneeName: string;
    }
  | {
      kind: "issue_unassigned";
      issueId: string;
      issueNumber: number;
    }
  | {
      kind: "issue_reassigned_out";
      issueId: string;
      issueNumber: number;
      toMachineName: string;
      toMachineId: string;
    }
  | {
      kind: "issue_reassigned_in";
      issueId: string;
      issueNumber: number;
      fromMachineName: string;
      fromMachineId: string;
    };

export type MachineTimelineEventKind = MachineTimelineEventData["kind"];
