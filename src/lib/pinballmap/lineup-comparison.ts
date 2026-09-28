import type { MachinePresenceStatus } from "~/lib/machines/presence";

import {
  deriveInsiderConnectedView,
  insiderConnectedTarget,
  type PbmIcIntent,
  type PbmInsiderConnectedSetting,
} from "./insider-connected";
import {
  derivePbmListingView,
  INVALID_WHEN_ON,
  type PbmListingIntent,
} from "./listing-state";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot, PbmLmx } from "./types";

/**
 * The Pinball Map lineup page's comparison (`docs/feature-specs/pinballmap-
 * lineup.md`, PP-o355.65): PinPoint's intended lineup against what Pinball Map
 * shows for the tracked location, sorted into the four sections whose actions
 * resolve each difference (§5), plus the in-sync and not-compared tallies (§6).
 *
 * **Per-cabinet rules are not re-derived here.** The Insider Connected verdict
 * goes through `derivePbmListingView` / `deriveInsiderConnectedView`, and the
 * Alert tier is `INVALID_WHEN_ON` — the same rules the listing control renders.
 * This module only folds cabinets into one verdict per title.
 *
 * Pure — no DB, no `server-only` — so the page, the `/m` header badge and the
 * unit tests all call it directly, and it never reaches pinballmap.com
 * (CORE-PBM-001, lineup spec §2.3).
 */

/** PinPoint's position on one title (lineup spec §1, Title intent). */
export type LineupTitleIntent = PbmListingIntent;

/** The four sections, in their fixed render order (§5.1). */
export type LineupSectionKey =
  | "out_of_sync"
  | "pinpoint_only"
  | "pinball_map_only"
  | "availability_conflict";

export const LINEUP_SECTIONS: readonly LineupSectionKey[] = [
  "out_of_sync",
  "pinpoint_only",
  "pinball_map_only",
  "availability_conflict",
];

/** One machine as the comparison needs it. */
export interface LineupMachineInput {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  intent: PbmListingIntent;
  icIntent: PbmIcIntent | null;
}

/** One catalog title, for naming and for the family and IC facts. */
export interface LineupCatalogTitle {
  pinballmapMachineId: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
  machineGroupId: number | null;
  icEligible: boolean;
}

