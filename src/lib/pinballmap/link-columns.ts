import type { MachinePbmColumns } from "~/services/machines";

import { getCatalogEntry } from "./catalog";
import type { PbmListingIntent } from "./listing-state";
import { validatePbmLinkSelection } from "./linking";
import { findLmxForMachine } from "./resolve-lmx";
import { getPinballMapState } from "./state";

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
  pinballmapIntent: PbmListingIntent;
}

/** A live PinballMap entry the machine no longer claims (PP-l81u). */
export interface AbandonedListing {
  lmxId: number;
  pinballmapMachineId: number;
  /**
   * The location whose lineup this lmx was read from — carried with the entry
   * rather than re-read from the singleton when the record is written.
   *
   * The singleton's `location_id` and its `snapshot_json` can legitimately
   * describe different venues: a re-point while the integration is disabled
   * moves the id and leaves the previous venue's lineup stored (spec 6.7).
   * Stamping the record from the id would then label an OLD-location lmx with
   * the NEW location, `isCrossLocation` in the remove path would read false,
   * and a `not_found` would re-mint against the new lineup — deleting an
   * unrelated live entry that happens to share the title. That is exactly the
   * destructive re-mint 6.9 exists to prevent. Taking the stamp from the
   * snapshot the lmx came from cannot disagree with itself, and it closes the
   * narrower enabled-path race too (a record whose transaction starts after a
   * `changeLocation` commits would otherwise read the new id).
   */
  locationId: number;
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
    pinballmapIntent: "off",
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

  // Intent survives only while the link target is unchanged. Every other
  // outcome — re-target, excluded, unlinked — leaves the old decision attached
  // to a title this cabinet no longer claims (spec 2.3).
  const linkUnchanged =
    pinballmapMachineId !== null &&
    pinballmapMachineId === stored.pinballmapMachineId;

  // A Don't-sync setting is kept across a re-match (spec 2.3): it says "leave
  // this cabinet out of the integration", which is a standing preference about
  // the cabinet rather than a claim about one title. On does not survive — it
  // would silently assert the NEW title belongs on the lineup, which is the
  // automatic intent change 5.1 forbids.
  const carriedIntent: PbmListingIntent = linkUnchanged
    ? stored.pinballmapIntent
    : stored.pinballmapIntent === "no_sync"
      ? "no_sync"
      : "off";

  // Walking away from a title while intent was On leaves a LIVE entry on
  // pinballmap.com that this machine no longer claims — that is the thing to
  // write down, not discard (PP-l81u).
  //
  // The lmx is resolved from the stored lineup by the OLD title rather than
  // read off the machine row: there is no per-machine handle any more (the
  // column was a per-cabinet copy of a per-entry fact), and the snapshot is the
  // one answer that cannot disagree with itself.
  const abandoned: AbandonedListing | null =
    !linkUnchanged &&
    stored.pinballmapIntent === "on" &&
    stored.pinballmapMachineId !== null
      ? await resolveAbandonedEntry(stored.pinballmapMachineId)
      : null;

  const empty: MachinePbmColumns = {
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    // Intent On presupposes a link — only the linked branch below can keep it,
    // so every not-linked outcome lands on Off (or a carried Don't sync).
    pinballmapIntent: carriedIntent === "no_sync" ? "no_sync" : "off",
    // `machines_model_name_requires_excluded` forbids a hand-entered model on
    // anything but an excluded machine, so the linked and unlinked branches
    // below must leave this null or the UPDATE throws.
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
        pinballmapIntent: carriedIntent,
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

/**
 * The lineup entry a cabinet is walking away from, if the stored lineup still
 * shows one for its old title.
 *
 * Returns null when there is no snapshot or the title is not on it — in both
 * cases there is no entry to record, and inventing an abandonment for one would
 * put a warning on the machine's page pointing at nothing (CORE-ARCH-012).
 */
async function resolveAbandonedEntry(
  oldPinballmapMachineId: number
): Promise<AbandonedListing | null> {
  const state = await getPinballMapState();
  const snapshot = state?.snapshotJson ?? null;
  if (!snapshot) return null;
  const lmx = findLmxForMachine(snapshot, oldPinballmapMachineId);
  if (!lmx) return null;
  return {
    lmxId: lmx.id,
    pinballmapMachineId: oldPinballmapMachineId,
    // From the snapshot the lmx was just read out of, never from the row's
    // `location_id` — see `AbandonedListing.locationId`.
    locationId: snapshot.locationId,
  };
}
