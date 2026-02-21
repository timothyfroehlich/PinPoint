export type UserRole = "guest" | "member" | "technician" | "admin";

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
 * 2. Technicians can update any issue.
 * 3. Machine owners can update issues on their machines.
 * 4. Reporters can update their own issues.
 * 5. Assignees can update issues assigned to them.
 */
export function canUpdateIssue(
  user: PermissionUser,
  issue: IssueContext,
  machine: MachineContext
): boolean {
  if (user.role === "admin" || user.role === "technician") return true;
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
 * 2. Technicians can edit any issue title.
 * 3. Members can edit any issue title.
 * 4. Issue creators (including guests) can edit titles of issues they created.
 * 5. Guests cannot edit other users' issue titles.
 */
export function canEditIssueTitle(
  user: PermissionUser,
  issue: IssueContext
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "technician") return true;
  if (user.role === "member") return true;
  if (issue.reportedBy === user.id) return true;
  return false;
}
