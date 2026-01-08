/**
 * Badge Preview - Shared Utilities
 *
 * Color definitions and utility functions for the new issue status system.
 * This file will become ~/lib/issues/status.ts after approval.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type IssueStatusNew = "new" | "unconfirmed" | "confirmed";
export type IssueStatusInProgress =
  | "diagnosing"
  | "diagnosed"  // Added per user feedback
  | "in_progress"
  | "needs_parts"
  | "parts_ordered"
  | "needs_expert";
export type IssueStatusClosed = "fixed" | "wont_fix" | "works_as_intended" | "not_reproducible" | "duplicate";
export type IssueStatus = IssueStatusNew | IssueStatusInProgress | IssueStatusClosed;
export type IssueStatusGroup = "new" | "in_progress" | "closed";

export type IssueSeverity = "cosmetic" | "minor" | "major" | "unplayable";
export type IssuePriority = "low" | "medium" | "high";
export type IssueConsistency = "constant" | "frequent" | "intermittent" | "unsure";

// ============================================================================
// STATUS GROUP UTILITIES
// ============================================================================

const STATUS_GROUPS: Record<IssueStatusGroup, IssueStatus[]> = {
  new: ["new", "unconfirmed", "confirmed"],
  in_progress: ["diagnosing", "diagnosed", "in_progress", "needs_parts", "parts_ordered", "needs_expert"],
  closed: ["fixed", "wont_fix", "works_as_intended", "not_reproducible", "duplicate"],
};

export function getIssueStatusGroup(status: IssueStatus): IssueStatusGroup {
  if (STATUS_GROUPS.new.includes(status)) return "new";
  if (STATUS_GROUPS.in_progress.includes(status)) return "in_progress";
  return "closed";
}

export function getStatusesForGroup(group: IssueStatusGroup): IssueStatus[] {
  return STATUS_GROUPS[group];
}

// ============================================================================
// LABELS
// ============================================================================

export function getIssueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    // New group
    new: "New",
    unconfirmed: "Unconfirmed",
    confirmed: "Confirmed",
    // In Progress group
    diagnosing: "Diagnosing",
    diagnosed: "Diagnosed",
    in_progress: "Work in Progress",
    needs_parts: "Needs Parts",
    parts_ordered: "Parts Ordered",
    needs_expert: "Needs Expert",
    // Closed group
    fixed: "Fixed",
    wont_fix: "Won't Fix",
    works_as_intended: "Works as Intended",
    not_reproducible: "Not Reproducible",
    duplicate: "Duplicate",
  };
  return labels[status];
}

export function getIssueStatusGroupLabel(group: IssueStatusGroup): string {
  const labels: Record<IssueStatusGroup, string> = {
    new: "New",
    in_progress: "In Progress",
    closed: "Closed",
  };
  return labels[group];
}

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

export function getIssueConsistencyLabel(consistency: IssueConsistency): string {
  const labels: Record<IssueConsistency, string> = {
    constant: "Constant",
    frequent: "Frequent",
    intermittent: "Intermittent",
    unsure: "Unsure",
  };
  return labels[consistency];
}

// ============================================================================
// STYLES (Tailwind classes for badges)
// ============================================================================

// Status styles - grouped by category with color variations
export function getIssueStatusStyles(status: IssueStatus): string {
  const styles: Record<IssueStatus, string> = {
    // New group - Cyan/Teal family
    new: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    unconfirmed: "bg-teal-600/20 text-teal-400 border-teal-600/50",
    confirmed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
    // In Progress group - Purple/Magenta family
    diagnosing: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    diagnosed: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    in_progress: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50",
    needs_parts: "bg-purple-600/20 text-purple-300 border-purple-600/50",
    parts_ordered: "bg-violet-600/20 text-violet-300 border-violet-600/50",
    needs_expert: "bg-pink-500/20 text-pink-400 border-pink-500/50",
    // Closed group - Gray/Muted (except fixed which is green)
    fixed: "bg-green-500/20 text-green-400 border-green-500/50",
    wont_fix: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
    works_as_intended: "bg-emerald-600/20 text-emerald-400 border-emerald-600/50",
    not_reproducible: "bg-slate-500/20 text-slate-400 border-slate-500/50",
    duplicate: "bg-neutral-600/20 text-neutral-400 border-neutral-600/50",
  };
  return styles[status];
}

export function getIssueStatusGroupStyles(group: IssueStatusGroup): string {
  const styles: Record<IssueStatusGroup, string> = {
    new: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    in_progress: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50",
    closed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
  };
  return styles[group];
}

export function getIssueSeverityStyles(severity: IssueSeverity): string {
  const styles: Record<IssueSeverity, string> = {
    cosmetic: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
    minor: "bg-sky-500/20 text-sky-400 border-sky-500/50",
    major: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    unplayable: "bg-red-500/20 text-red-400 border-red-500/50",
  };
  return styles[severity];
}

export function getIssuePriorityStyles(priority: IssuePriority): string {
  const styles: Record<IssuePriority, string> = {
    low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    high: "bg-red-500/20 text-red-400 border-red-500/50",
  };
  return styles[priority];
}

export function getIssueConsistencyStyles(consistency: IssueConsistency): string {
  const styles: Record<IssueConsistency, string> = {
    constant: "bg-red-500/20 text-red-400 border-red-500/50",
    frequent: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    intermittent: "bg-sky-500/20 text-sky-400 border-sky-500/50",
    unsure: "bg-zinc-500/20 text-zinc-400 border-zinc-500/50",
  };
  return styles[consistency];
}

// ============================================================================
// ALL VALUES (for iteration in preview pages)
// ============================================================================

export const ALL_STATUSES: IssueStatus[] = [
  "new", "unconfirmed", "confirmed",
  "diagnosing", "diagnosed", "in_progress", "needs_parts", "parts_ordered", "needs_expert",
  "fixed", "wont_fix", "works_as_intended", "not_reproducible", "duplicate",
];

export const ALL_SEVERITIES: IssueSeverity[] = ["cosmetic", "minor", "major", "unplayable"];
export const ALL_PRIORITIES: IssuePriority[] = ["low", "medium", "high"];
export const ALL_CONSISTENCIES: IssueConsistency[] = ["constant", "frequent", "intermittent", "unsure"];
export const ALL_STATUS_GROUPS: IssueStatusGroup[] = ["new", "in_progress", "closed"];
