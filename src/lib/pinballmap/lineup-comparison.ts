import type { MachinePresenceStatus } from "~/lib/machines/presence";

import {
  deriveInsiderConnectedView,
  insiderConnectedTarget,
  type PbmIcIntent,
  type PbmInsiderConnectedSetting,
} from "./insider-connected";
import {
  derivePbmListingView,
  type PbmListingIntent,
  type PbmListingStateName,
  type PbmListingView,
} from "./listing-state";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot, PbmLmx } from "./types";

/**
 * The Pinball Map lineup page's comparison (`docs/feature-specs/pinballmap-
 * lineup.md`, PP-o355.65): every title PinPoint knows about, compared with the
 * tracked location's stored lineup and sorted into the group whose action
 * resolves it.
 *
 * **Per-cabinet rules are not re-derived here.** Each cabinet still goes
 * through `derivePbmListingView` / `deriveInsiderConnectedView`, the same
 * derivation the listing control renders, and this module only folds those
 * cabinet views into one verdict per title. A second copy of the Alert or
 * Insider Connected rules would be a second place for them to drift.
 *
 * Pure — no DB, no `server-only` — so the page, the `/m` header badge and the
 * unit tests all call it directly, and it never reaches pinballmap.com
 * (CORE-PBM-001, lineup spec §2.3).
 */

/** PinPoint's position on one title (lineup spec §1, Title intent). */
export type LineupTitleIntent = PbmListingIntent;

/** A matrix row: a title intent, or "none" for an entry no machine matches. */
export type LineupMatrixRow = LineupTitleIntent | "none";

/** A matrix column: observed lineup presence. */
export type LineupPresence = "on_pbm" | "not_on_pbm";

export type LineupCellId = `${LineupMatrixRow}:${LineupPresence}`;

export const LINEUP_MATRIX_ROWS: readonly LineupMatrixRow[] = [
  "on",
  "off",
  "none",
  "no_sync",
];

export const LINEUP_CELL_IDS: readonly LineupCellId[] =
  LINEUP_MATRIX_ROWS.flatMap((row) => [
    `${row}:on_pbm` as const,
    `${row}:not_on_pbm` as const,
  ]);

/**
 * The one cell no title can occupy: a title no machine is matched to is only
 * known at all because the lineup carries it (§4.3).
 */
export const IMPOSSIBLE_CELL: LineupCellId = "none:not_on_pbm";

/** How a matrix cell is styled (§4.3). */
export type LineupCellTone = "in_sync" | "difference" | "neutral" | "empty";

export function lineupCellTone(cell: LineupCellId): LineupCellTone {
  switch (cell) {
    case "on:on_pbm":
    case "off:not_on_pbm":
      return "in_sync";
    case "on:not_on_pbm":
    case "off:on_pbm":
    case "none:on_pbm":
      return "difference";
    case "no_sync:on_pbm":
    case "no_sync:not_on_pbm":
      return "neutral";
    case "none:not_on_pbm":
      return "empty";
  }
}

export function isLineupCellId(value: string): value is LineupCellId {
  return LINEUP_CELL_IDS.some((cell) => cell === value);
}

/** The groups a row can land in (§1, §5). In sync is not a row group. */
export type LineupFixGroup =
  "to_add" | "to_remove" | "to_update" | "needs_decision" | "worth_a_look";

/** Fixed render order (§5.1). */
export const LINEUP_FIX_GROUPS: readonly LineupFixGroup[] = [
  "to_add",
  "to_remove",
  "to_update",
  "needs_decision",
  "worth_a_look",
];

/** Worth a look is not a difference and is not counted (§5.6, §4.1). */
export function isDifferenceGroup(group: LineupFixGroup): boolean {
  return group !== "worth_a_look";
}

/** Why a row is in its group — the reason, not the copy. */
export type LineupRowReason =
  /** Title intent On, not on Pinball Map (§5.2). */
  | "missing"
  /** Title intent Off, still on Pinball Map (§5.3, Lingering). */
  | "lingering"
  /** An entry a re-matched machine walked away from (§5.3, pinballmap §2.5). */
  | "left_behind"
  /** An entry recorded at a previously tracked location (§5.3, §10.11). */
  | "previous_location"
  /** On Pinball Map, title intent On, Insider Connected differs (§5.4). */
  | "ic_differs"
  /** An On cabinet's availability disallows the lineup (§5.5, Alert). */
  | "alert"
  /** A Missing title paired with a same-family unmatched entry (§5.5). */
  | "edition_near_miss"
  /** An entry whose title no PinPoint machine is matched to (§5.5). */
  | "unmatched_entry"
  /** An On cabinet with an advise-tier availability (§5.6, Flag). */
  | "flag";

