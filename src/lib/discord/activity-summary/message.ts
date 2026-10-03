import {
  DISCORD_MAX_MESSAGE_LENGTH,
  sanitizeDiscordText,
  truncateDiscordLabel,
} from "~/lib/discord/messages";
import {
  getIssueSeverityLabel,
  getIssueStatusLabel,
} from "~/lib/issues/status";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import { getMachineStatusLabel } from "~/lib/machines/status";
import { buildResourceUrl } from "~/lib/notifications/resource-url";
import {
  hasActivity,
  machineChangeCount,
  type MachineEntry,
  type SummaryModel,
  type SummaryRow,
} from "./model";
import { formatSummaryPeriod } from "./schedule";

/**
 * Discord copy for the activity summary (discord-activity-summary spec §6,
 * §7). Pure formatting, no IO — the schedule, claim, and send live in
 * `./runner`. The approved copy is recorded on bead PP-ogup.
 *
 * Plain text with link previews suppressed: the caller sends the
 * suppress-embeds flag, and every link is also wrapped `<…>` (§6.9). Every
 * issue title, machine name, and person name passes through
 * `sanitizeDiscordText`, and the client sends `allowed_mentions: []`, so the
 * summary never pings anyone (§6.10, §6.11).
 */

/** Most rows a machine block lists (§7.4). */
export const MACHINE_BLOCK_MAX_ROWS = 10;
/** Most messages one summary posts (§7.5). */
export const SUMMARY_MAX_MESSAGES = 2;

const MAX_TITLE_CODE_POINTS = 100;
const MAX_NAME_CODE_POINTS = 80;

const DAILY_HEADING = "**PinPoint daily summary**";
const UPDATE_HEADING = "**PinPoint update**";
/** A period this long reads as a day, including the 23- and 25-hour DST days. */
const DAILY_PERIOD_MS = 23 * 60 * 60 * 1000;

const SECTION_HEADINGS = {
  needsAttention: "### 🔴 Needs attention",
  backInService: "### 🟢 Back in service",
  otherChanges: "### ⚪ Other changes",
  newMachines: "### 📦 New machines",
  newMembers: "### 👤 New members",
} as const;

// ─── Text helpers ─────────────────────────────────────────────────────

