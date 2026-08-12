import type { MachinePbmColumns } from "~/services/machines";

import { getCatalogEntry } from "./catalog";
import { validatePbmLinkSelection } from "./linking";

/** The submitted link selection. Listing state is never part of it (PP-o355.29). */
export interface PbmLinkSelection {
  pinballmapMachineId?: number | undefined;
  pinballmapExcluded?: boolean | undefined;
  pinballmapExcludedReason?: string | undefined;
  /**
   * Hand-entered model identity for a machine PinballMap's catalog cannot cover
   * (PP-3bbr). Read ONLY on the excluded branch below — on any other branch the
   * catalog is the source and these are silently dropped, which is what the DB
   * CHECK enforces and what the UI warns about before switching away.
   *
   * This is the one place model metadata legitimately comes from a request. The
   * "never trusted from the client" rule exists because a linked machine's
   * manufacturer and year are a claim about a catalog row we can look up
   * ourselves; for a homebrew there is nothing to look up, and a person typing
   * it is the only source there will ever be.
   */
  modelName?: string | undefined;
  manufacturer?: string | undefined;
  year?: number | undefined;
}

/** The stored machine's PBM state, read from the row — never from a request. */
export interface StoredPbmLinkState {
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
}

/** A live PinballMap entry the machine no longer claims (PP-l81u). */
export interface AbandonedListing {
  lmxId: number;
  pinballmapMachineId: number;
}

export type ResolvePbmLinkResult =
  { ok: true; columns: MachinePbmColumns } | { ok: false; message: string };

export type ResolvePbmLinkUpdateResult =
  | { ok: true; columns: MachinePbmColumns; abandoned: AbandonedListing | null }
  | { ok: false; message: string };

/**
 * Resolve PBM columns for a machine being CREATED.
 *
 * Takes no listing state, because a machine that does not exist yet cannot
 * already be on the public map. The hazard the old shared signature carried —
 * omitting listing state and silently unlisting — is removed by construction
 * here rather than by a caller remembering a rule.
 */
export async function resolvePbmLinkColumnsForCreate(
  input: PbmLinkSelection
): Promise<ResolvePbmLinkResult> {
  return resolveCore(input, {
    pinballmapMachineId: null,
    pinballmapListed: false,
    pinballmapLmxId: null,
  }).then((result) =>
    result.ok ? { ok: true, columns: result.columns } : result
  );
}

/**
 * Resolve PBM columns for a machine being UPDATED.
 *
 * Takes the STORED row and decides carry-over versus clear itself, so no caller
 * computes `linkUnchanged` independently (PP-l81u defect 1).
 *
 * Returns the columns AND any listing the machine just walked away from. The
 * abandonment is part of the return value rather than something the caller
 * works out, because a caller that applies the columns and forgets the record
 * reintroduces exactly the defect this split closes.
 */
export async function resolvePbmLinkColumnsForUpdate(
  input: PbmLinkSelection,
  stored: StoredPbmLinkState
): Promise<ResolvePbmLinkUpdateResult> {
  return resolveCore(input, stored);
}

async function resolveCore(
  input: PbmLinkSelection,
  stored: StoredPbmLinkState
): Promise<ResolvePbmLinkUpdateResult> {
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

  // Carry the stored listing only while the link target is unchanged. Every
  // other outcome — re-target, excluded, unlinked — leaves the old listing
  // meaningless for this machine.
  const linkUnchanged =
    pinballmapMachineId !== null &&
    pinballmapMachineId === stored.pinballmapMachineId;
  const keepsListing = linkUnchanged && stored.pinballmapListed;

  // The stored listing survives only when the link target is unchanged. Every
  // other outcome leaves a LIVE entry on pinballmap.com that this machine no
  // longer claims — that is the thing to write down, not discard (PP-l81u).
  const abandoned: AbandonedListing | null =
    !keepsListing &&
    stored.pinballmapListed &&
    stored.pinballmapLmxId !== null &&
    stored.pinballmapMachineId !== null
      ? {
          lmxId: stored.pinballmapLmxId,
          pinballmapMachineId: stored.pinballmapMachineId,
        }
      : null;

  const empty: MachinePbmColumns = {
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    // Listing presupposes a link — only the linked branch below can set it true,
    // so every not-linked outcome unlists the machine.
    pinballmapListed: false,
    // The lmx describes a live PBM listing, so it cannot outlive one. Clearing
    // it here is also what keeps the two lmx CHECK constraints satisfiable.
    pinballmapLmxId: null,
    // Same reasoning, different CHECK: `machines_model_name_requires_excluded`
    // forbids a hand-entered model on anything but an excluded machine, so the
    // linked and unlinked branches below must leave this null.
    modelName: null,
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
        // The only branch where model metadata comes from the request — see
        // `PbmLinkSelection.modelName`. Absent stays null rather than keeping a
        // stored value: a save that omits these fields is a save that cleared
        // them, and the sub-panel always submits all three together.
        modelName: input.modelName ?? null,
        manufacturer: input.manufacturer ?? null,
        year: input.year ?? null,
      },
      abandoned,
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
        pinballmapListed: keepsListing,
        pinballmapLmxId: keepsListing ? stored.pinballmapLmxId : null,
        manufacturer: entry.manufacturer,
        year: entry.year,
        opdbId: entry.opdbId,
        ipdbId: entry.ipdbId,
      },
      abandoned,
    };
  }

  // Neither linked nor excluded (requirement off): all PBM columns stay empty.
  return { ok: true, columns: empty, abandoned };
}
