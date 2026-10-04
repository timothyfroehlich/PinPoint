import { CLOSED_STATUSES } from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import {
  deriveMachineStatus,
  MACHINE_STATUS_RANK,
  type IssueForStatus,
  type MachineStatus,
} from "~/lib/machines/status";
import type { IssueSeverity, IssueStatus } from "~/lib/types";
import type { ActivitySummaryEventKey } from "./events";

/**
 * The activity summary's report model (discord-activity-summary spec §4–§6):
 * what a period reports, before any Discord formatting. Pure — the stored
 * history arrives already reconstructed at the period's two ends
 * (`./history`), and this decides which facts are net changes (§5.1), which
 * event types are on, and where each machine goes (§6.2, §6.7).
 */

// ─── Input: the period's history ──────────────────────────────────────

/** One issue's reportable facts at one instant. */
export interface IssueState {
  status: IssueStatus;
  severity: IssueSeverity;
  /** The machine the issue was on at that instant. */
  machineInitials: string;
  /** The assignee's name as recorded when assigned; null when unassigned. */
  assigneeName: string | null;
}

export interface IssueActivity {
  id: string;
  /** Where the issue lives now — its ID and link. */
  machineInitials: string;
  issueNumber: number;
  title: string;
  /** Null when the issue did not exist yet at the period's start. */
  atStart: IssueState | null;
  atEnd: IssueState;
  /** Comments added in the period (system events excluded). */
  commentsAdded: number;
}

/** A machine owner at one instant: a comparison key and a display label. */
export interface OwnerState {
  key: string;
  label: string;
}

export interface MachineActivity {
  id: string;
  initials: string;
  name: string;
  /** Added during the period (§5.4). */
  addedInPeriod: boolean;
  presenceAtStart: MachinePresenceStatus;
  presenceAtEnd: MachinePresenceStatus;
  ownerAtStart: OwnerState | null;
  ownerAtEnd: OwnerState | null;
  /** Pinball Map comments imported onto this machine in the period. */
  pinballMapComments: number;
}

export interface ActivityHistory {
  issues: readonly IssueActivity[];
  /** Every machine that existed at the period's end. */
  machines: readonly MachineActivity[];
  /** Names of the people who joined in the period, never emails (§6.10). */
  newMembers: readonly string[];
}

// ─── Output: the report ───────────────────────────────────────────────

export interface IssueRef {
  formattedId: string;
  initials: string;
  issueNumber: number;
  title: string;
}

export type IssueLifecycleKind =
  "opened" | "reopened" | "opened_and_closed" | "closed";

/** One change under a machine (spec §1, Change). */
export type SummaryRow =
  | {
      kind: IssueLifecycleKind;
      issue: IssueRef;
      /** Severity for opened/reopened, the closing status for closed (§5.2). */
      suffix:
        | { type: "severity"; value: IssueSeverity }
        | {
            type: "resolution";
            value: IssueStatus;
          };
    }
  | { kind: "progress"; issue: IssueRef; status: IssueStatus }
  | {
      kind: "severity";
      issue: IssueRef;
      from: IssueSeverity;
      to: IssueSeverity;
    }
  | { kind: "assignment"; issue: IssueRef; assigneeName: string | null }
  | { kind: "comments"; issue: IssueRef; count: number }
  | { kind: "owner"; ownerLabel: string | null }
  | { kind: "pinball_map_comments"; count: number };

export type MachineDirection = "worse" | "better" | "same";

export interface MachineEntry {
  machine: { id: string; initials: string; name: string };
  /** Shown only while Machine status is on and the status differs. */
  statusChange: { from: MachineStatus; to: MachineStatus } | null;
  availabilityChange: {
    from: MachinePresenceStatus;
    to: MachinePresenceStatus;
  } | null;
  rows: SummaryRow[];
  direction: MachineDirection;
}

export interface NewMachineEntry {
  id: string;
  initials: string;
  name: string;
  presence: MachinePresenceStatus;
}

export interface SummaryModel {
  /** Needs attention, Back in service, Other changes (§6.2). */
  needsAttention: MachineEntry[];
  backInService: MachineEntry[];
  otherChanges: MachineEntry[];
  newMachines: NewMachineEntry[];
  newMembers: string[];
  counts: { opened: number; closed: number; machinesAdded: number };
}

