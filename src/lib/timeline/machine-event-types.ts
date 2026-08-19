import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { IssueFrequency, IssueSeverity, IssueStatus } from "~/lib/types";

/**
 * Discriminated union of every structured event variant that can be stored
 * in `timeline_events.event_data`. The `kind` field is the discriminator.
 *
 * Comment rows (sourceType='comment') have eventData = null and store the
 * ProseMirror document in `content` instead.
 *
 * Identity resolution (PP-tv9l): event_data carries ONLY immutable facts —
 * the kind and any enum-valued transition endpoints. People are NOT stored
 * here; they live in `timeline_event_people` (stable id refs) and are
 * resolved to current names/links/invited-status live at render. The two
 * owner variants therefore carry no person fields: which `timeline_event_people`
 * rows exist (`from_owner` / `to_owner`) determines set-vs-changed-vs-removed.
 */
export type MachineTimelineEventData =
  // === sourceType='lifecycle' (auto-emitted from machine mutation actions) ===
  | { kind: "machine_added" }
  | { kind: "owner_set" }
  | { kind: "owner_changed" }
  | { kind: "name_changed"; from: string; to: string }
  | {
      kind: "presence_changed";
      from: MachinePresenceStatus;
      to: MachinePresenceStatus;
    }
  | { kind: "description_updated" }
  | { kind: "owner_requirements_updated" }
  // === sourceType='lifecycle', tag='settings' (PP-43q3, default-off) ===
  // `setName` is an immutable snapshot of the set's name at event time (a
  // deleted set has no row to resolve from; created/updated/preferred mirror
  // the name_changed string-snapshot precedent).
  | { kind: "settings_set_created"; setName: string }
  | { kind: "settings_set_updated"; setName: string }
  | { kind: "settings_set_deleted"; setName: string }
  | { kind: "settings_set_preferred"; setName: string }
  // === sourceType='lifecycle' — Pinball Map (PP-o355.12, PP-o355.21) ===
  //
  // Two kinds, because the two facts are genuinely different and a reader needs
  // to tell them apart: `pinballmap_intent` is what an operator DECIDED here,
  // `pinballmap_listing` is what was written to somebody else's public map.
  //
  // `lmxId` on a listing event is the location_machine_xref id at event time.
  // `listed`/`unlisted` are operator-token writes to pinballmap.com.
  // `abandoned` fires when a local edit walks away from a still-live entry
  // (PP-l81u) — a retitle, marking the machine uncataloged, or clearing the
  // link, all while intent was On. The entry stays on Pinball Map and `lmxId`
  // is the handle recorded for it; unlike `unlisted`, nothing was written
  // there.
  //
  // `linked`, `reconnected` and `accepted_removal` are RETIRED (PP-o355.21) and
  // kept only so historical rows still render: `linked`/`reconnected` were
  // auto-link's captures, which spec 5.1 forbids outright, and
  // `accepted_removal` was the Accept button, whose job the intent toggle now
  // does directly. Nothing writes them any more.
  | {
      kind: "pinballmap_intent";
      intent: "on" | "off" | "no_sync";
    }
  | {
      kind: "pinballmap_listing";
      action:
        | "listed"
        | "unlisted"
        | "linked"
        | "reconnected"
        | "abandoned"
        | "accepted_removal";
      lmxId: number | null;
    }
  // === sourceType='issue' (duplicate-written from issue actions) ===
  | {
      kind: "issue_opened";
      issueId: string;
      issueNumber: number;
      // The reporter is normally a `reporter` person-reference in
      // `timeline_event_people` (real or invited) resolved live. A freeform
      // guest reporter (typed name + email, no account, no id to reference)
      // has no resolvable identity, so their typed name is kept here as an
      // immutable historical value and rendered with a "(guest)" marker.
      // Absent on identity-backed opens; absent + no reporter row = anonymous.
      guestReporterName?: string;
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
      // Assignee is an `assignee` person-reference (always a real user —
      // `issues.assigned_to` FKs user_profiles only), resolved live.
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
      // Machine name resolved live from this id at render (PP-tv9l) so a
      // renamed machine updates everywhere — no snapshotted name.
      toMachineId: string;
      title?: string;
    }
  | {
      kind: "issue_reassigned_in";
      issueId: string;
      issueNumber: number;
      fromMachineId: string;
      title?: string;
    };

export type MachineTimelineEventKind = MachineTimelineEventData["kind"];

/** The `source_type='issue'` event kinds (rendered by MachineTimelineIssueRow). */
export type MachineIssueEventKind =
  | "issue_opened"
  | "issue_closed"
  | "issue_status_changed"
  | "issue_assigned"
  | "issue_unassigned"
  | "issue_reassigned_out"
  | "issue_reassigned_in";

/** Issue-side event variants. */
export type MachineIssueEventData = Extract<
  MachineTimelineEventData,
  { kind: MachineIssueEventKind }
>;

/** Lifecycle event variants (rendered by MachineTimelineSystemRow). */
export type MachineLifecycleEventData = Exclude<
  MachineTimelineEventData,
  { kind: MachineIssueEventKind }
>;

/**
 * Type predicate: narrow MachineTimelineEventData to the issue-side variants.
 *
 * Explicit case list (instead of `kind.startsWith("issue_")`) keeps the
 * discriminated-union narrowing intact — `Extract<>` over a template literal
 * doesn't always narrow as TS users expect. Adding a new issue kind requires
 * updating this list AND `MachineIssueEventKind` above; both are in this file
 * so they stay in lockstep.
 */
export function isMachineIssueEvent(
  data: MachineTimelineEventData
): data is MachineIssueEventData {
  switch (data.kind) {
    case "issue_opened":
    case "issue_closed":
    case "issue_status_changed":
    case "issue_assigned":
    case "issue_unassigned":
    case "issue_reassigned_out":
    case "issue_reassigned_in":
      return true;
    default:
      return false;
  }
}
