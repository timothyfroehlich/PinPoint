import "server-only";

import { and, asc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { machineViewDefaults, machineViewSavedViews } from "~/server/db/schema";
import { err, ok, type Result } from "~/lib/result";
import type {
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSavedViewSummary,
} from "~/lib/types";
import {
  getMachineViewBuiltInViews,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "./config";
import {
  hasMachineViewConfiguration,
  savedMachineViewSearchParams,
  type MachineViewSearchParams,
} from "./state";

/**
 * The stored identity of a Surface (spec §1): which of the table's surface
 * columns a Saved View row carries.
 */
export type SavedMachineViewSurfaceKey =
  | { surface: "machines" }
  | { surface: "collection"; collectionId: string }
  | { surface: "owner"; ownerCollectionUserId: string };

/** Longest Saved View name accepted. */
export const SAVED_MACHINE_VIEW_NAME_MAX = 60;

type SurfaceColumns = Pick<
  typeof machineViewSavedViews | typeof machineViewDefaults,
  "surface" | "collectionId" | "ownerCollectionUserId"
>;

function surfaceWhere(key: SavedMachineViewSurfaceKey): SQL | undefined {
  return surfaceWhereOn(machineViewSavedViews, key);
}

function defaultSurfaceWhere(key: SavedMachineViewSurfaceKey): SQL | undefined {
  return surfaceWhereOn(machineViewDefaults, key);
}

function surfaceWhereOn(
  t: SurfaceColumns,
  key: SavedMachineViewSurfaceKey
): SQL | undefined {
  switch (key.surface) {
    case "machines":
      return and(
        eq(t.surface, "machines"),
        isNull(t.collectionId),
        isNull(t.ownerCollectionUserId)
      );
    case "collection":
      return and(
        eq(t.surface, "collection"),
        eq(t.collectionId, key.collectionId)
      );
    case "owner":
      return and(
        eq(t.surface, "owner"),
        eq(t.ownerCollectionUserId, key.ownerCollectionUserId)
      );
  }
}

function surfaceColumns(key: SavedMachineViewSurfaceKey): {
  surface: SavedMachineViewSurfaceKey["surface"];
  collectionId: string | null;
  ownerCollectionUserId: string | null;
} {
  switch (key.surface) {
    case "machines":
      return {
        surface: "machines",
        collectionId: null,
        ownerCollectionUserId: null,
      };
    case "collection":
      return {
        surface: "collection",
        collectionId: key.collectionId,
        ownerCollectionUserId: null,
      };
    case "owner":
      return {
        surface: "owner",
        collectionId: null,
        ownerCollectionUserId: key.ownerCollectionUserId,
      };
  }
}

/** The account's Saved Views on one Surface, ordered by name (spec §8.5). */
export async function listSavedMachineViews(
  tx: DbTransaction,
  userId: string,
  key: SavedMachineViewSurfaceKey
): Promise<MachineViewSavedViewSummary[]> {
  const t = machineViewSavedViews;
  return tx
    .select({
      id: t.id,
      name: t.name,
      state: t.state,
    })
    .from(t)
    .where(and(eq(t.userId, userId), surfaceWhere(key)))
    .orderBy(asc(sql`lower(${t.name})`), asc(t.id));
}

/** The account's default on one Surface (spec §8.10), or null. */
export async function getMachineViewDefault(
  tx: DbTransaction,
  userId: string,
  key: SavedMachineViewSurfaceKey
): Promise<string | null> {
  const d = machineViewDefaults;
  const [row] = await tx
    .select({ savedViewId: d.savedViewId, builtInViewId: d.builtInViewId })
    .from(d)
    .where(and(eq(d.userId, userId), defaultSurfaceWhere(key)))
    .limit(1);
  return row?.savedViewId ?? row?.builtInViewId ?? null;
}

export interface SavedMachineViewRequest {
  /** The validated `view` reference (spec §4.11), or null. */
  activeViewId: string | null;
  /** Where to send a configuration-free URL that has a default (§8.11–8.12). */
  redirectTo: string | null;
}

/**
 * Decides how a Surface URL relates to the viewer's views. A URL with no view
 * configuration other than `page` opens the account's default at its
 * canonical URL (spec §8.11, §8.12); any other URL opens as written. `view`
 * is kept only when it names an owned Saved View or one of this preset's
 * Built-in Views (§4.11).
 */
export function resolveSavedMachineViewRequest({
  views,
  defaultViewId,
  preset,
  searchParams,
  pathname,
}: {
  views: MachineViewSavedViewSummary[];
  defaultViewId: string | null;
  preset: MachineViewPresetId;
  searchParams: MachineViewSearchParams;
  pathname: string;
}): SavedMachineViewRequest {
  const builtIns = getMachineViewBuiltInViews(preset);
  const find = (
    id: string | null
  ): { id: string; state: MachineViewSavedState } | null =>
    id === null
      ? null
      : (views.find((view) => view.id === id) ??
        builtIns.find((view) => view.id === id) ??
        null);

  if (!hasMachineViewConfiguration(searchParams)) {
    const defaultView = find(defaultViewId);
    if (!defaultView) return { activeViewId: null, redirectTo: null };
    // The bare URL already shows the Page Preset, which no `view` names.
    if (defaultView.id === MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset]) {
      return { activeViewId: null, redirectTo: null };
    }
    const params = savedMachineViewSearchParams(
      defaultView.state,
      preset,
      defaultView.id
    );
    const page = searchParams.get("page");
    if (page !== null) params.set("page", page);
    return {
      activeViewId: defaultView.id,
      redirectTo: `${pathname}?${params.toString()}`,
    };
  }
  return {
    activeViewId: find(searchParams.get("view"))?.id ?? null,
    redirectTo: null,
  };
}

export type SavedMachineViewError = "NOT_FOUND" | "NAME_TAKEN" | "INVALID_NAME";

function normalizeName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > SAVED_MACHINE_VIEW_NAME_MAX) {
    return null;
  }
  return trimmed;
}

