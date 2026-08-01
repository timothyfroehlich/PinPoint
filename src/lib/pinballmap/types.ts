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
 * is the durable listing handle: we capture it when a machine is listed and
 * STORE it on `machines.pinballmap_lmx_id`, healing it from the latest snapshot
 * when PBM re-mints one (removing + re-adding a machine changes the id). We do
 * not re-resolve it per push — see the store-and-heal model (PP-o355.16 / .12).
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
  /**
   * PBM groups editions of one title (Pro/Premium/LE) under a machine_group_id;
   * null for standalone titles. The group's display name comes from a separate
   * endpoint (`fetchMachineGroups`), not this record.
   */
  machineGroupId: number | null;
}

/** A PBM machine group — a "family" name shared by editions of one title. */
export interface MachineGroup {
  machineGroupId: number;
  name: string;
}

/** Per-user PBM credentials appended to write requests as query params. */
export interface PbmCredentials {
  email: string;
  token: string;
}

/**
 * Why a PBM write failed. Maps to actionable UI/retry states.
 *
 * IMPORTANT: PBM signals logical failures with HTTP 200 and an `errors` field
 * in the body (not a 4xx status) — e.g. `{"errors":"Failed to find machine"}`.
 * A disabled account is the lone exception (HTTP 401 + `{"error":"..."}`). The
 * live client classifies on the body, so these reasons are derived from PBM's
 * error message, not the status code. See the RSpec contract referenced in
 * `docs/external/README.md`.
 *
 * - `rate_limited` — hit a 429 (see vendored llms.txt rate-limit table); retry later
 * - `unauthorized` — auth required / token rejected / not the owner of the resource
 * - `not_found` — the target lmx/location/machine no longer exists on PBM
 * - `rejected` — PBM understood the request but refused it (e.g. machine not
 *   Insider-Connected eligible, blank condition); not retryable, surface `message`
 * - `transient` — network error or 5xx; safe to retry later
 */
export type PbmWriteFailureReason =
  "rate_limited" | "unauthorized" | "not_found" | "rejected" | "transient";

/** Shared failure shape; `message` carries PBM's own text when it supplied one. */
export interface PbmWriteFailure {
  ok: false;
  reason: PbmWriteFailureReason;
  message?: string;
}

export type PbmWriteResult = { ok: true } | PbmWriteFailure;

/** `addMachine` additionally returns the lmx id on success. */
export type PbmAddMachineResult = { ok: true; lmxId: number } | PbmWriteFailure;

/**
 * `toggleInsiderConnected` returns the *new* IC state PBM reports after the
 * toggle. The endpoint flips state — it is not a setter — so callers that want a
 * specific state must compare the snapshot's `icEnabled` and only toggle when it
 * differs. `null` means PBM returned no IC state for the lmx.
 */
export type PbmToggleResult =
  { ok: true; icEnabled: boolean | null } | PbmWriteFailure;

/** Result of exchanging a login+password for an API token (bead F). */
export type PbmAuthFailureReason =
  "invalid_credentials" | "account_disabled" | "rate_limited" | "transient";

export interface PbmAuthFailure {
  ok: false;
  reason: PbmAuthFailureReason;
  message?: string;
}

export type PbmAuthResult =
  { ok: true; token: string; username: string } | PbmAuthFailure;

/**
 * The single seam wrapping all PBM HTTP. Live and mock implementations both
 * satisfy this; `getPinballMapClient()` selects between them by env.
 */
export interface PinballMapClient {
  /** Anonymous read: the full location payload (LMXes + conditions). */
  fetchLocation(locationId: number): Promise<LocationSnapshot>;
  /** Anonymous bulk read: the canonical machine catalog (for the local mirror). */
  fetchCatalog(): Promise<CatalogMachine[]>;
  /** Anonymous bulk read: machine groups (family names) for the linking picker. */
  fetchMachineGroups(): Promise<MachineGroup[]>;
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
  /**
   * Toggle Insider Connected for an lmx and return the new state. PBM's endpoint
   * flips state rather than setting it, so this takes no desired value; callers
   * wanting a specific state compare the snapshot first.
   */
  toggleInsiderConnected(input: {
    credentials: PbmCredentials;
    lmxId: number;
  }): Promise<PbmToggleResult>;
  /** Confirm the location's lineup is accurate as of today (no mutation). */
  confirmLineup(input: {
    credentials: PbmCredentials;
    locationId: number;
  }): Promise<PbmWriteResult>;
}
