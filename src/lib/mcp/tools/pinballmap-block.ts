import "server-only";

import { eq } from "drizzle-orm";

import { getCatalogEntry, isCatalogEmpty } from "~/lib/pinballmap/catalog";
import {
  deriveInsiderConnectedView,
  withInsiderConnected,
  type PbmIcIntent,
  type PbmInsiderConnectedSetting,
  type PbmInsiderConnectedView,
} from "~/lib/pinballmap/insider-connected";
import {
  derivePbmListingView,
  type PbmListingIntent,
  type PbmListingStateName,
  type PbmListingView,
  type PbmPushAction,
  type PbmSiblingInput,
} from "~/lib/pinballmap/listing-state";
import { getPinballMapState } from "~/lib/pinballmap/state";
import type { LocationSnapshot } from "~/lib/pinballmap/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import type { MachinePbmColumns } from "~/services/machines";

/**
 * A machine's PinballMap state as the MCP tools report it (PP-u4ab.8).
 *
 * One shape, shared by every tool that surfaces or echoes a machine's PBM state,
 * so a read and a later write never describe the same machine differently.
 *
 * The three states a machine can be in are represented explicitly, never by an
 * omitted field:
 *
 *  - **linked** — `pinballmapMachineId` is set; the catalog title, edition group,
 *    model metadata and listing state come with it.
 *  - **excluded** — deliberately marked "not on Pinball Map", with the operator's
 *    reason. (The schema CHECK `machines_pinballmap_link_exclusive` makes linked
 *    and excluded mutually exclusive, so the union is total.)
 *  - **neither** — nothing has been recorded yet. The *containing* field is then
 *    `null` (e.g. `get_machine` returns `pinballmap: null`). Callers must be able
 *    to tell "no PBM state recorded" from "excluded", so the field is always
 *    present and explicitly `null` — never omitted.
 *
 * Within a variant, `null` means "not set" for that specific fact (no group, no
 * resolved title). A field is never dropped to signal absence.
 */
export type McpMachinePinballmap =
  McpMachinePinballmapLinked | McpMachinePinballmapExcluded;

/** A machine linked to a Pinball Map catalog title. */
export interface McpMachinePinballmapLinked {
  status: "linked";
  /** The linked PBM catalog id (`pinballmap_machine_id`). */
  pinballmapMachineId: number;
  /**
   * How the catalog lookup for `pinballmapMachineId` went — the ONLY thing that
   * makes a null `title` interpretable:
   *
   *  - `"found"` — the mirror named the title; `title`/`group`/`machineGroupId`
   *    below are real.
   *  - `"missing"` — the mirror holds rows but not this id. The stored link is
   *    genuinely stale and worth fixing.
   *  - `"mirror_unpopulated"` — the mirror is EMPTY, so nothing could have been
   *    found. The link is not stale; its title is simply unknown right now.
   *    (`refreshCatalog` is a weekly cron that no-ops on an empty upstream read,
   *    so this is a live state on a fresh preview branch or a prod-seeded local.)
   *
   * Without this, `"missing"` and `"mirror_unpopulated"` produce byte-identical
   * payloads, and reporting the whole fleet's links as broken when nothing is
   * broken is exactly the confident-wrong-answer failure CORE-ARCH-012 forbids.
   */
  catalogLookup: "found" | "missing" | "mirror_unpopulated";
  /**
   * The catalog title for that id — the *edition* name, e.g. "Elvira's House of
   * Horrors (Premium)". `null` whenever `catalogLookup` is not `"found"`; read
   * that field to learn whether the link is stale or merely unresolvable.
   */
  title: string | null;
  /**
   * The PBM machine-group id when the title belongs to an edition family; `null`
   * for standalone titles (and whenever the title didn't resolve). Pass it to
   * `search_pinballmap_catalog` to list the family's other editions.
   */
  machineGroupId: number | null;
  /** The family's display name, e.g. "Elvira's House of Horrors". */
  group: string | null;
  /**
   * Model metadata as PinPoint stored it, copied from the catalog when the link
   * was made (never trusted from a client — see `resolvePbmLinkColumnsForCreate`
   * / `resolvePbmLinkColumnsForUpdate`).
   */
  manufacturer: string | null;
  year: number | null;
  opdbId: string | null;
  ipdbId: number | null;
  /**
   * The operator's decision about the location's public lineup — `"on"`,
   * `"off"`, or `"no_sync"` (this cabinet opts out of the integration).
   *
   * It is an INTENT, not an observation: it says what should be on the lineup,
   * never what Pinball Map currently shows. Whether the entry is actually there
   * comes from the stored location snapshot, and the two disagreeing is an
   * ordinary state a person resolves (spec §1, §4).
   */
  intent: PbmListingIntent;
  /** The entry's Insider Connected setting as PinPoint intends it (spec §3.8). */
  insiderConnected: McpMachineInsiderConnected;
  /**
   * What the last-synced lineup shows for this title, against `intent` and the
   * Insider Connected target: `outOfSync` includes Insider Connected differs.
   */
  lineup: McpMachineLineup;
}

