import {
  Circle,
  CircleDot,
  Disc,
  AlertTriangle,
  TrendingUp,
  Repeat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";

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
  WAIT_OWNER: "wait_owner",
  IN_PROGRESS: "in_progress",
  NEED_PARTS: "need_parts",
  NEED_HELP: "need_help",

  // Closed group (5)
  FIXED: "fixed",
  WONT_FIX: "wont_fix",
  WAI: "wai",
  NO_REPRO: "no_repro",
  DUPLICATE: "duplicate",
} as const;

// Array of all valid statuses (for runtime validation)
export const ALL_ISSUE_STATUSES = Object.values(ISSUE_STATUSES);

// Type-safe array with specific literal types (for TypeScript and Drizzle)
export const ISSUE_STATUS_VALUES = [
  "new",
  "confirmed",
  "in_progress",
  "need_parts",
  "need_help",
  "wait_owner",
  "fixed",
  "wont_fix",
  "wai",
  "no_repro",
  "duplicate",
] as const;

// Derive the type from the array (this is the canonical IssueStatus type)
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];

// Shared styling constants
export const ISSUE_BADGE_WIDTH = "w-[120px]";
export const ISSUE_BADGE_MIN_WIDTH_STRIP = "min-w-[100px]";

// Status groups (using constants)
export const STATUS_GROUPS = {
  new: [ISSUE_STATUSES.NEW, ISSUE_STATUSES.CONFIRMED],
  in_progress: [
    ISSUE_STATUSES.IN_PROGRESS,
    ISSUE_STATUSES.NEED_PARTS,
    ISSUE_STATUSES.NEED_HELP,
    ISSUE_STATUSES.WAIT_OWNER,
  ],
  closed: [
    ISSUE_STATUSES.FIXED,
    ISSUE_STATUSES.WONT_FIX,
    ISSUE_STATUSES.WAI,
    ISSUE_STATUSES.NO_REPRO,
    ISSUE_STATUSES.DUPLICATE,
  ],
} as const;

// Display labels for status groups (user-facing). Internal keys stay unchanged.
// "new" group displays as "Open" — the decision was made for Phase 2 label consistency.
export const STATUS_GROUP_LABELS: Record<keyof typeof STATUS_GROUPS, string> = {
  new: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

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

/**
 * Field Configuration: One place to rule them all.
 * Contains labels, descriptions, icons, and styles for all issue metadata.
 */

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    label: string;
    description: string;
    styles: string;
    iconColor: string;
    icon: LucideIcon;
  }
> = {
  new: {
    label: "New",
    description: "Just reported, needs triage",
    styles: "bg-cyan-500/20 text-cyan-400 border-cyan-500",
    iconColor: "text-cyan-400",
    icon: Circle,
  },
  confirmed: {
    label: "Confirmed",
    description: "Verified as a actual issue",
    styles: "bg-teal-500/20 text-teal-400 border-teal-500",
    iconColor: "text-teal-400",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    description: "Active repair underway",
    styles: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500",
    iconColor: "text-fuchsia-400",
    icon: CircleDot,
  },
  need_parts: {
    label: "Need Parts",
    description: "Waiting on new parts",
    styles: "bg-purple-600/20 text-purple-300 border-purple-600",
    iconColor: "text-purple-300",
    icon: CircleDot,
  },
  need_help: {
    label: "Need Help",
    description: "Escalated to expert help",
    styles: "bg-pink-500/20 text-pink-400 border-pink-500",
    iconColor: "text-pink-400",
    icon: CircleDot,
  },
  wait_owner: {
    label: "Pending Owner",
    description: "Pending owner decision/action",
    styles: "bg-purple-500/20 text-purple-400 border-purple-500",
    iconColor: "text-purple-400",
    icon: CircleDot,
  },
  fixed: {
    label: "Fixed",
    description: "Issue is resolved",
    styles: "bg-green-500/20 text-green-400 border-green-500",
    iconColor: "text-green-400",
    icon: Disc,
  },
  wai: {
    label: "As Intended",
    description: "Working as intended, no action required",
    styles: "bg-zinc-500/20 text-zinc-400 border-zinc-500",
    iconColor: "text-zinc-400",
    icon: Disc,
  },
  wont_fix: {
    label: "Won't Fix",
    description: "Issue can't or won't be fixed",
    styles: "bg-zinc-500/20 text-zinc-400 border-zinc-500",
    iconColor: "text-zinc-400",
    icon: Disc,
  },
  no_repro: {
    label: "No Repro",
    description: "Couldn't reproduce",
    styles: "bg-slate-500/20 text-slate-400 border-slate-500",
    iconColor: "text-slate-400",
    icon: Disc,
  },
  duplicate: {
    label: "Duplicate",
    description: "Already reported elsewhere",
    styles: "bg-neutral-600/20 text-neutral-400 border-neutral-600",
    iconColor: "text-neutral-400",
    icon: Disc,
  },
};

export const SEVERITY_CONFIG: Record<
  IssueSeverity,
  { label: string; styles: string; iconColor: string; icon: LucideIcon }
