import type { MachinePbmColumns } from "~/services/machines";

import { getCatalogEntry } from "./catalog";
import { validatePbmLinkSelection } from "./linking";

export type ResolvePbmLinkResult =
  { ok: true; columns: MachinePbmColumns } | { ok: false; message: string };

/**
 * Resolve a machine's PinballMap columns from a submitted link selection.
 *
 * Enforces the mutual-exclusion + (flag-gated) requirement via
 * {@link validatePbmLinkSelection}, and — crucially — derives model metadata
 * (manufacturer/year/OPDB/IPDB) from the local catalog mirror rather than
 * trusting the caller. Returns the full column set so create and edit
 * inserts/updates can spread it; the submitted state is authoritative (clearing
 * the picker unlinks, which is how re-link/unlink works).
 *
 * Shared by the machine server actions and the MCP `add_machine` tool. Reads the
 * catalog mirror only — never reaches pinballmap.com (CORE-PBM-001).
 */
export async function resolvePbmLinkColumns(input: {
  pinballmapMachineId?: number | undefined;
  pinballmapExcluded?: boolean | undefined;
  pinballmapExcludedReason?: string | undefined;
  pinballmapListed?: boolean | undefined;
}): Promise<ResolvePbmLinkResult> {
  const pinballmapMachineId = input.pinballmapMachineId ?? null;
  const pinballmapExcluded = input.pinballmapExcluded ?? false;

  const validationError = validatePbmLinkSelection({
    pinballmapMachineId,
    pinballmapExcluded,
  });
  if (validationError === "both_link_and_excluded") {
    return {
      ok: false,
      message:
        "A machine can't be both linked to Pinball Map and marked as not on it.",
    };
  }
  if (validationError === "link_required") {
    return {
      ok: false,
      message:
        "Select a Pinball Map title or mark the machine as not on Pinball Map.",
    };
  }

  const empty: MachinePbmColumns = {
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    // Listing presupposes a link — only the linked branch below can set it true,
    // so every not-linked outcome (excluded, or neither) unlists the machine.
    pinballmapListed: false,
    manufacturer: null,
    year: null,
    opdbId: null,
    ipdbId: null,
  };

  if (pinballmapExcluded) {
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapExcluded: true,
        pinballmapExcludedReason: input.pinballmapExcludedReason ?? null,
      },
    };
  }

  if (pinballmapMachineId !== null) {
    const entry = await getCatalogEntry(pinballmapMachineId);
    if (!entry) {
      return {
        ok: false,
        message:
          "That Pinball Map title is no longer in the catalog — search again.",
      };
    }
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapMachineId,
        // Only a linked machine can be listed on the public map.
        pinballmapListed: input.pinballmapListed ?? false,
        manufacturer: entry.manufacturer,
        year: entry.year,
        opdbId: entry.opdbId,
        ipdbId: entry.ipdbId,
      },
    };
  }

  // Neither linked nor excluded (requirement off): all PBM columns stay empty.
  return { ok: true, columns: empty };
}
