/**
 * Pinball Map API Types
 *
 * Type definitions for the Pinball Map API v1 responses.
 * These map to the external API's JSON schema, not PinPoint's internal types.
 */

/** A machine in Pinball Map's canonical database (game model, not location-specific) */
export interface PbmMachine {
  id: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

/** A machine-at-a-location link record (from /locations/:id/machine_details) */
export interface PbmLocationMachine {
  id: number; // location_machine_xref ID
  machine_id: number; // canonical machine ID
  name: string;
  manufacturer: string | null;
  year: string | null;
}

/** Credentials and location for Pinball Map API write operations */
export interface PbmConfig {
  locationId: number;
  userEmail: string;
  userToken: string;
}

/** Sync status for a single machine */
export type PbmSyncStatus =
  | "in_sync" // On floor in PinPoint + listed on PBM
  | "missing_from_pbm" // On floor in PinPoint but NOT on PBM
  | "extra_on_pbm" // On PBM but NOT on floor in PinPoint
  | "not_linked"; // No PBM machine ID set

import type { MachinePresenceStatus } from "~/lib/machines/presence";

/** A machine's PBM sync state for the sync report */
export interface PbmSyncEntry {
  // PinPoint data
  machineId: string;
  machineName: string;
  machineInitials: string;
  presenceStatus: MachinePresenceStatus;
  // PBM linking
  pbmMachineId: number | null;
  pbmMachineName: string | null;
  pbmLocationMachineXrefId: number | null;
  // Sync status
  syncStatus: PbmSyncStatus;
}

/** Extra machines on PBM that don't match any PinPoint machine */
export interface PbmExtraMachine {
  xrefId: number;
  machineId: number;
  name: string;
  manufacturer: string | null;
  year: string | null;
}

/** The full sync report */
export interface PbmSyncReport {
  entries: PbmSyncEntry[];
  extraOnPbm: PbmExtraMachine[];
  summary: {
    inSync: number;
    missingFromPbm: number;
    extraOnPbm: number;
    notLinked: number;
  };
}
