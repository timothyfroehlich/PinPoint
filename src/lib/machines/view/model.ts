import { intervalToDuration } from "date-fns";
import type {
  IssueSeverity,
  MachineViewHealth,
  MachineViewRow,
  MachineViewState,
} from "~/lib/types";
import { MACHINE_PRESENCE_RANK } from "~/lib/machines/presence";
import {
  MACHINE_STATUS_RANK,
  SEVERITY_RANK,
  type MachineStatus,
} from "~/lib/machines/status";

export interface MachineViewCandidate extends MachineViewRow {
  canonicalModelName: string;
  legacyModelName: string;
}

const ISSUE_SEVERITIES: IssueSeverity[] = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
];

const COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function healthFromSeverityCounts(input: {
  cosmetic: number;
  minor: number;
  major: number;
  unplayable: number;
  oldestOpenIssueAt: Date | null;
}): MachineViewHealth {
  const bySeverity: Record<IssueSeverity, number> = {
    cosmetic: input.cosmetic,
    minor: input.minor,
    major: input.major,
    unplayable: input.unplayable,
  };
  const worstSeverity = ISSUE_SEVERITIES.reduce<IssueSeverity | null>(
    (worst, severity) => {
      if (bySeverity[severity] === 0) return worst;
      if (worst === null || SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
        return severity;
      }
      return worst;
    },
    null
  );
  let playability: MachineStatus = "operational";
  if (input.unplayable > 0) playability = "unplayable";
  else if (input.major > 0) playability = "needs_service";

  return {
    openIssues: Object.values(bySeverity).reduce(
      (total, count) => total + count,
      0
    ),
    bySeverity,
    worstSeverity,
    oldestOpenIssueAt: input.oldestOpenIssueAt?.toISOString() ?? null,
    playability,
  };
}

function searchableText(row: MachineViewCandidate): string {
  return [
    row.title,
    row.initials,
    row.manufacturer,
    row.canonicalModelName,
    row.legacyModelName,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function dateValue(value: string | null | undefined): number | null {
  return value == null ? null : new Date(value).getTime();
}

function compareNullable(
  left: number | string | null,
  right: number | string | null,
  direction: MachineViewState["dir"]
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  let comparison: number;
  if (typeof left === "string" && typeof right === "string") {
    comparison = COLLATOR.compare(left, right);
  } else {
    comparison = Number(left) - Number(right);
  }
  return direction === "asc" ? comparison : -comparison;
}

function compareIdentity(
  left: MachineViewCandidate,
  right: MachineViewCandidate
): number {
  const titleComparison = COLLATOR.compare(left.title, right.title);
  return titleComparison !== 0
    ? titleComparison
    : COLLATOR.compare(left.initials, right.initials);
}

function compareRows(
  left: MachineViewCandidate,
  right: MachineViewCandidate,
  state: MachineViewState
): number {
  let comparison = 0;
  switch (state.sort) {
    case "machine":
      comparison = COLLATOR.compare(left.title, right.title);
      break;
    case "playability":
      comparison =
        MACHINE_STATUS_RANK[left.health?.playability ?? "operational"] -
        MACHINE_STATUS_RANK[right.health?.playability ?? "operational"];
      break;
    case "openIssues":
      comparison =
        (left.health?.openIssues ?? 0) - (right.health?.openIssues ?? 0);
      break;
    case "lastServiced":
      comparison = compareNullable(
        dateValue(left.lastServicedAt),
        dateValue(right.lastServicedAt),
        state.dir
      );
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "presence":
      comparison =
        MACHINE_PRESENCE_RANK[left.presence] -
        MACHINE_PRESENCE_RANK[right.presence];
      break;
    case "owner":
      comparison = compareNullable(left.ownerName, right.ownerName, state.dir);
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "manufacturer":
      comparison = compareNullable(
        left.manufacturer,
        right.manufacturer,
        state.dir
      );
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "year":
      comparison = compareNullable(left.year, right.year, state.dir);
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "oldestOpenIssue":
      comparison = compareNullable(
        dateValue(left.health?.oldestOpenIssueAt),
        dateValue(right.health?.oldestOpenIssueAt),
        state.dir
      );
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "lastActivity":
      comparison = compareNullable(
        dateValue(left.lastActivityAt),
        dateValue(right.lastActivityAt),
        state.dir
      );
      return comparison !== 0 ? comparison : compareIdentity(left, right);
    case "dateAdded":
      comparison = compareNullable(
        dateValue(left.createdAt),
        dateValue(right.createdAt),
        state.dir
      );
      return comparison !== 0 ? comparison : compareIdentity(left, right);
  }

  if (comparison !== 0) return state.dir === "asc" ? comparison : -comparison;
  return compareIdentity(left, right);
}

export function applyMachineViewState(
  rows: MachineViewCandidate[],
  state: MachineViewState
): { rows: MachineViewCandidate[]; totalCount: number; page: number } {
  const query = state.q.toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (query && !searchableText(row).includes(query)) return false;
    if (state.presence !== "all" && !state.presence.includes(row.presence)) {
      return false;
    }
    if (
      state.status.length > 0 &&
      !state.status.includes(row.health?.playability ?? "operational")
    ) {
      return false;
    }
    if (state.owner.length > 0) {
      const ownerKey = row.ownerId ?? "unassigned";
      if (!state.owner.includes(ownerKey)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((left, right) =>
    compareRows(left, right, state)
  );
  const maxPage = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  const page = Math.min(state.page, maxPage);
  const offset = (page - 1) * state.pageSize;

  return {
    rows: sorted.slice(offset, offset + state.pageSize),
    totalCount: sorted.length,
    page,
  };
}

export function formatCompactAgeAgo(
  value: Date | string,
  now: Date = new Date()
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (date.getTime() > now.getTime()) return "today";
  const {
    years = 0,
    months = 0,
    days = 0,
  } = intervalToDuration({
    start: date,
    end: now,
  });
  if (years > 0)
    return months > 0 ? `${years}y ${months}mo ago` : `${years}y ago`;
  if (months > 0)
    return days > 0 ? `${months}mo ${days}d ago` : `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  return "today";
}