/**
 * `intent` is this cabinet's own decision; `target` is what the shared entry
 * should be across same-title cabinets (On wins); `pinballMap` is what the last
 * sync recorded. `differs` is the Insider Connected differs state (spec §4.2).
 */
export interface McpMachineInsiderConnected {
  /**
   * Whether Pinball Map's catalog marks the title Insider Connected eligible.
   * `null` when the title didn't resolve (`catalogLookup` is not `"found"`), so
   * an unknown title never reads as ineligible. The fields below are `null` /
   * `false` unless this is `true`.
   */
  eligible: boolean | null;
  /** `"on"`, `"off"`, or `null` when none has been chosen. */
  intent: PbmIcIntent | null;
  /** The entry's target across same-title cabinets; `null` when none has an intent. */
  target: PbmIcIntent | null;
  /** Pinball Map's recorded value; `null` when the entry isn't on the stored lineup. */
  pinballMap: PbmInsiderConnectedSetting | null;
  differs: boolean;
}

/**
 * The observation half of a linked machine's PBM state, derived from the STORED
 * location snapshot by the same `derivePbmListingView` the machine page uses —
 * never a live read (CORE-PBM-001). `onLineup` is `null`, not `false`, whenever
 * there is no snapshot to look in (`state` "not_configured" or "waiting"), so
 * "we don't know" never reads as "it's not there" (CORE-ARCH-012).
 */
export interface McpMachineLineup {
  state: PbmListingStateName;
  onLineup: boolean | null;
  outOfSync: boolean;
  /** The push that would make the lineup match the intent, when one is allowed. */
  pushAction: PbmPushAction | null;
  /** Initials of other same-title cabinets whose intent is On. */
  coveredBy: string[];
  /** When the snapshot was last successfully fetched, ISO; `null` if never. */
  snapshotSyncedAt: string | null;
  /** Outcome of the most recent sync attempt; "error" means the snapshot is older than the attempt. */
  lastSyncStatus: LineupSource["lastSyncStatus"];
}

/** The location-wide inputs every lineup derivation shares: one singleton read. */
export interface LineupSource {
  configured: boolean;
  snapshot: LocationSnapshot | null;
  syncedAt: Date | null;
  lastSyncStatus: "unknown" | "ok" | "error" | null;
}

export async function loadLineupSource(): Promise<LineupSource> {
  const state = await getPinballMapState();
  // A dormant snapshot from a since-cleared location must not be read as the
  // current lineup — the same gate the machine page applies. Its sync health is
  // dormant with it: clearing a location leaves both columns behind.
  if (state?.locationId == null) {
    return {
      configured: false,
      snapshot: null,
      syncedAt: null,
      lastSyncStatus: null,
    };
  }
  return {
    configured: true,
    snapshot: state.snapshotJson ?? null,
    syncedAt: state.lastSyncedAt,
    lastSyncStatus: state.lastSyncStatus,
  };
}

/** The per-machine columns a lineup derivation needs beyond `MachinePbmColumns`. */
export interface LineupSubject {
  id: string;
  presenceStatus: MachinePresenceStatus;
}

export function deriveLineupView(
  machine: Pick<
    MachinePbmColumns,
    "pinballmapMachineId" | "pinballmapExcluded" | "pinballmapIntent"
  > &
    LineupSubject,
  source: LineupSource,
  siblings: readonly PbmSiblingInput[]
): PbmListingView {
  return derivePbmListingView({
    machineId: machine.id,
    pinballmapMachineId: machine.pinballmapMachineId,
    pinballmapExcluded: machine.pinballmapExcluded,
    intent: machine.pinballmapIntent,
    presenceStatus: machine.presenceStatus,
    configured: source.configured,
    snapshot: source.snapshot,
    siblings,
  });
}

/** A same-title cabinet, with the Insider Connected intent the entry's target needs. */
export type LineupSibling = PbmSiblingInput & { icIntent: PbmIcIntent | null };

/**
 * The lineup view with Insider Connected folded in, as the machine page shows
 * it: `outOfSync` / `pushAction` include Insider Connected differs (spec §4.2).
 * `ic` is null when the title is not eligible.
 */
