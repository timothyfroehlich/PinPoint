/**
 * Per-set authorization for machine settings sets (PP-tn6t).
 *
 * The matrix entry `machines.settings.manage` gates *creating* a set
 * (owner / technician / admin). Once a set exists, view and edit rights depend
 * on the set's KIND (owner vs community) and VISIBILITY (private vs public) —
 * that per-set logic lives here as pure functions so it can be unit-tested and
 * reused by the query, the server actions, and the UI.
 *
 * Model (see docs/superpowers/specs/2026-07-22-shareable-settings-sets-design.md):
 * - Owner set (`isOwnerSet`): editable by the machine owner + admin only.
 * - Community set: co-edited by technicians+, the machine owner, and admin.
 * - Visibility: private drafts are visible only to their creator (+ admin);
 *   public sets and the owner's default are visible to everyone.
 * - Editing always requires BOTH view and edit rights.
 */

import { type AccessLevel } from "~/lib/permissions/matrix";

/** The minimal per-set facts the authorization rules need. */
export interface SettingsSetAuth {
  isOwnerSet: boolean;
  isPublic: boolean;
  isPreferred: boolean;
  createdById: string | null;
}

const isTechPlus = (access: AccessLevel): boolean =>
  access === "technician" || access === "admin";

const isMachineOwner = (
  machineOwnerId: string | null,
  viewerId: string | null
): boolean => viewerId !== null && viewerId === machineOwnerId;

/**
 * Who may SEE a set: public sets and the owner's default are visible to
 * everyone; a private draft only to its creator (and admin).
 */
export function canViewSet(
  set: SettingsSetAuth,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  if (set.isPublic || set.isPreferred || access === "admin") return true;
  return set.createdById !== null && set.createdById === viewerId;
}

/**
 * Who may EDIT a set. Requires view rights, then applies the kind rule:
 * owner sets are owner+admin only; community sets add technicians+.
 */
export function canEditSet(
  set: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  if (!canViewSet(set, viewerId, access)) return false;
  if (access === "admin") return true;
  if (isMachineOwner(machineOwnerId, viewerId)) return true;
  // Community sets only: technicians+ co-edit. Owner sets stay protected.
  return !set.isOwnerSet && isTechPlus(access);
}

/**
 * Who may set a set as the Owner's default: owner/admin only, and only an
 * owner set is eligible (a community set can't become the default).
 */
export function canSetOwnerDefault(
  set: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean {
  if (!set.isOwnerSet) return false;
  return access === "admin" || isMachineOwner(machineOwnerId, viewerId);
}

/** Publishing (public toggle) needs the same rights as editing. */
export const canPublishSet = canEditSet;

/** Tagging Tournament needs the same rights as editing. */
export const canTagTournamentSet = canEditSet;
