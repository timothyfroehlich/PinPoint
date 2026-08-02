import "server-only";

import { getCatalogEntry } from "~/lib/pinballmap/catalog";
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
 * Within a variant, `null` means "not set" for that specific fact (no group, not
 * listed, no captured lmx). A field is never dropped to signal absence.
 */
export type McpMachinePinballmap =
  McpMachinePinballmapLinked | McpMachinePinballmapExcluded;

/** A machine linked to a Pinball Map catalog title. */
export interface McpMachinePinballmapLinked {
  status: "linked";
  /** The linked PBM catalog id (`pinballmap_machine_id`). */
  pinballmapMachineId: number;
  /**
   * The catalog title for that id — the *edition* name, e.g. "Elvira's House of
   * Horrors (Premium)". `null` when the local catalog mirror no longer holds the
   * id, which means the stored link is stale.
   */
  title: string | null;
  /**
   * The PBM machine-group id when the title belongs to an edition family; `null`
   * for standalone titles (and when the mirror has no row). Pass it to
   * `search_pinballmap_catalog` to list the family's other editions.
   */
  machineGroupId: number | null;
  /** The family's display name, e.g. "Elvira's House of Horrors". */
  group: string | null;
  /**
   * Model metadata as PinPoint stored it, copied from the catalog when the link
   * was made (never trusted from a client — see `resolvePbmLinkColumns`).
   */
  manufacturer: string | null;
  year: number | null;
  opdbId: string | null;
  ipdbId: number | null;
  /** Whether we consider the machine listed on Pinball Map's public map. */
  listed: boolean;
  /**
   * The captured PBM listing handle (`location_machine_xref` id); `null` when
   * the machine is not listed.
   */
  lmxId: number | null;
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
 * Reads the `pinballmap_catalog` mirror only — never pinballmap.com
 * (CORE-PBM-001).
 */
export async function buildMachinePinballmap(
  machine: MachinePbmColumns
): Promise<McpMachinePinballmap | null> {
  if (machine.pinballmapMachineId !== null) {
    const entry = await getCatalogEntry(machine.pinballmapMachineId);
    return {
      status: "linked",
      pinballmapMachineId: machine.pinballmapMachineId,
      title: entry?.name ?? null,
      machineGroupId: entry?.machineGroupId ?? null,
      group: entry?.groupName ?? null,
      manufacturer: machine.manufacturer,
      year: machine.year,
      opdbId: machine.opdbId,
      ipdbId: machine.ipdbId,
      listed: machine.pinballmapListed,
      lmxId: machine.pinballmapLmxId,
    };
  }

  if (machine.pinballmapExcluded) {
    return { status: "excluded", reason: machine.pinballmapExcludedReason };
  }

  return null;
}