function isClosed(status: IssueStatus): boolean {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

/** A machine's change count, which decides block versus single line (§6.5, §6.6). */
export function machineChangeCount(entry: MachineEntry): number {
  return entry.rows.length + (entry.availabilityChange === null ? 0 : 1);
}

function issueRef(issue: IssueActivity): IssueRef {
  return {
    formattedId: formatIssueId(issue.machineInitials, issue.issueNumber),
    initials: issue.machineInitials,
    issueNumber: issue.issueNumber,
    title: issue.title,
  };
}

/**
 * The issue row an issue gets, if any (§5.2): opened, opened and closed,
 * reopened, or closed — judged from its state at the two ends only, so an
 * issue that closed and reopened within the period gets no row (§5.1).
 */
function lifecycleRow(
  issue: IssueActivity,
  enabled: ReadonlySet<ActivitySummaryEventKey>
): SummaryRow | null {
  const ref = issueRef(issue);
  const endClosed = isClosed(issue.atEnd.status);
  const severity = { type: "severity", value: issue.atEnd.severity } as const;
  const resolution = {
    type: "resolution",
    value: issue.atEnd.status,
  } as const;

  if (issue.atStart === null) {
    if (!endClosed) {
      return enabled.has("issues_opened")
        ? { kind: "opened", issue: ref, suffix: severity }
        : null;
    }
    return enabled.has("issues_opened") || enabled.has("issues_closed")
      ? { kind: "opened_and_closed", issue: ref, suffix: resolution }
      : null;
  }

  const startClosed = isClosed(issue.atStart.status);
  if (!startClosed && endClosed) {
    return enabled.has("issues_closed")
      ? { kind: "closed", issue: ref, suffix: resolution }
      : null;
  }
  if (startClosed && !endClosed) {
    return enabled.has("issues_opened")
      ? { kind: "reopened", issue: ref, suffix: severity }
      : null;
  }
  return null;
}

/** The extra-event rows an issue gets (§4.2), in a fixed order. */
function extraRows(
  issue: IssueActivity,
  enabled: ReadonlySet<ActivitySummaryEventKey>
): SummaryRow[] {
  const ref = issueRef(issue);
  const rows: SummaryRow[] = [];
  const { atStart, atEnd } = issue;

  // Issue progress: open at both ends, in a different open stage.
  if (
    enabled.has("issue_progress") &&
    atStart !== null &&
    !isClosed(atStart.status) &&
    !isClosed(atEnd.status) &&
    atStart.status !== atEnd.status
  ) {
    rows.push({ kind: "progress", issue: ref, status: atEnd.status });
  }

  if (
    enabled.has("severity_changes") &&
    atStart !== null &&
    atStart.severity !== atEnd.severity
  ) {
    rows.push({
      kind: "severity",
      issue: ref,
      from: atStart.severity,
      to: atEnd.severity,
    });
  }

  // A new issue starts unassigned, so one opened with an assignee reports
  // the assignment.
  if (
    enabled.has("assignments") &&
    (atStart?.assigneeName ?? null) !== atEnd.assigneeName
  ) {
    rows.push({
      kind: "assignment",
      issue: ref,
      assigneeName: atEnd.assigneeName,
    });
  }

  if (enabled.has("comment_counts") && issue.commentsAdded > 0) {
    rows.push({ kind: "comments", issue: ref, count: issue.commentsAdded });
  }
  return rows;
}

function byIssueNumber(a: SummaryRow, b: SummaryRow): number {
  const an = "issue" in a ? a.issue.issueNumber : Number.MAX_SAFE_INTEGER;
  const bn = "issue" in b ? b.issue.issueNumber : Number.MAX_SAFE_INTEGER;
  return an - bn;
}

function direction(from: MachineStatus, to: MachineStatus): MachineDirection {
  const delta = MACHINE_STATUS_RANK[to] - MACHINE_STATUS_RANK[from];
  if (delta > 0) return "worse";
  if (delta < 0) return "better";
  return "same";
}

function byMachineName(
  a: { machine: { name: string } },
  b: { machine: { name: string } }
): number {
  return a.machine.name.localeCompare(b.machine.name);
}

/** Blocks before single lines, each by machine name (§6.7). */
function orderSection(entries: MachineEntry[]): MachineEntry[] {
  const blocks = entries.filter((e) => machineChangeCount(e) >= 2);
  const singles = entries.filter((e) => machineChangeCount(e) < 2);
  return [...blocks.sort(byMachineName), ...singles.sort(byMachineName)];
}

/**
 * Build the period's report from its reconstructed history, reporting only
 * the event types switched on.
 */
export function buildSummaryModel(
  history: ActivityHistory,
  events: readonly ActivitySummaryEventKey[]
): SummaryModel {
  const enabled = new Set(events);
  const counts = { opened: 0, closed: 0, machinesAdded: 0 };

  // Issue rows go under the machine the issue was on at the period's end.
  const rowsByMachine = new Map<string, SummaryRow[]>();
  const addRow = (initials: string, row: SummaryRow): void => {
    const rows = rowsByMachine.get(initials) ?? [];
    rows.push(row);
    rowsByMachine.set(initials, rows);
  };

  for (const issue of history.issues) {
    const lifecycle = lifecycleRow(issue, enabled);
    if (lifecycle !== null) {
      addRow(issue.atEnd.machineInitials, lifecycle);
      if (lifecycle.kind !== "closed" && enabled.has("issues_opened")) {
        counts.opened += 1;
      }
      if (
        (lifecycle.kind === "closed" ||
          lifecycle.kind === "opened_and_closed") &&
        enabled.has("issues_closed")
      ) {
        counts.closed += 1;
      }
    }
  }
  const extraByMachine = new Map<string, SummaryRow[]>();
  for (const issue of history.issues) {
    const rows = extraRows(issue, enabled);
    if (rows.length === 0) continue;
    const existing = extraByMachine.get(issue.atEnd.machineInitials) ?? [];
    extraByMachine.set(issue.atEnd.machineInitials, [...existing, ...rows]);
  }

  // Machine status at each end, from the issues on it then (§5.3), with the
  // same inference PinPoint uses everywhere else.
  const issuesAt = (
    end: "atStart" | "atEnd"
  ): Map<string, IssueForStatus[]> => {
    const byMachine = new Map<string, IssueForStatus[]>();
    for (const issue of history.issues) {
      const state = issue[end];
      if (state === null) continue;
      const list = byMachine.get(state.machineInitials) ?? [];
      list.push({ status: state.status, severity: state.severity });
      byMachine.set(state.machineInitials, list);
    }
    return byMachine;
  };
  const issuesAtStart = issuesAt("atStart");
  const issuesAtEnd = issuesAt("atEnd");

  const entries: MachineEntry[] = [];
  const newMachines: NewMachineEntry[] = [];

  for (const machine of history.machines) {
    if (machine.addedInPeriod && enabled.has("new_machines")) {
      newMachines.push({
        id: machine.id,
        initials: machine.initials,
        name: machine.name,
        presence: machine.presenceAtEnd,
      });
      counts.machinesAdded += 1;
    }

    // A machine added in the period is compared against Operational and
    // gets no availability or owner row (§5.4).
    const statusFrom = machine.addedInPeriod
      ? "operational"
      : deriveMachineStatus(issuesAtStart.get(machine.initials) ?? []);
    const statusTo = deriveMachineStatus(
      issuesAtEnd.get(machine.initials) ?? []
    );
    const statusChange =
      enabled.has("machine_status") && statusFrom !== statusTo
        ? { from: statusFrom, to: statusTo }
        : null;

    const availabilityChange =
      enabled.has("availability") &&
      !machine.addedInPeriod &&
      machine.presenceAtStart !== machine.presenceAtEnd
        ? { from: machine.presenceAtStart, to: machine.presenceAtEnd }
        : null;

    const rows: SummaryRow[] = [
      // Issue rows first, then extra-event rows, each by issue number.
      ...(rowsByMachine.get(machine.initials) ?? []).sort(byIssueNumber),
      ...(extraByMachine.get(machine.initials) ?? []).sort(byIssueNumber),
    ];
    if (
      enabled.has("owner_changes") &&
      !machine.addedInPeriod &&
      (machine.ownerAtStart?.key ?? null) !== (machine.ownerAtEnd?.key ?? null)
    ) {
      rows.push({
        kind: "owner",
        ownerLabel: machine.ownerAtEnd?.label ?? null,
      });
    }
    if (enabled.has("pinball_map_comments") && machine.pinballMapComments > 0) {
      rows.push({
        kind: "pinball_map_comments",
        count: machine.pinballMapComments,
      });
    }

    if (
      rows.length === 0 &&
      statusChange === null &&
      availabilityChange === null
    ) {
      continue;
    }
    entries.push({
      machine: {
        id: machine.id,
        initials: machine.initials,
        name: machine.name,
      },
      statusChange,
      availabilityChange,
      rows,
      direction:
        statusChange === null
          ? "same"
          : direction(statusChange.from, statusChange.to),
    });
  }

  return {
    needsAttention: orderSection(
      entries.filter((e) => e.direction === "worse")
    ),
    backInService: orderSection(
      entries.filter((e) => e.direction === "better")
    ),
    otherChanges: orderSection(entries.filter((e) => e.direction === "same")),
    newMachines: newMachines.sort((a, b) => a.name.localeCompare(b.name)),
    newMembers: enabled.has("new_members")
      ? [...history.newMembers].sort((a, b) => a.localeCompare(b))
      : [],
    counts,
  };
}

/** Whether the period has anything to report besides Pinball Map (§3.6). */
export function hasActivity(model: SummaryModel): boolean {
  return (
    model.needsAttention.length > 0 ||
    model.backInService.length > 0 ||
    model.otherChanges.length > 0 ||
    model.newMachines.length > 0 ||
    model.newMembers.length > 0
  );
}
