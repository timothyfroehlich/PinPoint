/**
 * Machine-route permission predicates.
 *
 * Manage combines two independently documented capabilities: editors need the
 * full machine-management surface, while refresh-capable members need its
 * read-only Pinball Map section (spec 4.9 / 8.3). Keeping the composition here
 * prevents the tab, Info-tab link, and deep-link guard from drifting apart.
 */

import { checkPermission, type OwnershipContext } from "./helpers";
import type { AccessLevel } from "./matrix";

export function canAccessMachineManage(
  accessLevel: AccessLevel,
  ownershipContext: OwnershipContext
): boolean {
  return (
    checkPermission("machines.edit", accessLevel, ownershipContext) ||
    checkPermission("machines.pinballmap.sync", accessLevel, ownershipContext)
  );
}
