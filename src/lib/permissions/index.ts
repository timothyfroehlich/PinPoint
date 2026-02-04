/**
 * Permissions module
 *
 * Single source of truth for all permissions in PinPoint.
 */

export {
  // Types
  type PermissionValue,
  type AccessLevel,
  // Constants
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_DESCRIPTIONS,
  PERMISSIONS_MATRIX,
  PERMISSIONS_BY_ID,
  // Functions
  getPermission,
  hasPermission,
  requiresOwnershipCheck,
} from "./matrix";
