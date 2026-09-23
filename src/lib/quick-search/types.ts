import type { IssueStatus } from "~/lib/issues/status";

export interface QuickSearchMachineResult {
  id: string;
  initials: string;
  name: string;
  modelName: string | null;
}

export interface QuickSearchIssueResult {
  id: string;
  issueNumber: number;
  machineInitials: string;
  machineName: string;
  status: IssueStatus;
  title: string;
}

export interface QuickSearchResults {
  machines: QuickSearchMachineResult[];
  issues: QuickSearchIssueResult[];
}