/** A title as the page names it. */
export interface LineupTitleRef {
  id: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

/** A PinPoint cabinet named on a row, with its intent and availability (§5.6). */
export interface LineupCabinet {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  intent: PbmListingIntent;
}

/** The fix an Out of sync row needs (§5.2, §7.3). */
export type LineupOutOfSyncTag = "to_add" | "to_remove" | "to_update";

export interface LineupOutOfSyncRow {
  section: "out_of_sync";
  key: string;
  tag: LineupOutOfSyncTag;
  title: LineupTitleRef;
  /** The cabinets the title intent was counted from. */
  cabinets: readonly LineupCabinet[];
  /** The entry's comment count; null when the title is not on Pinball Map. */
  commentCount: number | null;
  /** The entry's Insider Connected target, for the add and update confirms. */
  icTarget: PbmIcIntent | null;
}

export interface LineupPinpointOnlyRow {
  section: "pinpoint_only";
  key: string;
  machine: LineupCabinet;
}

/** A PinPoint machine in the entry's title family (pinballmap §1, §2.6). */
export interface LineupPossibleMatch {
  id: string;
  initials: string;
  /** The edition its own title names, e.g. "Premium"; null when none. */
  edition: string | null;
}

export interface LineupPinballMapOnlyRow {
  section: "pinball_map_only";
  key: string;
  lmxId: number;
  title: LineupTitleRef;
  commentCount: number;
  /** Named, never matched (§5.4, pinballmap §2.2). */
  possibleMatches: readonly LineupPossibleMatch[];
}

/** Alert for an invalid availability, Note for an advise-tier one (§5.5). */
export type LineupConflictTag = "alert" | "note";

export interface LineupConflictRow {
  section: "availability_conflict";
  key: string;
  tag: LineupConflictTag;
  title: LineupTitleRef;
  machine: LineupCabinet;
  /** The entry's comment count; null when the title is not on Pinball Map. */
  commentCount: number | null;
}

export type LineupRow =
  | LineupOutOfSyncRow
  | LineupPinpointOnlyRow
  | LineupPinballMapOnlyRow
  | LineupConflictRow;

export interface LineupSections {
  out_of_sync: readonly LineupOutOfSyncRow[];
  pinpoint_only: readonly LineupPinpointOnlyRow[];
  pinball_map_only: readonly LineupPinballMapOnlyRow[];
  availability_conflict: readonly LineupConflictRow[];
}

/** A title PinPoint and Pinball Map agree on (§6.1). */
export interface LineupInSyncTitle {
  key: string;
  title: LineupTitleRef;
  cabinets: readonly LineupCabinet[];
  onPinballMap: boolean;
  commentCount: number | null;
}

/** A machine named in the not-compared footer (§6.2). */
export interface LineupMachineRef {
  id: string;
  initials: string;
  name: string;
}

export interface LineupInsiderConnectedSummary {
  /** Eligible titles on the lineup no PinPoint cabinet has an intent for. */
  titles: number;
  onPinballMap: Record<PbmInsiderConnectedSetting, number>;
}

export interface LineupReady {
  status: "ready";
  sections: LineupSections;
  /** Rows across all four sections (§4.1). */
  toReview: number;
  inSync: readonly LineupInSyncTitle[];
  notCompared: {
    uncataloged: readonly LineupMachineRef[];
    /** Titles, and unmatched machines, set to Don't sync. */
    dontSync: number;
    /** Removed machines no section names. */
    removed: number;
  };
  insiderConnected: LineupInsiderConnectedSummary;
}

export type LineupComparison =
  { status: "not_configured" } | { status: "waiting" } | LineupReady;

/**
 * Title intent (§1): On when any cabinet is On; Off when none is On and one
 * is Off; Don't sync when every cabinet is Don't sync.
 */
export function deriveTitleIntent(
  intents: readonly PbmListingIntent[]
): LineupTitleIntent {
  if (intents.includes("on")) return "on";
  if (intents.includes("off")) return "off";
  return "no_sync";
}

/**
 * The machine is set On the lineup but is not on the floor (§5.5). Only a
 * matched cabinet can be On the lineup, so an unmatched one never qualifies.
 */
function inAvailabilityConflict(machine: LineupMachineInput): boolean {
  return (
    machine.pinballmapMachineId !== null &&
    machine.intent === "on" &&
    machine.presenceStatus !== "on_the_floor"
  );
}

/** The "to review" count the page and the `/m` badge share (§4.1). */
export function lineupToReviewCount(comparison: LineupComparison): number {
  return comparison.status === "ready" ? comparison.toReview : 0;
}

/** "Premium" from "Jurassic Park (Premium)"; null when the name has none. */
function editionOf(name: string): string | null {
  const match = /\(([^()]+)\)\s*$/.exec(name);
  return match?.[1]?.trim() ?? null;
}

const TAG_ORDER: Record<LineupOutOfSyncTag, number> = {
  to_add: 0,
  to_remove: 1,
  to_update: 2,
};

export function compareLineup(args: {
  configured: boolean;
  snapshot: LocationSnapshot | null;
  machines: readonly LineupMachineInput[];
  catalog: readonly LineupCatalogTitle[];
}): LineupComparison {
  const { configured, snapshot, machines } = args;
  // Not configured: retained state is dormant and never rendered as current
  // (§2.4). Waiting: configured, no lineup yet — no evidence to compare (§2.5).
  if (!configured) return { status: "not_configured" };
  if (snapshot === null) return { status: "waiting" };

  const catalogById = new Map(
    args.catalog.map((row) => [row.pinballmapMachineId, row])
  );
  const titleRef = (id: number): LineupTitleRef => {
    const row = catalogById.get(id);
    return {
      id,
      // The catalog can lose a title the lineup still carries; name the entry
      // by id rather than inventing a name.
      name: row?.name ?? `Pinball Map title #${String(id)}`,
      manufacturer: row?.manufacturer ?? null,
      year: row?.year ?? null,
    };
  };
  const cabinet = (m: LineupMachineInput): LineupCabinet => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
    presenceStatus: m.presenceStatus,
    intent: m.intent,
  });
  const byName = (
    a: { title: LineupTitleRef },
    b: { title: LineupTitleRef }
  ): number => a.title.name.localeCompare(b.title.name);

  const byTitle = new Map<number, LineupMachineInput[]>();
  for (const machine of machines) {
    if (machine.pinballmapMachineId === null) continue;
    const group = byTitle.get(machine.pinballmapMachineId) ?? [];
    group.push(machine);
    byTitle.set(machine.pinballmapMachineId, group);
  }

  const outOfSync: LineupOutOfSyncRow[] = [];
  const conflicts: LineupConflictRow[] = [];
  const inSync: LineupInSyncTitle[] = [];
  const named = new Set<string>();
  let dontSync = 0;
  const icSummary: LineupInsiderConnectedSummary = {
    titles: 0,
    onPinballMap: { on: 0, off: 0, not_set: 0 },
  };
  const noteUnsetInsiderConnected = (lmx: PbmLmx): void => {
    if (catalogById.get(lmx.machineId)?.icEligible !== true) return;
    icSummary.titles += 1;
    const setting: PbmInsiderConnectedSetting =
      lmx.icEnabled === null ? "not_set" : lmx.icEnabled ? "on" : "off";
    icSummary.onPinballMap[setting] += 1;
  };

  for (const [titleId, cabinetsIn] of byTitle) {
    const lmx = findLmxForMachine(snapshot, titleId);
    const title = titleRef(titleId);
    const commentCount = lmx?.conditions.length ?? null;

    // Each machine set On while not on the floor is its own row (§5.5), and
    // only the rest decide the title intent (§5.2).
    for (const machine of cabinetsIn.filter(inAvailabilityConflict)) {
      named.add(machine.id);
      conflicts.push({
        section: "availability_conflict",
        key: `conflict-${machine.id}`,
        tag: INVALID_WHEN_ON.includes(machine.presenceStatus)
          ? "alert"
          : "note",
        title,
        machine: cabinet(machine),
        commentCount,
      });
    }
    const counted = cabinetsIn.filter((m) => !inAvailabilityConflict(m));
    // The page compares machines not marked Removed; Removed cabinets decide
    // the title only when nothing else is left, which is how a title whose
    // only cabinets are Removed still reaches To remove (§1 In scope, §5.2).
    const inScope = counted.filter((m) => m.presenceStatus !== "removed");
    const basis = inScope.length > 0 ? inScope : counted;
    if (basis.length === 0) continue;
    const removedOnly = inScope.length === 0;

    const titleIntent = deriveTitleIntent(basis.map((m) => m.intent));
    const cabinets = basis
      .map(cabinet)
      .sort((a, b) => a.initials.localeCompare(b.initials));
    if (titleIntent === "no_sync") {
      if (!removedOnly) dontSync += 1;
      continue;
    }

    const target = insiderConnectedTarget(cabinetsIn.map((m) => m.icIntent));
    if (lmx !== null && target === null) noteUnsetInsiderConnected(lmx);

    const pushRow = (tag: LineupOutOfSyncTag): void => {
      for (const m of basis) named.add(m.id);
      outOfSync.push({
        section: "out_of_sync",
        key: `${tag}-${String(titleId)}`,
        tag,
        title,
        cabinets,
        commentCount,
        icTarget: target,
      });
    };

    if (titleIntent === "off") {
      if (lmx !== null) pushRow("to_remove");
      else if (!removedOnly)
        inSync.push({
          key: `sync-${String(titleId)}`,
          title,
          cabinets,
          onPinballMap: false,
          commentCount: null,
        });
      continue;
    }

    // Title intent On: every counted On cabinet is on the floor.
    if (lmx === null) {
      pushRow("to_add");
      continue;
    }
    // Same-title cabinets share one entry and one target, so any counted On
    // cabinet's Insider Connected view answers for the title (pinballmap §3.8).
    const representative = basis.find((m) => m.intent === "on");
    const ic =
      representative === undefined
        ? null
        : deriveInsiderConnectedView({
            listing: derivePbmListingView({
              machineId: representative.id,
              pinballmapMachineId: titleId,
              pinballmapExcluded: representative.pinballmapExcluded,
              intent: representative.intent,
              presenceStatus: representative.presenceStatus,
              configured: true,
              snapshot,
              siblings: cabinetsIn.map(({ id, initials, name, intent }) => ({
                id,
                initials,
                name,
                intent,
              })),
            }),
            pinballmapMachineId: titleId,
            icEligible: catalogById.get(titleId)?.icEligible ?? false,
            intent: representative.icIntent,
            siblingIntents: cabinetsIn.map((m) => m.icIntent),
            snapshot,
          });
    if (ic?.differs === true) {
      pushRow("to_update");
      continue;
    }
    inSync.push({
      key: `sync-${String(titleId)}`,
      title,
      cabinets,
      onPinballMap: true,
      commentCount,
    });
  }

  // Machines of the family an unmatched entry belongs to, by group id.
  const familyMembers = new Map<number, LineupPossibleMatch[]>();
  for (const machine of machines) {
    if (
      machine.pinballmapMachineId === null ||
      machine.presenceStatus === "removed"
    )
      continue;
    const row = catalogById.get(machine.pinballmapMachineId);
    if (row?.machineGroupId == null) continue;
    const members = familyMembers.get(row.machineGroupId) ?? [];
    members.push({
      id: machine.id,
      initials: machine.initials,
      edition: editionOf(row.name),
    });
    familyMembers.set(row.machineGroupId, members);
  }

  const pinballMapOnly: LineupPinballMapOnlyRow[] = [];
  for (const lmx of snapshot.lmxes) {
    if (byTitle.has(lmx.machineId)) continue;
    noteUnsetInsiderConnected(lmx);
    const groupId = catalogById.get(lmx.machineId)?.machineGroupId ?? null;
    pinballMapOnly.push({
      section: "pinball_map_only",
      key: `entry-${String(lmx.id)}`,
      lmxId: lmx.id,
      title: titleRef(lmx.machineId),
      commentCount: lmx.conditions.length,
      possibleMatches:
        groupId === null
          ? []
          : [...(familyMembers.get(groupId) ?? [])].sort((a, b) =>
              a.initials.localeCompare(b.initials)
            ),
    });
  }

  const pinpointOnly: LineupPinpointOnlyRow[] = [];
  const uncataloged: LineupMachineRef[] = [];
  for (const machine of machines) {
    if (machine.pinballmapMachineId !== null) continue;
    if (machine.presenceStatus === "removed") continue;
    if (machine.pinballmapExcluded) {
      uncataloged.push({
        id: machine.id,
        initials: machine.initials,
        name: machine.name,
      });
    } else if (machine.intent === "no_sync") {
      dontSync += 1;
    } else {
      named.add(machine.id);
      pinpointOnly.push({
        section: "pinpoint_only",
        key: `machine-${machine.id}`,
        machine: cabinet(machine),
      });
    }
  }

  const sections: LineupSections = {
    out_of_sync: outOfSync.sort(
      (a, b) => TAG_ORDER[a.tag] - TAG_ORDER[b.tag] || byName(a, b)
    ),
    pinpoint_only: pinpointOnly.sort((a, b) =>
      a.machine.name.localeCompare(b.machine.name)
    ),
    // Rows that name possible matches lead: they are the likeliest to resolve
    // by linking rather than by adding or removing.
    pinball_map_only: pinballMapOnly.sort(
      (a, b) =>
        Number(b.possibleMatches.length > 0) -
          Number(a.possibleMatches.length > 0) || byName(a, b)
    ),
    availability_conflict: conflicts.sort(
      (a, b) =>
        Number(a.tag === "note") - Number(b.tag === "note") ||
        byName(a, b) ||
        a.machine.initials.localeCompare(b.machine.initials)
    ),
  };

  return {
    status: "ready",
    sections,
    toReview: LINEUP_SECTIONS.reduce(
      (sum, key) => sum + sections[key].length,
      0
    ),
    inSync: inSync.sort(byName),
    notCompared: {
      uncataloged: uncataloged.sort((a, b) =>
        a.initials.localeCompare(b.initials)
      ),
      dontSync,
      removed: machines.filter(
        (m) => m.presenceStatus === "removed" && !named.has(m.id)
      ).length,
    },
    insiderConnected: icSummary,
  };
}
