import {
  Circle,
  CircleHelp,
  CircleDot,
  Disc,
  AlertTriangle,
  TrendingUp,
  Repeat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";
import type { IssueStatus } from "~/lib/issues/status-values";

export {
  ISSUE_STATUS_VALUES,
  type IssueStatus,
} from "~/lib/issues/status-values";

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
    /** Solid fill for a Summary Widget bar segment (widgets spec §5.3). */
    barColor: string;
    icon: LucideIcon;
  }
> = {
  new: {
    label: "New",
    description: "Just reported, needs triage",
    styles: "bg-status-new/15 text-status-new border-status-new/45",
    iconColor: "text-status-new",
    barColor: "bg-status-new-bar",
    icon: Circle,
  },
  confirmed: {
    label: "Confirmed",
    description: "Verified as a actual issue",
    styles:
      "bg-status-confirmed/15 text-status-confirmed border-status-confirmed/45",
    iconColor: "text-status-confirmed",
    barColor: "bg-status-confirmed-bar",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    description: "Active repair underway",
    styles:
      "bg-status-in-progress/15 text-status-in-progress border-status-in-progress/45",
    iconColor: "text-status-in-progress",
    barColor: "bg-status-in-progress",
    icon: CircleDot,
  },
  need_parts: {
    label: "Need Parts",
    description: "Waiting on new parts",
    styles:
      "bg-status-need-parts/15 text-status-need-parts border-status-need-parts/45",
    iconColor: "text-status-need-parts",
    barColor: "bg-status-need-parts-bar",
    icon: CircleDot,
  },
  need_help: {
    label: "Need Help",
    description: "Escalated to expert help",
    styles:
      "bg-status-need-help/15 text-status-need-help border-status-need-help/45",
    iconColor: "text-status-need-help",
    barColor: "bg-status-need-help-bar",
    icon: CircleDot,
  },
  wait_owner: {
    label: "Pending Owner",
    description: "Pending owner decision/action",
    styles:
      "bg-status-wait-owner/15 text-status-wait-owner border-status-wait-owner/45",
    iconColor: "text-status-wait-owner",
    barColor: "bg-status-wait-owner",
    icon: CircleDot,
  },
  fixed: {
    label: "Fixed",
    description: "Issue is resolved",
    styles: "bg-status-fixed/15 text-status-fixed border-status-fixed/45",
    iconColor: "text-status-fixed",
    barColor: "bg-status-fixed",
    icon: Disc,
  },
  wai: {
    label: "As Intended",
    description: "Working as intended, no action required",
    styles: "bg-status-wai/15 text-status-wai border-status-wai/45",
    iconColor: "text-status-wai",
    barColor: "bg-status-wai",
    icon: Disc,
  },
  wont_fix: {
    label: "Won't Fix",
    description: "Issue can't or won't be fixed",
    styles:
      "bg-status-wont-fix/15 text-status-wont-fix border-status-wont-fix/45",
    iconColor: "text-status-wont-fix",
    barColor: "bg-status-wont-fix",
    icon: Disc,
  },
  no_repro: {
    label: "No Repro",
    description: "Couldn't reproduce",
    styles:
      "bg-status-no-repro/15 text-status-no-repro border-status-no-repro/45",
    iconColor: "text-status-no-repro",
    barColor: "bg-status-no-repro",
    icon: Disc,
  },
  duplicate: {
    label: "Duplicate",
    description: "Already reported elsewhere",
    styles:
      "bg-status-duplicate/15 text-status-duplicate border-status-duplicate/45",
    iconColor: "text-status-duplicate",
    barColor: "bg-status-duplicate",
    icon: Disc,
  },
};

export const SEVERITY_CONFIG: Record<
  IssueSeverity,
  {
    label: string;
    styles: string;
    iconColor: string;
    /** Solid fill for a Summary Widget bar segment (widgets spec §5.3). */
    barColor: string;
    icon: LucideIcon;
  }
> = {
  cosmetic: {
    label: "Cosmetic",
    styles:
      "bg-severity-cosmetic/15 text-severity-cosmetic border-severity-cosmetic/45",
    iconColor: "text-severity-cosmetic",
    barColor: "bg-severity-cosmetic-bar",
    icon: AlertTriangle,
  },
  minor: {
    label: "Minor",
    styles: "bg-severity-minor/15 text-severity-minor border-severity-minor/45",
    iconColor: "text-severity-minor",
    barColor: "bg-severity-minor-bar",
    icon: AlertTriangle,
  },
  major: {
    label: "Major",
    styles: "bg-severity-major/15 text-severity-major border-severity-major/45",
    iconColor: "text-severity-major",
    barColor: "bg-severity-major-bar",
    icon: AlertTriangle,
  },
  unplayable: {
    label: "Unplayable",
    styles:
      "bg-severity-unplayable/15 text-severity-unplayable border-severity-unplayable/45",
    iconColor: "text-severity-unplayable",
    barColor: "bg-severity-unplayable-bar",
    icon: AlertTriangle,
  },
};

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  {
    label: string;
    styles: string;
    iconColor: string;
    /** Solid fill for a Summary Widget bar segment (widgets spec §5.3). */
    barColor: string;
    icon: LucideIcon;
  }
> = {
  low: {
    label: "Low",
    styles: "bg-priority-low/15 text-priority-low border-priority-low/45",
    iconColor: "text-priority-low",
    barColor: "bg-priority-low-bar",
    icon: TrendingUp,
  },
  medium: {
    label: "Medium",
    styles:
      "bg-priority-medium/15 text-priority-medium border-priority-medium/45",
    iconColor: "text-priority-medium",
    barColor: "bg-priority-medium-bar",
    icon: TrendingUp,
  },
  high: {
    label: "High",
    styles: "bg-priority-high/15 text-priority-high border-priority-high/45",
    iconColor: "text-priority-high",
    barColor: "bg-priority-high-bar",
    icon: TrendingUp,
  },
};

export const FREQUENCY_CONFIG: Record<
  IssueFrequency,
  { label: string; styles: string; iconColor: string; icon: LucideIcon }
> = {
  not_specified: {
    label: "Not specified",
    styles:
      "bg-frequency-not-specified/15 text-frequency-not-specified border-frequency-not-specified/45",
    iconColor: "text-frequency-not-specified",
    icon: CircleHelp,
  },
  intermittent: {
    label: "Intermittent",
    styles:
      "bg-frequency-intermittent/15 text-frequency-intermittent border-frequency-intermittent/45",
    iconColor: "text-frequency-intermittent",
    icon: Repeat,
  },
  frequent: {
    label: "Frequent",
    styles:
      "bg-frequency-frequent/15 text-frequency-frequent border-frequency-frequent/45",
    iconColor: "text-frequency-frequent",
    icon: Repeat,
  },
  constant: {
    label: "Constant",
    styles:
      "bg-frequency-constant/15 text-frequency-constant border-frequency-constant/45",
    iconColor: "text-frequency-constant",
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
  not_specified: FREQUENCY_CONFIG.not_specified.styles,
  intermittent: FREQUENCY_CONFIG.intermittent.styles,
  frequent: FREQUENCY_CONFIG.frequent.styles,
  constant: FREQUENCY_CONFIG.constant.styles,
};

export const ISSUE_FIELD_ICONS = {
  severity: AlertTriangle,
  priority: TrendingUp,
  frequency: Repeat,
};