function text(value: string, maxCodePoints: number): string {
  return sanitizeDiscordText(truncateDiscordLabel(value, maxCodePoints));
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function machineLink(
  siteUrl: string,
  machine: { initials: string; name: string }
): string {
  const url = buildResourceUrl({
    siteUrl,
    resourceType: "machine",
    machineInitials: machine.initials,
  });
  return `[${text(machine.name, MAX_NAME_CODE_POINTS)}](<${url}>)`;
}

function issueLink(
  siteUrl: string,
  issue: { formattedId: string; title: string }
): string {
  const url = buildResourceUrl({
    siteUrl,
    resourceType: "issue",
    formattedIssueId: issue.formattedId,
  });
  return `[${issue.formattedId}](<${url}>) ${text(issue.title, MAX_TITLE_CODE_POINTS)}`;
}

// ─── Rows and machines ────────────────────────────────────────────────

const LIFECYCLE_VERB = {
  opened: "Opened",
  reopened: "Reopened",
  opened_and_closed: "Opened and closed",
  closed: "Closed",
} as const;

/**
 * One change's text. `withSuffix` is false on a single line that already
 * shows the status change the issue caused (the approved copy's "Jaws" line).
 */
function rowText(
  siteUrl: string,
  row: SummaryRow,
  withSuffix: boolean
): string {
  switch (row.kind) {
    case "opened":
    case "reopened":
    case "opened_and_closed":
    case "closed": {
      const base = `${LIFECYCLE_VERB[row.kind]} ${issueLink(siteUrl, row.issue)}`;
      if (!withSuffix) return base;
      const suffix =
        row.suffix.type === "severity"
          ? getIssueSeverityLabel(row.suffix.value)
          : getIssueStatusLabel(row.suffix.value);
      return `${base} · ${suffix}`;
    }
    case "progress":
      return `${issueLink(siteUrl, row.issue)} · moved to ${getIssueStatusLabel(row.status)}`;
    case "severity":
      return `${issueLink(siteUrl, row.issue)} · ${getIssueSeverityLabel(row.from)} → ${getIssueSeverityLabel(row.to)}`;
    case "assignment":
      return row.assigneeName === null
        ? `${issueLink(siteUrl, row.issue)} · unassigned`
        : `${issueLink(siteUrl, row.issue)} · assigned to ${text(row.assigneeName, MAX_NAME_CODE_POINTS)}`;
    case "comments":
      return `${issueLink(siteUrl, row.issue)} · ${plural(row.count, "comment", "comments")}`;
    case "owner":
      return row.ownerLabel === null
        ? "Owner removed"
        : `Owner: ${text(row.ownerLabel, MAX_NAME_CODE_POINTS)}`;
    case "pinball_map_comments":
      return plural(row.count, "Pinball Map comment", "Pinball Map comments");
  }
}

function isLifecycleRow(row: SummaryRow): boolean {
  return (
    row.kind === "opened" ||
    row.kind === "reopened" ||
    row.kind === "opened_and_closed" ||
    row.kind === "closed"
  );
}

/**
 * A machine's text: a block (§6.5) when it has two or more changes, otherwise
 * a single line (§6.6). The header names the machine and its status and
 * availability changes.
 */
export function formatMachineEntry(
  siteUrl: string,
  entry: MachineEntry,
  maxRows: number = MACHINE_BLOCK_MAX_ROWS
): string {
  const header = [
    `**${machineLink(siteUrl, entry.machine)}**`,
    ...(entry.statusChange
      ? [
          `${getMachineStatusLabel(entry.statusChange.from)} → ${getMachineStatusLabel(entry.statusChange.to)}`,
        ]
      : []),
    ...(entry.availabilityChange
      ? [
          `${getMachinePresenceLabel(entry.availabilityChange.from)} → ${getMachinePresenceLabel(entry.availabilityChange.to)}`,
        ]
      : []),
  ].join(" · ");

  if (machineChangeCount(entry) < 2) {
    const [row] = entry.rows;
    if (row === undefined) return header;
    const withSuffix = !(entry.statusChange !== null && isLifecycleRow(row));
    return `${header} · ${rowText(siteUrl, row, withSuffix)}`;
  }

  const shown = entry.rows.slice(0, maxRows);
  const more = entry.rows.length - shown.length;
  return [
    header,
    ...shown.map((row) => `- ${rowText(siteUrl, row, true)}`),
    ...(more > 0 ? [`- … and ${String(more)} more`] : []),
  ].join("\n");
}

// ─── Composition and splitting ────────────────────────────────────────

interface SectionItem {
  text: string;
  /** Machines this item names, for the "… and N more machines" count (§7.5). */
  machineIds: readonly string[];
}

interface Section {
  heading: string | null;
  items: SectionItem[];
}

function headingLines(
  model: SummaryModel,
  period: { start: Date; end: Date }
): string {
  const heading =
    period.end.getTime() - period.start.getTime() >= DAILY_PERIOD_MS
      ? DAILY_HEADING
      : UPDATE_HEADING;
  const counts = [
    ...(model.counts.opened > 0
      ? [`${String(model.counts.opened)} opened`]
      : []),
    ...(model.counts.closed > 0
      ? [`${String(model.counts.closed)} closed`]
      : []),
    ...(model.counts.machinesAdded > 0
      ? [plural(model.counts.machinesAdded, "machine added", "machines added")]
      : []),
  ];
  return [
    heading,
    [formatSummaryPeriod(period.start, period.end), ...counts].join(" · "),
  ].join("\n");
}

/** Room one item may take, leaving space for the summary and section headings. */
const MAX_ITEM_LENGTH = DISCORD_MAX_MESSAGE_LENGTH - 300;

/**
 * A machine's text, listing fewer rows when long titles would push its block
 * past one message — a block is never split (§7.2).
 */
function fittedMachineEntry(siteUrl: string, entry: MachineEntry): string {
  for (let rows = MACHINE_BLOCK_MAX_ROWS; rows > 1; rows -= 1) {
    const text = formatMachineEntry(siteUrl, entry, rows);
    if (text.length <= MAX_ITEM_LENGTH) return text;
  }
  return clip(formatMachineEntry(siteUrl, entry, 1), MAX_ITEM_LENGTH);
}

function sections(
  model: SummaryModel,
  siteUrl: string,
  pinballMapSection: string | null
): Section[] {
  const machineSection = (
    heading: string,
    entries: readonly MachineEntry[]
  ): Section => ({
    heading,
    items: entries.map((entry) => ({
      text: fittedMachineEntry(siteUrl, entry),
      machineIds: [entry.machine.id],
    })),
  });

  return [
    machineSection(SECTION_HEADINGS.needsAttention, model.needsAttention),
    machineSection(SECTION_HEADINGS.backInService, model.backInService),
    machineSection(SECTION_HEADINGS.otherChanges, model.otherChanges),
    {
      heading: SECTION_HEADINGS.newMachines,
      items: model.newMachines.map((machine) => ({
        text: `- ${machineLink(siteUrl, machine)} · ${getMachinePresenceLabel(machine.presence)}`,
        machineIds: [machine.id],
      })),
    },
    // The Pinball Map section carries its own heading and is never split.
    {
      heading: null,
      items:
        pinballMapSection === null
          ? []
          : [{ text: pinballMapSection, machineIds: [] }],
    },
    {
      heading: SECTION_HEADINGS.newMembers,
      items: model.newMembers.map((name) => ({
        text: `- ${text(name, MAX_NAME_CODE_POINTS)}`,
        machineIds: [],
      })),
    },
  ].filter((section) => section.items.length > 0);
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

interface Packed {
  messages: string[];
  /** Items that did not fit, when packing stopped early. */
  omitted: SectionItem[];
}

/**
 * Pack the sections into messages (§7.1–§7.3): split between sections or
 * between machines, never inside one; only the first message carries the
 * heading. A continued section repeats its own heading. Packing stops when
 * `messageLimit` messages are full, and `lastBudget` is the room the final
 * message may use (smaller when it must end with the overflow line).
 */
function pack(
  heading: string,
  allSections: readonly Section[],
  messageLimit: number,
  lastBudget: number
): Packed {
  const messages: string[] = [];
  let current = heading;
  const budget = (): number =>
    messages.length === messageLimit - 1
      ? lastBudget
      : DISCORD_MAX_MESSAGE_LENGTH;
  const omitted: SectionItem[] = [];
  let stopped = false;

  for (const section of allSections) {
    let headingPending = section.heading !== null;
    for (const item of section.items) {
      if (stopped) {
        omitted.push(item);
        continue;
      }
      const withHeading = (body: string): string =>
        headingPending && section.heading !== null
          ? `${section.heading}\n${body}`
          : body;
      const addition = withHeading(item.text);
      if (current.length + 1 + addition.length <= budget()) {
        current = `${current}\n${addition}`;
        headingPending = false;
        continue;
      }
      // Start a new message, unless this one was the last allowed.
      if (messages.length + 1 >= messageLimit) {
        stopped = true;
        omitted.push(item);
        continue;
      }
      messages.push(current);
      const continued =
        section.heading !== null
          ? `${section.heading}\n${item.text}`
          : item.text;
      current = clip(continued, budget());
      headingPending = false;
    }
  }
  messages.push(current);
  return { messages, omitted };
}

function overflowLine(
  omitted: readonly SectionItem[],
  siteUrl: string
): string {
  const machines = new Set(omitted.flatMap((item) => item.machineIds)).size;
  // An omitted Pinball Map section or member list names no machine; say so
  // rather than letting it disappear behind a machine count.
  const otherSections = omitted.some((item) => item.machineIds.length === 0);
  const lead =
    machines === 0
      ? "… and more."
      : otherSections
        ? `… and ${plural(machines, "more machine", "more machines")}, and more.`
        : `… and ${plural(machines, "more machine", "more machines")}.`;
  return `${lead} [Open PinPoint](<${siteUrl}>)`;
}

export interface SummaryMessagesInput {
  model: SummaryModel;
  period: { start: Date; end: Date };
  siteUrl: string;
  /** The rendered Pinball Map section, or null when it does not appear. */
  pinballMapSection: string | null;
}

/** The summary's messages: at most two, each within Discord's limit (§7). */
export function formatSummaryMessages(input: SummaryMessagesInput): string[] {
  const heading = headingLines(input.model, input.period);
  const all = sections(input.model, input.siteUrl, input.pinballMapSection);

  const unbounded = pack(
    heading,
    all,
    Number.POSITIVE_INFINITY,
    DISCORD_MAX_MESSAGE_LENGTH
  );
  if (unbounded.messages.length <= SUMMARY_MAX_MESSAGES) {
    return unbounded.messages;
  }

  // Too long for two messages: the second ends with how many machines were
  // left out and a link to PinPoint (§7.5). Reserve room for that line with
  // the widest count it could carry.
  const allItems = all.flatMap((section) => section.items);
  const reserve = overflowLine(allItems, input.siteUrl).length + 1;
  const bounded = pack(
    heading,
    all,
    SUMMARY_MAX_MESSAGES,
    DISCORD_MAX_MESSAGE_LENGTH - reserve
  );
  const last = bounded.messages.length - 1;
  return bounded.messages.map((message, index) =>
    index === last
      ? `${message}\n${overflowLine(bounded.omitted, input.siteUrl)}`
      : message
  );
}

/** Send summary now's message when the period has nothing to report (§3.9). */
export function formatNothingToReportMessage(period: {
  start: Date;
  end: Date;
}): string {
  const heading =
    period.end.getTime() - period.start.getTime() >= DAILY_PERIOD_MS
      ? DAILY_HEADING
      : UPDATE_HEADING;
  return [
    heading,
    formatSummaryPeriod(period.start, period.end),
    "Nothing to report.",
  ].join("\n");
}

export interface PlanSummaryInput {
  model: SummaryModel;
  period: { start: Date; end: Date };
  siteUrl: string;
  /** Scheduled posts stay quiet when nothing changed; Send summary now always posts. */
  trigger: "scheduled" | "manual";
  /** Pinball Map is configured and the Pinball Map sync event is on. */
  pinballMap: {
    /** The rendered section (§5.5–§5.10). */
    section: string;
    /** The rows to review changed during the period (§5.11). */
    changed: boolean;
  } | null;
}

/**
 * What one summary posts. A scheduled period with nothing to report posts
 * nothing (§3.6); the Pinball Map section causes a post only when its rows
 * changed, and appears whenever the summary posts (§5.11). Send summary now
 * always posts, saying so when there is nothing to report (§3.9).
 */
export function planSummaryMessages(input: PlanSummaryInput): string[] {
  const activity = hasActivity(input.model);
  if (
    input.trigger === "scheduled" &&
    !activity &&
    !(input.pinballMap?.changed ?? false)
  ) {
    return [];
  }
  if (!activity && input.pinballMap === null) {
    return [formatNothingToReportMessage(input.period)];
  }
  return formatSummaryMessages({
    model: input.model,
    period: input.period,
    siteUrl: input.siteUrl,
    pinballMapSection: input.pinballMap?.section ?? null,
  });
}
