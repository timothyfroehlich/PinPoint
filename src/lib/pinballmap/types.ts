/**
 * PinballMap (PBM) client seam — shared types.
 *
 * Everything the app knows about PBM's wire format lives behind the
 * `PinballMapClient` interface. The rest of the codebase imports these types
 * and `getPinballMapClient()` (see `./client`), never raw fetch calls.
 *
 * Design: docs/superpowers/specs/2026-06-18-pinballmap-integration-design.md
 * API reference (vendored): docs/external/pinballmap-llms.txt
 */

/** A single condition note attached to an LMX (PBM's per-location comments). */
export interface PbmCondition {
  /** Stable PBM condition id — used to dedupe when importing into timelines. */
  id: number;
  comment: string;
  /** PBM username of the commenter, or null for operator/admin entries. */
  username: string | null;
  /** ISO timestamp from PBM (`created_at`). */
  createdAtIso: string;
}

/**
 * A location_machine_xref — "this machine at this location". The `id` (lmx id)
 * is ephemeral: removing and re-adding a machine mints a new one, so it is
 * resolved from the latest snapshot at action time and never cached.
 *
 * Note: PBM's location payload carries only `machineId` here, not the machine
 * name — names come from the catalog mirror (bead B).
 */
export interface PbmLmx {
  id: number;
  machineId: number;
  icEnabled: boolean | null;
  lastUpdatedByUsername: string | null;
  conditions: PbmCondition[];
}

/** Normalized snapshot of our location, as returned by `fetchLocation`. */
export interface LocationSnapshot {
  locationId: number;
  name: string;
  /** PBM's `date_last_updated` (YYYY-MM-DD) or null. */
  dateLastUpdated: string | null;
  lastUpdatedByUsername: string | null;
  machineCount: number;
  lmxes: PbmLmx[];
  /** When *we* fetched it (ISO). Set by the client, not PBM. */
  fetchedAtIso: string;
  /** The untouched PBM payload, for storage/debugging. */
  raw: unknown;
}

/** A canonical machine in PBM's catalog, used by the linking picker (bead B). */
export interface CatalogMachine {
  machineId: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
  opdbId: string | null;
  ipdbId: number | null;
}

/** Per-user PBM credentials appended to write requests as query params. */
export interface PbmCredentials {
  email: string;
  token: string;
}

/**
 * Result of a PBM write. Reasons map to actionable UI states:
 * - `rate_limited` — hit a 429 (see vendored llms.txt rate-limit table)
 * - `unauthorized` — token rejected (surface "PinballMap rejected your credentials")
 * - `not_found` — the target lmx/location no longer exists on PBM
 * - `transient` — network/5xx; safe to retry later
 */
export type PbmWriteResult =
  | { ok: true }
  | {
      ok: false;
      reason: "rate_limited" | "unauthorized" | "not_found" | "transient";
    };

/** `addMachine` additionally returns the new lmx id on success. */
export type PbmAddMachineResult =
  | { ok: true; lmxId: number }
  | {
      ok: false;
      reason: "rate_limited" | "unauthorized" | "not_found" | "transient";
    };

/** Result of exchanging a login+password for an API token (bead F). */
export type PbmAuthResult =
  | { ok: true; token: string; username: string }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" | "transient" };

/**
 * The single seam wrapping all PBM HTTP. Live and mock implementations both
 * satisfy this; `getPinballMapClient()` selects between them by env.
 */
export interface PinballMapClient {
  /** Anonymous read: the full location payload (LMXes + conditions). */
  fetchLocation(locationId: number): Promise<LocationSnapshot>;
  /** Anonymous bulk read: the canonical machine catalog (for the local mirror). */
  fetchCatalog(): Promise<CatalogMachine[]>;
  /** Exchange login+password for a long-lived API token. */
  authDetails(login: string, password: string): Promise<PbmAuthResult>;
  /** Add a machine to the location. */
  addMachine(input: {
    credentials: PbmCredentials;
    locationId: number;
    machineId: number;
  }): Promise<PbmAddMachineResult>;
  /** Remove a machine (by lmx id). */
  removeMachine(input: {
    credentials: PbmCredentials;
    lmxId: number;
  }): Promise<PbmWriteResult>;
  /** Post a condition comment to an lmx. */
  postCondition(input: {
    credentials: PbmCredentials;
    lmxId: number;
    comment: string;
  }): Promise<PbmWriteResult>;
  /** Toggle Insider Connected for an lmx. */
  setInsiderConnected(input: {
    credentials: PbmCredentials;
    lmxId: number;
    enabled: boolean;
  }): Promise<PbmWriteResult>;
  /** Confirm the location's lineup is accurate as of today (no mutation). */
  confirmLineup(input: {
    credentials: PbmCredentials;
    locationId: number;
  }): Promise<PbmWriteResult>;
}
