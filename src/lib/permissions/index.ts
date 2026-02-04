/**
 * Permissions module
 *
 * Single source of truth for all permissions in PinPoint.
 */

// Matrix exports
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

// Helper exports
export {
  type OwnershipContext,
  type PermissionState,
  getAccessLevel,
  checkPermission,
  getPermissionState,
  getPermissionDeniedReason,
  checkPermissions,
  checkAnyPermission,
  getGrantedPermissions,
  getRawPermissionValue,
  isConditionalPermission,
} from "./helpers";

// Hook exports (client-side only)
export {
  type PermissionUser,
  type IssueContext,
  type MachineContext,
  usePermission,
  usePermissionState,
  usePermissions,
  usePermissionStates,
  useAccessLevel,
  useIsAuthenticated,
  useIsConditionalPermission,
  useRawPermission,
} from "./hooks";
