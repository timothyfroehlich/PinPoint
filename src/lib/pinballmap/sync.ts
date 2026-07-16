import "server-only";

/**
 * PinballMap sync orchestration (PP-o355.11).
 *
 * The foundation (PP-o355.16) owns the fetch-and-persist (`syncLocationSnapshot`
 * in `./state`). This module adds the reconcile pass that heals stored lmx-id
 * drift off the persisted snapshot, and re-exports the pure status-derivation
 * surface so the rest of the app has one import point for "PBM status" concerns.
 */

export {
  derivePbmMachineStatus,
  shouldBeListedOnPbm,
  type PbmMachineStatus,
} from "./status";
