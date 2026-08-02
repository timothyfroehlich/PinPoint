import {
  resolveListingHolder,
  type ListingHolderCandidate,
} from "./listing-holder";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

/**
 * Auto-link: decide, for ONE catalog title, which cabinet (if any) should
 * capture that title's PinballMap listing (PP-o355.20).
 *
 * **Why this is automatic at all.** Matching a machine to a catalog title is a
 * human judgment. Attaching it to Pinball Map's lineup entry is not — it is
 * bookkeeping that mirrors a listing PBM already shows. So the ON direction is
 * derived, never clicked.
 *
 * **One direction only.** Nothing here ever clears `pinballmapListed`. A title
 * that has vanished from the lineup returns no write at all, so the machine keeps
 * its listing and stays counted as desynced for a human to resolve. Before this
 * module the reconcile pass flipped `pinballmapListed` in NEITHER direction; only
 * the ON half is reversed, and unlisting is still exclusively human.
 *
 * **Gated by the tie guard.** The decision unit is the whole set of cabinets
 * sharing one `pinballmapMachineId`, not a single machine, because PBM's
 * find-or-create semantics give that title exactly one lmx at our location
 * (`./listing-holder`). When two cabinets tie at the top presence rank we decline
 * to pick — which is also why a tie is reported distinctly from "nothing to do":
 * a tie must not be counted as desync, since it raises no alert (listing-holder
 * §7) and the sync pass needs to tell the two apart.
 *
 * Pure: no DB, no `server-only`. `resolveAutoLinkForMachine` in `./sync` is the
 * DB-backed wrapper for the single-machine (title-save) caller.
 */

/** A cabinet in the title's group, plus the lmx handle we currently store. */
export interface AutoLinkCandidate extends ListingHolderCandidate {
  pinballmapLmxId: number | null;
}

export type AutoLinkOutcome =
  /**
   * Capture `lmxId` on `machineId` and mark it listed.
   * - `linked` — nobody held the listing and exactly one cabinet was eligible.
   * - `reconnected` — the incumbent's stored lmx drifted (PBM re-minted the row
   *   after a delete + re-add outside its 7-day resurrection window). Silent
   *   heal; the title and the holder are both unchanged.
   */
  | {
      kind: "write";
      machineId: string;
      lmxId: number;
      action: "linked" | "reconnected";
    }
  /** Cabinets tied at the top presence rank — we decline to choose. */
  | { kind: "tie" }
  /** Nothing to do: title absent from the lineup, or already correct. */
  | { kind: "none" };

/**
 * Decide the auto-write for one catalog title.
 *
 * Pass every machine carrying `pinballmapMachineId`; grouping is the caller's
 * job. A title absent from `snapshot` yields `none` — never an unlist.
 */
export function resolveAutoLink(
  pinballmapMachineId: number,
  group: readonly AutoLinkCandidate[],
  snapshot: LocationSnapshot
): AutoLinkOutcome {
  const lmx = findLmxForMachine(snapshot, pinballmapMachineId);
  // Not on the lineup. Never an unlist (see the one-direction note above), and
  // for an unlisted candidate there is simply no handle to capture.
  if (!lmx) return { kind: "none" };

  const holder = resolveListingHolder(group);
  switch (holder.kind) {
    case "incumbent": {
      const incumbent = group.find((m) => m.id === holder.machineId);
      // Already pointing at the current lmx — the common case, no write.
      if (!incumbent || incumbent.pinballmapLmxId === lmx.id) {
        return { kind: "none" };
      }
      return {
        kind: "write",
        machineId: holder.machineId,
        lmxId: lmx.id,
        action: "reconnected",
      };
    }
    case "candidate":
      return {
        kind: "write",
        machineId: holder.machineId,
        lmxId: lmx.id,
        action: "linked",
      };
    case "tie":
      return { kind: "tie" };
    case "none":
      return { kind: "none" };
  }
}
