import {
  Circle,
  CircleDot,
  Disc,
  AlertTriangle,
  TrendingUp,
  Repeat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  IssueSeverity,
  IssuePriority,
  IssueConsistency,
} from "~/lib/types";

/**
 * Single Source of Truth for Issue Status Values
 * Based on _issue-status-redesign/README.md - Final design with 11 statuses
 *
 * All status-related code imports from this file to ensure consistency.
 * Database schema, Zod validation, queries, and UI filters all derive from these constants.
 */

// Named constants for type-safe access
export const ISSUE_STATUSES = {
  // New group (2)
  NEW: "new",
  CONFIRMED: "confirmed",

  // In Progress group (4)
  WAITING_ON_OWNER: "waiting_on_owner",
  IN_PROGRESS: "in_progress",
  NEEDS_PARTS: "needs_parts",
  NEEDS_EXPERT: "needs_expert",

  // Closed group (5)
  FIXED: "fixed",
  WONT_FIX: "wont_fix",
  WORKS_AS_INTENDED: "works_as_intended",
  NOT_REPRODUCIBLE: "not_reproducible",
  DUPLICATE: "duplicate",
} as const;

// Array of all valid statuses (for runtime validation)
export const ALL_ISSUE_STATUSES = Object.values(ISSUE_STATUSES);

// Type-safe array with specific literal types (for TypeScript and Drizzle)
export const ISSUE_STATUS_VALUES = [
  "new",
  "confirmed",
  "waiting_on_owner",
  "in_progress",
  "needs_parts",
  "needs_expert",
  "fixed",
  "wont_fix",
  "works_as_intended",
  "not_reproducible",
  "duplicate",
] as const;

// Derive the type from the array (this is the canonical IssueStatus type)
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];

// Status groups (using constants)
export const STATUS_GROUPS = {
  new: [ISSUE_STATUSES.NEW, ISSUE_STATUSES.CONFIRMED],
  in_progress: [
    ISSUE_STATUSES.WAITING_ON_OWNER,
    ISSUE_STATUSES.IN_PROGRESS,
    ISSUE_STATUSES.NEEDS_PARTS,
    ISSUE_STATUSES.NEEDS_EXPERT,
  ],
  closed: [
    ISSUE_STATUSES.FIXED,
    ISSUE_STATUSES.WONT_FIX,
    ISSUE_STATUSES.WORKS_AS_INTENDED,
    ISSUE_STATUSES.NOT_REPRODUCIBLE,
    ISSUE_STATUSES.DUPLICATE,
  ],
} as const;

// Single-level exports for better re-use
export const NEW_STATUSES = STATUS_GROUPS.new;
export const IN_PROGRESS_STATUSES = STATUS_GROUPS.in_progress;
export const CLOSED_STATUSES = STATUS_GROUPS.closed;
export const OPEN_STATUS_GROUPS = ["new", "in_progress"] as const;

// Convenience exports for common groupings
export const OPEN_STATUSES = [
  ...STATUS_GROUPS.new,
  ...STATUS_GROUPS.in_progress,
] as const;

export const ALL_STATUS_OPTIONS: IssueStatus[] = [
  ...STATUS_GROUPS.new,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
];

export const STATUS_OPTIONS = ALL_STATUS_OPTIONS; // Alias for form use

export function getIssueStatusIcon(status: IssueStatus): LucideIcon {
  if ((NEW_STATUSES as readonly string[]).includes(status)) return Circle;
  if ((IN_PROGRESS_STATUSES as readonly string[]).includes(status))
    return CircleDot;
  return Disc;
}

export function getIssueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    new: "New",
    confirmed: "Confirmed",
    waiting_on_owner: "Waiting on Owner",
    in_progress: "Work in Progress",
    needs_parts: "Needs Parts",
    needs_expert: "Needs Expert Help",
    fixed: "Fixed",
    wont_fix: "Won't Fix",
    works_as_intended: "Works as Intended",
    not_reproducible: "Not Reproducible",
    duplicate: "Duplicate",
  };
  return labels[status];
}

export const STATUS_STYLES: Record<IssueStatus, string> = {
  // New group - Cyan
  new: "bg-cyan-500/20 text-cyan-400 border-cyan-500",
  confirmed: "bg-teal-500/20 text-teal-400 border-teal-500",
  // In Progress group - Purple/Fuchsia
  waiting_on_owner: "bg-purple-500/20 text-purple-400 border-purple-500",
  in_progress: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500",
  needs_parts: "bg-purple-600/20 text-purple-300 border-purple-600",
  needs_expert: "bg-pink-500/20 text-pink-400 border-pink-500",
  // Closed group - Green/Gray
  fixed: "bg-green-500/20 text-green-400 border-green-500",
  works_as_intended: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
  wont_fix: "bg-zinc-500/20 text-zinc-400 border-zinc-500",
  not_reproducible: "bg-slate-500/20 text-slate-400 border-slate-500",
  duplicate: "bg-neutral-600/20 text-neutral-400 border-neutral-600",
};

export const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  cosmetic: "bg-amber-100/15 text-amber-200 border-amber-500/30",
  minor: "bg-amber-300/20 text-amber-300 border-amber-500/50",
  major: "bg-amber-500/25 text-amber-400 border-amber-500/70",
  unplayable: "bg-amber-600/30 text-amber-500 border-amber-600",
};

export const PRIORITY_STYLES: Record<IssuePriority, string> = {
  low: "bg-purple-950/40 text-purple-500 border-purple-500/30",
  medium: "bg-purple-900/40 text-purple-300 border-purple-500/50",
  high: "bg-purple-500/20 text-purple-100 border-purple-500/70",
};

export function getIssueSeverityLabel(severity: IssueSeverity): string {
  const labels: Record<IssueSeverity, string> = {
    cosmetic: "Cosmetic",
    minor: "Minor",
    major: "Major",
    unplayable: "Unplayable",
  };
  return labels[severity];
}

export function getIssuePriorityLabel(priority: IssuePriority): string {
  const labels: Record<IssuePriority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  return labels[priority];
}

export function getIssueConsistencyLabel(
  consistency: IssueConsistency
): string {
  const labels: Record<IssueConsistency, string> = {
    intermittent: "Intermittent",
    frequent: "Frequent",
    constant: "Constant",
  };
  return labels[consistency];
}

export function getIssueSeverityStyles(severity: IssueSeverity): string {
  return SEVERITY_STYLES[severity];
}

export function getIssuePriorityStyles(priority: IssuePriority): string {
  return PRIORITY_STYLES[priority];
}

export function getIssueConsistencyStyles(
  consistency: IssueConsistency
): string {
  return CONSISTENCY_STYLES[consistency];
}

export const CONSISTENCY_STYLES: Record<IssueConsistency, string> = {
  intermittent: "bg-cyan-950/40 text-cyan-500 border-cyan-500/30",
  frequent: "bg-cyan-900/40 text-cyan-300 border-cyan-500/50",
  constant: "bg-cyan-500/20 text-cyan-100 border-cyan-500/70",
};

export const ISSUE_FIELD_ICONS = {
  severity: AlertTriangle,
  priority: TrendingUp,
  consistency: Repeat,
};
