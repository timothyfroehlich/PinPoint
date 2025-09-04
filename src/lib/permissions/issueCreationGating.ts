import { PERMISSIONS } from "~/server/auth/permissions.constants";

export interface IssueCreationGatingInput {
  permissions: string[];
}

export interface IssueCreationGatingResult {
  canCreateBasic: boolean;
  canCreateFull: boolean;
  showPriority: boolean;
  showAssignee: boolean;
}

/**
 * Determines which fields to show on the issue creation form based on permissions.
 */
export function computeIssueCreationGating(
  input: IssueCreationGatingInput,
): IssueCreationGatingResult {
  const { permissions } = input;
  const has = (p: string) => permissions.includes(p);
  const canFull = has(PERMISSIONS.ISSUE_CREATE_FULL) || has(PERMISSIONS.ISSUE_CREATE);
  const canBasic = canFull || has(PERMISSIONS.ISSUE_CREATE_BASIC);
  return {
    canCreateBasic: canBasic,
    canCreateFull: canFull,
    showPriority: canFull,
    showAssignee: canFull,
  };
}