async function nameTaken(
  tx: DbTransaction,
  userId: string,
  key: SavedMachineViewSurfaceKey,
  name: string,
  exceptId: string | null
): Promise<boolean> {
  const t = machineViewSavedViews;
  const rows = await tx
    .select({ id: t.id })
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        surfaceWhere(key),
        eq(sql`lower(${t.name})`, name.toLowerCase()),
        exceptId ? ne(t.id, exceptId) : undefined
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** An account's own Saved View and its Surface, or null. */
export async function findOwnedSavedMachineView(
  tx: DbTransaction,
  userId: string,
  id: string
): Promise<{ id: string; key: SavedMachineViewSurfaceKey } | null> {
  const t = machineViewSavedViews;
  const [row] = await tx
    .select({
      id: t.id,
      surface: t.surface,
      collectionId: t.collectionId,
      ownerCollectionUserId: t.ownerCollectionUserId,
    })
    .from(t)
    .where(and(eq(t.id, id), eq(t.userId, userId)))
    .limit(1);
  if (!row) return null;
  if (row.surface === "collection" && row.collectionId) {
    return {
      id: row.id,
      key: { surface: "collection", collectionId: row.collectionId },
    };
  }
  if (row.surface === "owner" && row.ownerCollectionUserId) {
    return {
      id: row.id,
      key: {
        surface: "owner",
        ownerCollectionUserId: row.ownerCollectionUserId,
      },
    };
  }
  return { id: row.id, key: { surface: "machines" } };
}

/** Save as new (spec §8.1, §8.7, §8.8). */
export async function createSavedMachineView(
  tx: DbTransaction,
  input: {
    userId: string;
    key: SavedMachineViewSurfaceKey;
    name: string;
    state: MachineViewSavedState;
    makeDefault: boolean;
  }
): Promise<Result<{ id: string }, SavedMachineViewError>> {
  const name = normalizeName(input.name);
  if (!name) return err("INVALID_NAME", "Enter a name.");
  if (await nameTaken(tx, input.userId, input.key, name, null)) {
    return err("NAME_TAKEN", "A view with this name already exists");
  }
  const [row] = await tx
    .insert(machineViewSavedViews)
    .values({
      userId: input.userId,
      ...surfaceColumns(input.key),
      name,
      state: input.state,
    })
    .returning({ id: machineViewSavedViews.id });
  if (!row) throw new Error("Saved view insert returned no row");
  if (input.makeDefault) {
    await setMachineViewDefault(tx, {
      userId: input.userId,
      key: input.key,
      target: { kind: "saved", id: row.id },
    });
  }
  return ok({ id: row.id });
}

/** Save changes: overwrite a Saved View's configuration (spec §8.7). */
export async function updateSavedMachineViewState(
  tx: DbTransaction,
  input: { userId: string; id: string; state: MachineViewSavedState }
): Promise<Result<{ id: string }, SavedMachineViewError>> {
  const t = machineViewSavedViews;
  const rows = await tx
    .update(t)
    .set({ state: input.state, updatedAt: new Date() })
    .where(and(eq(t.id, input.id), eq(t.userId, input.userId)))
    .returning({ id: t.id });
  if (rows.length === 0) return err("NOT_FOUND", "View not found.");
  return ok({ id: input.id });
}

/** Rename (spec §8.8, §8.9). */
export async function renameSavedMachineView(
  tx: DbTransaction,
  input: { userId: string; id: string; name: string }
): Promise<Result<{ id: string }, SavedMachineViewError>> {
  const owned = await findOwnedSavedMachineView(tx, input.userId, input.id);
  if (!owned) return err("NOT_FOUND", "View not found.");
  const name = normalizeName(input.name);
  if (!name) return err("INVALID_NAME", "Enter a name.");
  if (await nameTaken(tx, input.userId, owned.key, name, owned.id)) {
    return err("NAME_TAKEN", "A view with this name already exists");
  }
  const t = machineViewSavedViews;
  await tx
    .update(t)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(t.id, owned.id), eq(t.userId, input.userId)));
  return ok({ id: owned.id });
}

