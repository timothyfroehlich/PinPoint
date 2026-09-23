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

export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];