export const LINEUP_REASON_GROUP: Record<LineupRowReason, LineupFixGroup> = {
  missing: "to_add",
  lingering: "to_remove",
  left_behind: "to_remove",
  previous_location: "to_remove",
  ic_differs: "to_update",
  alert: "needs_decision",
  edition_near_miss: "needs_decision",
  unmatched_entry: "needs_decision",
  flag: "worth_a_look",
};

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

/** One abandoned-entry record (pinballmap §2.5, §10.11). */
export interface LineupAbandonedRecord {
  machineId: string;
  lmxId: number;
  pinballmapMachineId: number;
  locationId: number;
}

/** A title as the page names it. */
export interface LineupTitleRef {
  id: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

/** A PinPoint cabinet involved in a row, with its intent and availability. */
export interface LineupCabinet {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  intent: PbmListingIntent;
  /** This cabinet's own listing-control state. */
  state: PbmListingStateName;
  /** Availability advisory (Alert / Flag), including Missing's borrowed Alert. */
  advisory: PbmListingView["advisory"];
}

/** A machine named outside any title (not compared, left behind). */
export interface LineupMachineRef {
  id: string;
  initials: string;
  name: string;
}

interface LineupRowBase {
  key: string;
  title: LineupTitleRef;
  /** Every PinPoint cabinet matched to the title; empty for an orphan entry. */
  cabinets: readonly LineupCabinet[];
  /** The entry's comment count; null when not on the lineup or unknown. */
  commentCount: number | null;
  /** The matrix cells this row's titles occupy, for cell filtering (§4.4). */
  cells: readonly LineupCellId[];
}

export type LineupRow =
  | (LineupRowBase & {
      reason: "missing";
      /** What an Add also sets Insider Connected to (pinballmap §4.3). */
      icTarget: PbmIcIntent | null;
    })
  | (LineupRowBase & { reason: "lingering"; lmxId: number })
  | (LineupRowBase & {
      reason: "left_behind" | "previous_location";
      /** The recorded entry id — the one the removal action authorizes. */
      lmxId: number;
      locationId: number;
      abandonedBy: LineupMachineRef;
    })
  | (LineupRowBase & {
      reason: "ic_differs";
      lmxId: number;
      icTarget: PbmIcIntent;
      icOnPinballMap: PbmInsiderConnectedSetting;
    })
  | (LineupRowBase & { reason: "alert"; lmxId: number | null })
  | (LineupRowBase & {
      reason: "edition_near_miss";
      /** The unmatched same-family entry the Missing title pairs with. */
      entry: { lmxId: number; title: LineupTitleRef; commentCount: number };
    })
  | (LineupRowBase & { reason: "unmatched_entry"; lmxId: number })
  | (LineupRowBase & { reason: "flag"; lmxId: number });

/** A title outside the fix groups: in sync, or set to Don't sync. */
export interface LineupTitleSummary {
  key: string;
  title: LineupTitleRef;
  cabinets: readonly LineupCabinet[];
  commentCount: number | null;
  cell: LineupCellId;
}

export interface LineupInsiderConnectedSummary {
  /** Eligible titles on the lineup with no PinPoint intent (§6.3). */
  titles: number;
  onPinballMap: Record<PbmInsiderConnectedSetting, number>;
}

export interface LineupReady {
  status: "ready";
  /** Titles per cell; null for the impossible cell (§4.3). */
  matrix: Record<LineupCellId, number | null>;
  /** Every fix-group row, in group order then title order (§5.1). */
  rows: readonly LineupRow[];
  groupCounts: Record<LineupFixGroup, number>;
  /** Rows in the four difference groups (§4.1). */
  differenceCount: number;
  inSync: readonly LineupTitleSummary[];
  notCompared: {
    dontSync: readonly LineupTitleSummary[];
    uncataloged: readonly LineupMachineRef[];
    /** No catalog match, still in the collection — linked for matching. */
    unmatched: readonly LineupMachineRef[];
    /** No catalog match, availability Removed — kept apart (§6.2). */
    unmatchedRemoved: readonly LineupMachineRef[];
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

export function compareLineup(args: {
  configured: boolean;
  trackedLocationId: number | null;
  snapshot: LocationSnapshot | null;
  machines: readonly LineupMachineInput[];
  catalog: readonly LineupCatalogTitle[];
  abandoned: readonly LineupAbandonedRecord[];
}): LineupComparison {
  const { configured, trackedLocationId, snapshot, machines, abandoned } = args;
  // Not configured: retained state is dormant and never rendered as current
  // (§2.4). Waiting: configured, no lineup yet — no evidence to compare (§2.5).
  if (!configured || trackedLocationId === null)
    return { status: "not_configured" };
  if (snapshot === null) return { status: "waiting" };

  const catalogById = new Map(
    args.catalog.map((row) => [row.pinballmapMachineId, row])
  );
  const machinesById = new Map(machines.map((m) => [m.id, m]));
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

  const byTitle = new Map<number, LineupMachineInput[]>();
  for (const machine of machines) {
    if (machine.pinballmapMachineId === null) continue;
    const group = byTitle.get(machine.pinballmapMachineId) ?? [];
    group.push(machine);
    byTitle.set(machine.pinballmapMachineId, group);
  }

  const matrix: Record<LineupCellId, number | null> = {
    "on:on_pbm": 0,
    "on:not_on_pbm": 0,
    "off:on_pbm": 0,
    "off:not_on_pbm": 0,
    "none:on_pbm": 0,
    "none:not_on_pbm": null,
    "no_sync:on_pbm": 0,
    "no_sync:not_on_pbm": 0,
  };
  const count = (cell: LineupCellId): void => {
    matrix[cell] = (matrix[cell] ?? 0) + 1;
  };

  const rows: LineupRow[] = [];
  const inSync: LineupTitleSummary[] = [];
  const dontSync: LineupTitleSummary[] = [];
  const icSummary: LineupInsiderConnectedSummary = {
    titles: 0,
    onPinballMap: { on: 0, off: 0, not_set: 0 },
  };
  const noteUnsetInsiderConnected = (
    titleId: number,
    lmx: PbmLmx,
    target: PbmIcIntent | null
  ): void => {
    if (target !== null || catalogById.get(titleId)?.icEligible !== true)
      return;
    icSummary.titles += 1;
    const setting: PbmInsiderConnectedSetting =
      lmx.icEnabled === null ? "not_set" : lmx.icEnabled ? "on" : "off";
    icSummary.onPinballMap[setting] += 1;
  };

  // Titles with title intent On that are not on Pinball Map, held back until
  // the unmatched entries are known so an edition near-miss can claim them.
  const missing: {
    titleId: number;
    cabinets: LineupCabinet[];
    icTarget: PbmIcIntent | null;
    /** An On cabinet's availability disallows the lineup (Alert). */
    alert: boolean;
  }[] = [];

  for (const [titleId, cabinetsIn] of byTitle) {
    const lmx = findLmxForMachine(snapshot, titleId);
    const observed = lmx !== null;
    const siblings = cabinetsIn.map(({ id, initials, name, intent }) => ({
      id,
      initials,
      name,
      intent,
    }));
    const views = cabinetsIn.map((machine) => ({
      machine,
      view: derivePbmListingView({
        machineId: machine.id,
        pinballmapMachineId: titleId,
        pinballmapExcluded: machine.pinballmapExcluded,
        intent: machine.intent,
        presenceStatus: machine.presenceStatus,
        configured: true,
        snapshot,
        siblings,
      }),
    }));
    const cabinets: LineupCabinet[] = views.map(({ machine, view }) =>
      toCabinet(machine, view)
    );
    const titleIntent = deriveTitleIntent(cabinetsIn.map((m) => m.intent));
    const cell: LineupCellId = `${titleIntent}:${observed ? "on_pbm" : "not_on_pbm"}`;
    count(cell);

    const title = titleRef(titleId);
    const commentCount = lmx?.conditions.length ?? null;
    const summary: LineupTitleSummary = {
      key: `title-${String(titleId)}`,
      title,
      cabinets,
      commentCount,
      cell,
    };
    const icTarget = insiderConnectedTarget(cabinetsIn.map((m) => m.icIntent));

    if (titleIntent === "no_sync") {
      dontSync.push(summary);
      continue;
    }
    if (lmx !== null) noteUnsetInsiderConnected(titleId, lmx, icTarget);

    const onViews = views.filter(({ machine }) => machine.intent === "on");
    const alert = onViews.some(({ view }) => view.advisory === "alert");
    const base = { title, cabinets, commentCount, cells: [cell] } as const;

    if (titleIntent === "off") {
      if (lmx === null) inSync.push(summary);
      else
        rows.push({
          ...base,
          key: `lingering-${String(titleId)}`,
          reason: "lingering",
          lmxId: lmx.id,
        });
      continue;
    }

    // Title intent On from here.
    if (lmx === null) {
      missing.push({ titleId, cabinets, icTarget, alert });
      continue;
    }
    if (alert) {
      rows.push({
        ...base,
        key: `alert-${String(titleId)}`,
        reason: "alert",
        lmxId: lmx.id,
      });
      continue;
    }
    // Every On cabinet shares one entry and one target, so any On cabinet's
    // Insider Connected view answers for the title (pinballmap §3.8).
    const representative = onViews[0];
    const ic =
      representative === undefined
        ? null
        : deriveInsiderConnectedView({
            listing: representative.view,
            pinballmapMachineId: titleId,
            icEligible: catalogById.get(titleId)?.icEligible ?? false,
            intent: representative.machine.icIntent,
            siblingIntents: cabinetsIn.map((m) => m.icIntent),
            snapshot,
          });
    if (ic?.differs === true && ic.target !== null && ic.pinballMap !== null) {
      rows.push({
        ...base,
        key: `ic-${String(titleId)}`,
        reason: "ic_differs",
        lmxId: lmx.id,
        icTarget: ic.target,
        icOnPinballMap: ic.pinballMap,
      });
      continue;
    }
    if (onViews.some(({ view }) => view.advisory === "flag")) {
      rows.push({
        ...base,
        key: `flag-${String(titleId)}`,
        reason: "flag",
        lmxId: lmx.id,
      });
      continue;
    }
    inSync.push(summary);
  }

  // Entries on this lineup whose title no machine is matched to (§1). Each is
  // counted once in the no-PinPoint-machine column (§4.2), whatever group it
  // lands in.
  const unmatchedEntries = snapshot.lmxes
    .filter((lmx) => !byTitle.has(lmx.machineId))
    .sort((a, b) => a.id - b.id);
  const sameLocation = abandoned.filter(
    (record) => record.locationId === trackedLocationId
  );
  const leftBehind = new Map<number, LineupAbandonedRecord>();
  for (const lmx of unmatchedEntries) {
    count("none:on_pbm");
    // By id first; by title when Pinball Map has reissued the id under a live
    // entry, which is the case `clearResolvedAbandonments` holds records open
    // for.
    const record =
      sameLocation.find((r) => r.lmxId === lmx.id) ??
      sameLocation.find((r) => r.pinballmapMachineId === lmx.machineId);
    if (record !== undefined) leftBehind.set(lmx.id, record);
  }

  const abandonedBy = (record: LineupAbandonedRecord): LineupMachineRef => {
    const machine = machinesById.get(record.machineId);
    return {
      id: record.machineId,
      initials: machine?.initials ?? "",
      name: machine?.name ?? "A removed machine",
    };
  };

  for (const lmx of unmatchedEntries) {
    const record = leftBehind.get(lmx.id);
    if (record === undefined) continue;
    rows.push({
      key: `left-${String(lmx.id)}`,
      reason: "left_behind",
      title: titleRef(lmx.machineId),
      cabinets: [],
      commentCount: lmx.conditions.length,
      cells: ["none:on_pbm"],
      lmxId: record.lmxId,
      locationId: record.locationId,
      abandonedBy: abandonedBy(record),
    });
  }

  // Edition near-miss (§5.5): a Missing title and an unmatched entry in the same
  // title family are one decision, shown as one row. Left-behind entries are not
  // candidates — someone already chose the new edition when they re-matched,
  // and the old entry's cleanup is its own action (pinballmap §2.5).
  const candidates = unmatchedEntries.filter((lmx) => !leftBehind.has(lmx.id));
  const paired = new Set<number>();
  for (const item of missing.sort((a, b) =>
    titleRef(a.titleId).name.localeCompare(titleRef(b.titleId).name)
  )) {
    const title = titleRef(item.titleId);
    const cell: LineupCellId = "on:not_on_pbm";
    const groupId = catalogById.get(item.titleId)?.machineGroupId ?? null;
    const entry =
      groupId === null
        ? undefined
        : candidates.find(
            (lmx) =>
              !paired.has(lmx.id) &&
              catalogById.get(lmx.machineId)?.machineGroupId === groupId
          );
    if (entry !== undefined) {
      paired.add(entry.id);
      rows.push({
        key: `near-miss-${String(item.titleId)}`,
        reason: "edition_near_miss",
        title,
        cabinets: item.cabinets,
        commentCount: null,
        cells: [cell, "none:on_pbm"],
        entry: {
          lmxId: entry.id,
          title: titleRef(entry.machineId),
          commentCount: entry.conditions.length,
        },
      });
      continue;
    }
    rows.push(
      item.alert
        ? {
            key: `alert-${String(item.titleId)}`,
            reason: "alert",
            title,
            cabinets: item.cabinets,
            commentCount: null,
            cells: [cell],
            lmxId: null,
          }
        : {
            key: `missing-${String(item.titleId)}`,
            reason: "missing",
            title,
            cabinets: item.cabinets,
            commentCount: null,
            cells: [cell],
            icTarget: item.icTarget,
          }
    );
  }

  for (const lmx of candidates) {
    if (paired.has(lmx.id)) continue;
    noteUnsetInsiderConnected(lmx.machineId, lmx, null);
    rows.push({
      key: `unmatched-${String(lmx.id)}`,
      reason: "unmatched_entry",
      title: titleRef(lmx.machineId),
      cabinets: [],
      commentCount: lmx.conditions.length,
      cells: ["none:on_pbm"],
      lmxId: lmx.id,
    });
  }

  // Entries recorded at a location PinPoint no longer tracks (§5.3). Not on this
  // lineup, so they count in no cell (§4.2), and their comment count is not
  // known from this location's snapshot.
  for (const record of abandoned) {
    if (record.locationId === trackedLocationId) continue;
    rows.push({
      key: `previous-${String(record.lmxId)}`,
      reason: "previous_location",
      title: titleRef(record.pinballmapMachineId),
      cabinets: [],
      commentCount: null,
      cells: [],
      lmxId: record.lmxId,
      locationId: record.locationId,
      abandonedBy: abandonedBy(record),
    });
  }

  const groupRank = new Map(LINEUP_FIX_GROUPS.map((g, i) => [g, i]));
  const rank = (row: LineupRow): number =>
    groupRank.get(LINEUP_REASON_GROUP[row.reason]) ?? 0;
  rows.sort(
    (a, b) => rank(a) - rank(b) || a.title.name.localeCompare(b.title.name)
  );
  const byName = (a: LineupTitleSummary, b: LineupTitleSummary): number =>
    a.title.name.localeCompare(b.title.name);

  const groupCounts: Record<LineupFixGroup, number> = {
    to_add: 0,
    to_remove: 0,
    to_update: 0,
    needs_decision: 0,
    worth_a_look: 0,
  };
  for (const row of rows) groupCounts[LINEUP_REASON_GROUP[row.reason]] += 1;
  const differenceCount = LINEUP_FIX_GROUPS.filter(isDifferenceGroup).reduce(
    (sum, group) => sum + groupCounts[group],
    0
  );

  const ref = (m: LineupMachineInput): LineupMachineRef => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
  });
  const byInitials = (a: LineupMachineRef, b: LineupMachineRef): number =>
    a.initials.localeCompare(b.initials);
  const unmatchedMachines = machines.filter(
    (m) => m.pinballmapMachineId === null && !m.pinballmapExcluded
  );

  return {
    status: "ready",
    matrix,
    rows,
    groupCounts,
    differenceCount,
    inSync: inSync.sort(byName),
    notCompared: {
      dontSync: dontSync.sort(byName),
      uncataloged: machines
        .filter((m) => m.pinballmapExcluded)
        .map(ref)
        .sort(byInitials),
      unmatched: unmatchedMachines
        .filter((m) => m.presenceStatus !== "removed")
        .map(ref)
        .sort(byInitials),
      unmatchedRemoved: unmatchedMachines
        .filter((m) => m.presenceStatus === "removed")
        .map(ref)
        .sort(byInitials),
    },
    insiderConnected: icSummary,
  };
}

function toCabinet(
  machine: LineupMachineInput,
  view: PbmListingView
): LineupCabinet {
  return {
    id: machine.id,
    initials: machine.initials,
    name: machine.name,
    presenceStatus: machine.presenceStatus,
    intent: machine.intent,
    state: view.name,
    advisory: view.advisory,
  };
}
