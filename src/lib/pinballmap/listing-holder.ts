import {
  MACHINE_PRESENCE_RANK,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

/**
 * Which machine may hold a PinballMap listing when several cabinets share one
 * catalog title (PP-o355.15).
 *
 * **Why the rule has to exist.** PBM's `POST /location_machine_xrefs` is
 * find-or-create on `(location_id, machine_id)` — verified in their source at
 * `api/v1/location_machine_xrefs_controller.rb:92`. Two PinPoint machines matched
 * to the same catalog title therefore cannot each own a distinct lmx at our
 * location; they collapse to a single PBM entry. Migration 0052 mirrors that with
 * a partial UNIQUE on `pinballmap_machine_id WHERE pinballmap_listed`.
 *
 * **What the guard is actually for.** It exists for exactly one reason: we cannot
 * tell which cabinet PBM's single entry belongs to. Anything that disambiguates
 * dissolves it — *including a human clicking a button*. So a tie never hides an
 * action, never raises an alert, and never pauses syncing. It only ever means
 * **we** decline to choose automatically. A tie with nobody listed is
 * indistinguishable from "not listed" in the UI, and that invisibility is the
 * point (refresher §7).
 *
 * Pure: no DB, no `server-only`. Auto-link (PP-o355.20), the action layer, and
 * the dashboard are all meant to call this rather than re-derive the rule — two
 * implementations would drift, and the partial unique index would start
 * rejecting writes one of them believed were legal.
 *
 * **No production caller yet.** This module lands ahead of its consumer on
 * purpose: PP-o355.20 may not set `listed = true` until the rule deciding which
 * cabinet may hold a listing exists, so the rule ships first. Until auto-link
 * wires it up, the only thing actually preventing a duplicate listing at runtime
 * is the 23505 backstop in `./listing-conflict` plus the DB index itself.
 */

/** The fields the rule needs. Deliberately structural, so callers pass rows. */
export interface ListingHolderCandidate {
  id: string;
  /** Catalog title edition. `null` = unmatched, so no listing to contend over. */
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  presenceStatus: MachinePresenceStatus;
}

/**
 * Availabilities under which being Listed is **invalid** (refresher §6 matrix).
 *
 * These machines are not candidates to *become* the holder. Note the asymmetry:
 * an incumbent that drifts into one of these keeps its listing — that is a §6
 * hard flag for the dashboard to count, not a tie (see `resolveListingHolder`).
 */
const INVALID_WHEN_LISTED: ReadonlySet<MachinePresenceStatus> = new Set([
  "pending_arrival",
  "removed",
]);

export type ListingHolder =
  /** Already listed. We created that lmx, so we know whose it is. */
  | { kind: "incumbent"; machineId: string }
  /** Nobody listed, exactly one legitimate pick — auto-link may link it. */
  | { kind: "candidate"; machineId: string }
  /** Nobody listed, two or more equally good — auto-link stands down. */
  | { kind: "tie"; machineIds: string[] }
  /** Nothing eligible to hold a listing at all. */
  | { kind: "none" };

/**
 * Decide who may hold the listing for one catalog title.
 *
 * Pass every machine sharing a single `pinballmapMachineId`; grouping is the
 * caller's job (`findListingTies` does it for the whole fleet).
 */
export function resolveListingHolder(
  group: readonly ListingHolderCandidate[]
): ListingHolder {
  // INCUMBENT — an existing listing is knowledge, so it wins outright
  // (Tim, 2026-07-25). No tie, ever, regardless of how many same-title cabinets
  // share its availability, and regardless of whether its OWN availability has
  // since drifted into an invalid one: a listed machine marked `removed` is a §6
  // hard flag, not an ambiguity. The partial unique index guarantees at most one
  // row can be listed per title, so there is no second case to handle.
  const incumbent = group.find((m) => m.pinballmapListed);
  if (incumbent) return { kind: "incumbent", machineId: incumbent.id };

  // OPEN CONTEST — nobody is listed, so we would have to *pick*. Drop machines
  // whose availability makes Listed invalid, then rank what remains.
  const eligible = group.filter(
    (m) => !INVALID_WHEN_LISTED.has(m.presenceStatus)
  );
  if (eligible.length === 0) return { kind: "none" };

  const bestRank = Math.min(
    ...eligible.map((m) => MACHINE_PRESENCE_RANK[m.presenceStatus])
  );
  const atBestRank = eligible.filter(
    (m) => MACHINE_PRESENCE_RANK[m.presenceStatus] === bestRank
  );

  const [sole] = atBestRank;
  if (atBestRank.length === 1 && sole) {
    return { kind: "candidate", machineId: sole.id };
  }

  return {
    kind: "tie",
    // Sorted so the descriptor is stable across query orderings — callers
    // compare and render these.
    machineIds: atBestRank.map((m) => m.id).sort(),
  };
}

/** A title where nobody holds the listing and we declined to auto-pick. */
export interface ListingTie {
  pinballmapMachineId: number;
  machineIds: string[];
}

/**
 * The reportable condition, across a whole fleet: "no machine holds this listing
 * and we declined to choose."
 *
 * Informational, not urgent — the fleet still works, someone just has to pick.
 * The admin machine dashboard (PP-o355.7) owns the presentation; this only
 * exposes the data.
 */
export function findListingTies(
  fleet: readonly ListingHolderCandidate[]
): ListingTie[] {
  const byTitle = new Map<number, ListingHolderCandidate[]>();
  for (const m of fleet) {
    // Unmatched machines have no title to contend over.
    if (m.pinballmapMachineId === null) continue;
    const group = byTitle.get(m.pinballmapMachineId);
    if (group) group.push(m);
    else byTitle.set(m.pinballmapMachineId, [m]);
  }

  const ties: ListingTie[] = [];
  for (const [pinballmapMachineId, group] of byTitle) {
    const holder = resolveListingHolder(group);
    if (holder.kind === "tie") {
      ties.push({ pinballmapMachineId, machineIds: holder.machineIds });
    }
  }

  // Ordered by title id so the report is stable run to run.
  return ties.sort((a, b) => a.pinballmapMachineId - b.pinballmapMachineId);
}
