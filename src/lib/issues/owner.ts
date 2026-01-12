import type { IssueWithAllRelations } from "~/lib/types";

/**
 * Checks if a given user ID is the machine owner
 *
 * @param issue - The issue with machine owner information
 * @param userId - The user ID to check (can be null/undefined)
 * @returns true if the user is the machine owner
 */
export function isUserMachineOwner(
  issue: IssueWithAllRelations,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;

  // Check if user is the registered owner
  if (issue.machine.owner?.id === userId) return true;

  // Check if user is the invited owner
  if (issue.machine.invitedOwner?.id === userId) return true;

  return false;
}

/**
 * Gets the machine owner's name
 *
 * @param issue - The issue with machine owner information
 * @returns The owner's name or null if no owner
 */
export function getMachineOwnerName(
  issue: IssueWithAllRelations
): string | null {
  return issue.machine.owner?.name ?? issue.machine.invitedOwner?.name ?? null;
}
