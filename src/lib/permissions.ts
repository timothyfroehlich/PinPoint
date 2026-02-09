export type UserRole = "guest" | "member" | "admin";

interface PermissionUser {
  id: string;
  role: UserRole;
}

interface IssueContext {
  reportedBy: string | null;
  assignedTo: string | null;
}

interface MachineContext {
  ownerId: string | null;
}

/**
 * Checks if a user has permission to update an issue.
 *
 * Rules:
 * 1. Admins can update any issue.
 * 2. Machine owners can update issues on their machines.
 * 3. Reporters can update their own issues.
 * 4. Assignees can update issues assigned to them.
 */
export function canUpdateIssue(
  user: PermissionUser,
  issue: IssueContext,
  machine: MachineContext
): boolean {
  if (user.role === "admin") return true;
  if (machine.ownerId === user.id) return true;
  if (issue.reportedBy === user.id) return true;
  if (issue.assignedTo === user.id) return true;
  return false;
}

/**
 * Checks if a user has permission to edit an issue title.
 *
 * Rules:
 * 1. Admins can edit any issue title.
 * 2. Members can edit any issue title.
 * 3. Issue creators (including guests) can edit titles of issues they created.
 * 4. Guests cannot edit other users' issue titles.
 */
export function canEditIssueTitle(
  user: PermissionUser,
  issue: IssueContext
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "member") return true;
  if (issue.reportedBy === user.id) return true;
  return false;
}