export function deriveLineupWithInsiderConnected(
  machine: Parameters<typeof deriveLineupView>[0] & {
    pinballmapIcIntent: PbmIcIntent | null;
  },
  source: LineupSource,
  siblings: readonly LineupSibling[],
  icEligible: boolean
): { view: PbmListingView; ic: PbmInsiderConnectedView | null } {
  const listing = deriveLineupView(machine, source, siblings);
  const ic =
    machine.pinballmapMachineId === null
      ? null
      : deriveInsiderConnectedView({
          listing,
          pinballmapMachineId: machine.pinballmapMachineId,
          icEligible,
          intent: machine.pinballmapIcIntent,
          siblingIntents: siblings.map((sibling) => sibling.icIntent),
          snapshot: source.snapshot,
        });
  return { view: withInsiderConnected(listing, ic), ic };
}

function toMcpLineup(
  view: PbmListingView,
  source: LineupSource
): McpMachineLineup {
  const unknown = view.name === "not_configured" || view.name === "waiting";
  return {
    state: view.name,
    onLineup: unknown ? null : view.observed,
    outOfSync: view.outOfSync,
    pushAction: view.pushAction,
    coveredBy: view.coveredBy.map((s) => s.initials),
    snapshotSyncedAt: source.syncedAt?.toISOString() ?? null,
    lastSyncStatus: source.lastSyncStatus,
  };
}

/** A machine deliberately marked as not on Pinball Map. */
export interface McpMachinePinballmapExcluded {
  status: "excluded";
  /** The operator's reason, or `null` when none was given. */
  reason: string | null;
}

/**
 * Build the {@link McpMachinePinballmap} block for a machine's stored PBM
 * columns, resolving the linked title/family from the local catalog mirror.
 * Returns `null` when the machine is neither linked nor excluded.
 *
 * A linked machine whose title doesn't resolve is reported with a
 * `catalogLookup` that says WHY, so "this link is stale" is never asserted on
 * the strength of an empty mirror. The emptiness probe runs only on a miss.
 *
 * Reads the `pinballmap_catalog` mirror and the stored location snapshot only —
 * never pinballmap.com (CORE-PBM-001).
 */
export async function buildMachinePinballmap(
  machine: MachinePbmColumns &
    LineupSubject & { pinballmapIcIntent: PbmIcIntent | null }
): Promise<McpMachinePinballmap | null> {
  if (machine.pinballmapMachineId !== null) {
    const pinballmapMachineId = machine.pinballmapMachineId;
    const [entry, source, siblings] = await Promise.all([
      getCatalogEntry(pinballmapMachineId),
      loadLineupSource(),
      // Coverage is what separates Covered (quiet) from Lingering (out of sync),
      // so the same-title cabinets are needed to call either one.
      db
        .select({
          id: machines.id,
          initials: machines.initials,
          name: machines.name,
          intent: machines.pinballmapIntent,
          icIntent: machines.pinballmapIcIntent,
        })
        .from(machines)
        .where(eq(machines.pinballmapMachineId, pinballmapMachineId)),
    ]);
    // Only on a miss, so a resolved link stays one query. `get_machine` has a
    // real non-PBM answer to give (name, presence, owner, open issues), so it
    // reports the ambiguity rather than throwing the way the search tool does —
    // an unpopulated mirror must not take out an otherwise fine call.
    const catalogLookup = entry
      ? "found"
      : (await isCatalogEmpty())
        ? "mirror_unpopulated"
        : "missing";
    const { view, ic } = deriveLineupWithInsiderConnected(
      machine,
      source,
      siblings,
      entry?.icEligible ?? false
    );
    return {
      status: "linked",
      pinballmapMachineId,
      catalogLookup,
      title: entry?.name ?? null,
      machineGroupId: entry?.machineGroupId ?? null,
      group: entry?.groupName ?? null,
      manufacturer: machine.manufacturer,
      year: machine.year,
      opdbId: machine.opdbId,
      ipdbId: machine.ipdbId,
      intent: machine.pinballmapIntent,
      insiderConnected: {
        eligible: entry ? entry.icEligible : null,
        intent: machine.pinballmapIcIntent,
        target: ic?.target ?? null,
        pinballMap: ic?.pinballMap ?? null,
        differs: ic?.differs ?? false,
      },
      lineup: toMcpLineup(view, source),
    };
  }

  if (machine.pinballmapExcluded) {
    return { status: "excluded", reason: machine.pinballmapExcludedReason };
  }

  return null;
}