> = {
  cosmetic: {
    label: "Cosmetic",
    styles: "bg-amber-200/20 text-amber-300 border-amber-500",
    iconColor: "text-amber-300",
    icon: AlertTriangle,
  },
  minor: {
    label: "Minor",
    styles: "bg-amber-400/20 text-amber-400 border-amber-500",
    iconColor: "text-amber-400",
    icon: AlertTriangle,
  },
  major: {
    label: "Major",
    styles: "bg-amber-500/20 text-amber-500 border-amber-500",
    iconColor: "text-amber-500",
    icon: AlertTriangle,
  },
  unplayable: {
    label: "Unplayable",
    styles: "bg-amber-600/20 text-amber-600 border-amber-500",
    iconColor: "text-amber-600",
    icon: AlertTriangle,
  },
};

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; styles: string; iconColor: string; icon: LucideIcon }
> = {
  low: {
    label: "Low",
    styles: "bg-purple-950/50 text-purple-600 border-purple-500",
    iconColor: "text-purple-600",
    icon: TrendingUp,
  },
  medium: {
    label: "Medium",
    styles: "bg-purple-900/50 text-purple-400 border-purple-500",
    iconColor: "text-purple-400",
    icon: TrendingUp,
  },
  high: {
    label: "High",
    styles: "bg-purple-500/20 text-purple-200 border-purple-500",
    iconColor: "text-purple-200",
    icon: TrendingUp,
  },
};

export const FREQUENCY_CONFIG: Record<
  IssueFrequency,
  { label: string; styles: string; iconColor: string; icon: LucideIcon }
> = {
  intermittent: {
    label: "Intermittent",
    styles: "bg-cyan-950/50 text-cyan-600 border-cyan-500",
    iconColor: "text-cyan-600",
    icon: Repeat,
  },
  frequent: {
    label: "Frequent",
    styles: "bg-cyan-900/50 text-cyan-400 border-cyan-500",
    iconColor: "text-cyan-400",
    icon: Repeat,
  },
  constant: {
    label: "Constant",
    styles: "bg-cyan-500/20 text-cyan-200 border-cyan-500",
    iconColor: "text-cyan-200",
    icon: Repeat,
  },
};

// Getter functions - direct config access (type-safe, no assertions needed)
export function getIssueStatusIcon(status: IssueStatus): LucideIcon {
  return STATUS_CONFIG[status].icon;
}

export function getIssueStatusLabel(status: IssueStatus): string {
  return STATUS_CONFIG[status].label;
}

export function getIssueStatusDescription(status: IssueStatus): string {
  return STATUS_CONFIG[status].description;
}

export function getIssueStatusStyles(status: IssueStatus): string {
  return STATUS_CONFIG[status].styles;
}

export function getIssueSeverityLabel(severity: IssueSeverity): string {
  return SEVERITY_CONFIG[severity].label;
}

export function getIssuePriorityLabel(priority: IssuePriority): string {
  return PRIORITY_CONFIG[priority].label;
}

export function getIssueFrequencyLabel(frequency: IssueFrequency): string {
  return FREQUENCY_CONFIG[frequency].label;
}

export function getIssueSeverityStyles(severity: IssueSeverity): string {
  return SEVERITY_CONFIG[severity].styles;
}

export function getIssuePriorityStyles(priority: IssuePriority): string {
  return PRIORITY_CONFIG[priority].styles;
}

export function getIssueFrequencyStyles(frequency: IssueFrequency): string {
  return FREQUENCY_CONFIG[frequency].styles;
}

// Manual export for component use (easier for Tim to read/change)
export const STATUS_STYLES: Record<IssueStatus, string> = {
  new: STATUS_CONFIG.new.styles,
  confirmed: STATUS_CONFIG.confirmed.styles,
  wait_owner: STATUS_CONFIG.wait_owner.styles,
  in_progress: STATUS_CONFIG.in_progress.styles,
  need_parts: STATUS_CONFIG.need_parts.styles,
  need_help: STATUS_CONFIG.need_help.styles,
  fixed: STATUS_CONFIG.fixed.styles,
  wai: STATUS_CONFIG.wai.styles,
  wont_fix: STATUS_CONFIG.wont_fix.styles,
  no_repro: STATUS_CONFIG.no_repro.styles,
  duplicate: STATUS_CONFIG.duplicate.styles,
};

export const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  cosmetic: SEVERITY_CONFIG.cosmetic.styles,
  minor: SEVERITY_CONFIG.minor.styles,
  major: SEVERITY_CONFIG.major.styles,
  unplayable: SEVERITY_CONFIG.unplayable.styles,
};

export const PRIORITY_STYLES: Record<IssuePriority, string> = {
  low: PRIORITY_CONFIG.low.styles,
  medium: PRIORITY_CONFIG.medium.styles,
  high: PRIORITY_CONFIG.high.styles,
};

export const FREQUENCY_STYLES: Record<IssueFrequency, string> = {
  intermittent: FREQUENCY_CONFIG.intermittent.styles,
  frequent: FREQUENCY_CONFIG.frequent.styles,
  constant: FREQUENCY_CONFIG.constant.styles,
};

export const ISSUE_FIELD_ICONS = {
  severity: AlertTriangle,
  priority: TrendingUp,
  frequency: Repeat,
};
