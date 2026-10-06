/**
 * Per-set authorization for machine settings sets
 * (docs/feature-specs/machine-settings.md §2–§4).
 *
 * The matrix entry `machines.settings.manage` (technicians and admins on any
 * machine, a member on the machines they own) gates creating sets, editing
 * community sets, applying settings tags, and choosing preferred sets. A
 * personal set adds one rule on top: only its author edits it (§2.2). Every set
 * is visible to everyone who can open the machine (§2.5), so there is no view
 * predicate.
 */

import { checkPermission } from "./helpers";
import { type AccessLevel } from "./matrix";

/** The minimal per-set facts the authorization rules need. */
export interface SettingsSetAuth {
  isCommunity: boolean;
  createdById: string | null;
}

/**
 * Who may create sets on a machine, edit its community sets, tag its sets, and
 * choose its preferred sets (§2.1, §2.3, §3.4, §4.3).
 */
export function canManageMachineSettings(
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  return checkPermission("machines.settings.manage", access, {
    userId: viewerId ?? undefined,
    machineOwnerId,
  });
}

/** Whether the viewer wrote this set. Guests and anonymous visitors never did. */
function isAuthor(
  set: SettingsSetAuth,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  // A demoted or signed-out account no longer acts as the author.
  // permissions-audit-allow: authorship check, not a permission gate
  if (access === "unauthenticated" || access === "guest") return false;
  return set.createdById !== null && set.createdById === viewerId;
}

/**
 * Who may EDIT a set's contents: a personal set's author only (§2.2); a
 * community set's technicians, machine owner, and admins (§2.3).
 */
export function canEditSet(
  set: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  if (!set.isCommunity) return isAuthor(set, viewerId, access);
  return canManageMachineSettings(machineOwnerId, viewerId, access);
}

/**
 * Who may DELETE a set: whoever can edit it, plus an admin for a personal set
 * (§2.2).
 */
export function canDeleteSet(
  set: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  if (checkPermission("machines.settings.delete.any", access)) return true;
  return canEditSet(set, machineOwnerId, viewerId, access);
}

/** Only a personal set's author turns it into a community set (§2.4). */
export function canMakeCommunity(
  set: SettingsSetAuth,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  return !set.isCommunity && isAuthor(set, viewerId, access);
}
