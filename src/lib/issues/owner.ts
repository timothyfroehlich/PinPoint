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

/**
 * Gets the machine owner's ID for display purposes.
 *
 * NOTE: This returns IDs from different tables depending on the owner type:
 * - Registered owners: Returns `user_profiles.id` (from `issue.machine.owner`)
 * - Invited owners: Returns `invited_users.id` (from `issue.machine.invitedOwner`)
 *
 * These IDs are NOT interchangeable and come from different tables.
 * For filtering by owner (e.g., issues list), use `issue.machine.owner?.id`
 * directly since the owner filter only matches registered owners.
 *
 * @param issue - The issue with machine owner information
 * @returns The owner's ID or null if no owner. May be from user_profiles or invited_users table.
 */
export function getMachineOwnerId(issue: IssueWithAllRelations): string | null {
  return issue.machine.owner?.id ?? issue.machine.invitedOwner?.id ?? null;
}
