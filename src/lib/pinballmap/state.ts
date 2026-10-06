/**
 * The `pinballmap_state` singleton's public surface, re-exported from the
 * modules that own each concern:
 *
 * - `./runtime-state`: reading the singleton row.
 * - `./mutation-lease`: the lease an outbound lineup write holds.
 * - `./refresh-allowance`: the shared manual-refresh token bucket.
 * - `./location-sync`: `syncLocationSnapshot`, the one refresh chokepoint.
 * - `./tracked-location`: checking, committing and clearing the tracked
 *   location.
 */
export { getPinballMapState } from "./runtime-state";
export { type PinballMapMutationLease } from "./mutation-lease";
export {
  getRefreshAllowance,
  type RefreshAllowance,
} from "./refresh-allowance";
export {
  syncLocationSnapshot,
  type SyncResult,
  type SyncTrigger,
} from "./location-sync";
export {
  checkTrackedLocation,
  clearTrackedLocation,
  commitCheckedTrackedLocation,
  type CheckTrackedLocationResult,
  type CheckedLocationPreview,
  type ClearTrackedLocationResult,
  type CommitCheckedLocationResult,
} from "./tracked-location";
