export type IssueSeverity = "cosmetic" | "minor" | "major" | "unplayable";
export type IssueConsistency = "intermittent" | "frequent" | "constant";
export type IssueStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "need_parts"
  | "need_help"
  | "wait_owner"
  | "fixed"
  | "wont_fix"
  | "wai"
  | "no_repro"
  | "duplicate";

export interface SheetRow {
  timestamp: string;
  email: string;
  game: string;
  pinpointId?: string;
  severity: string;
  consistency: string;
  fixStatus: string;
  description: string;
  workLog: string;
  lastSynced?: string;
  rowIndex: number;
}

export interface SyncIssue {
  id: string | undefined;
  machineInitials: string;
  title: string;
  description: string;
  status: IssueStatus;
  severity: IssueSeverity;
  consistency: IssueConsistency;
  reporterEmail: string;
  updatedAt: Date;
  createdAt: Date;
}