/**
 * Delete (spec §8.9). Deleting a Saved View that is the Default View deletes its default row,
 * leaving the Surface without one (§8.14); no other view is promoted.
 */
export async function deleteSavedMachineView(
  tx: DbTransaction,
  input: { userId: string; id: string }
): Promise<Result<{ id: string }, SavedMachineViewError>> {
  const t = machineViewSavedViews;
  const rows = await tx
    .delete(t)
    .where(and(eq(t.id, input.id), eq(t.userId, input.userId)))
    .returning({ id: t.id });
  if (rows.length === 0) return err("NOT_FOUND", "View not found.");
  return ok({ id: input.id });
}

export type MachineViewDefaultTarget =
  { kind: "saved"; id: string } | { kind: "builtIn"; id: string } | null;

/**
 * Sets the account's default on a Surface to one of its Saved Views or one of
 * the Surface preset's Built-in Views, or clears it with null (spec §8.9,
 * §8.10). A Saved View must be the account's own and on the same Surface.
 */
export async function setMachineViewDefault(
  tx: DbTransaction,
  input: {
    userId: string;
    key: SavedMachineViewSurfaceKey;
    target: MachineViewDefaultTarget;
  }
): Promise<Result<{ id: string | null }, SavedMachineViewError>> {
  const { target } = input;
  if (target?.kind === "saved") {
    const owned = await findOwnedSavedMachineView(tx, input.userId, target.id);
    if (!owned || !sameSurface(owned.key, input.key)) {
      return err("NOT_FOUND", "View not found.");
    }
  }
  if (
    target?.kind === "builtIn" &&
    !getMachineViewBuiltInViews(presetForSurface(input.key.surface)).some(
      (view) => view.id === target.id
    )
  ) {
    return err("NOT_FOUND", "View not found.");
  }
  const d = machineViewDefaults;
  await tx
    .delete(d)
    .where(and(eq(d.userId, input.userId), defaultSurfaceWhere(input.key)));
  if (target === null) return ok({ id: null });
  await tx.insert(d).values({
    userId: input.userId,
    ...surfaceColumns(input.key),
    savedViewId: target.kind === "saved" ? target.id : null,
    builtInViewId: target.kind === "builtIn" ? target.id : null,
  });
  return ok({ id: target.id });
}

/** The Page Preset a Surface uses (spec §2.3). */
export function presetForSurface(
  surface: SavedMachineViewSurfaceKey["surface"]
): MachineViewPresetId {
  return surface === "machines" ? "machines" : "collection";
}

function sameSurface(
  left: SavedMachineViewSurfaceKey,
  right: SavedMachineViewSurfaceKey
): boolean {
  const a = surfaceColumns(left);
  const b = surfaceColumns(right);
  return (
    a.surface === b.surface &&
    a.collectionId === b.collectionId &&
    a.ownerCollectionUserId === b.ownerCollectionUserId
  );
}
