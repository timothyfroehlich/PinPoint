import "server-only";

import { and, asc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { machineViewSavedViews } from "~/server/db/schema";
import { err, ok, type Result } from "~/lib/result";
import type {
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSavedViewSummary,
} from "~/lib/types";
import {
  hasMachineViewConfiguration,
  MACHINE_VIEW_PRESET_REFERENCE,
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

function surfaceWhere(key: SavedMachineViewSurfaceKey): SQL | undefined {
  const t = machineViewSavedViews;
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
      isDefault: t.isDefault,
      state: t.state,
    })
    .from(t)
    .where(and(eq(t.userId, userId), surfaceWhere(key)))
    .orderBy(asc(sql`lower(${t.name})`), asc(t.id));
}

export interface SavedMachineViewRequest {
  /** The validated `view` reference (spec §4.11), or null. */
  activeViewId: string | null;
  /** Where to send a configuration-free URL that has a default (§8.11–8.12). */
  redirectTo: string | null;
}

/**
 * Decides how a Surface URL relates to the account's Saved Views. A URL with
 * no view configuration other than `page` opens the Default Saved View at its
 * canonical URL (spec §8.11, §8.12); any other URL opens as written, and a
 * `view` naming a Saved View the account does not own is ignored (§4.11).
 */
export function resolveSavedMachineViewRequest({
  views,
  preset,
  searchParams,
  pathname,
}: {
  views: MachineViewSavedViewSummary[];
  preset: MachineViewPresetId;
  searchParams: MachineViewSearchParams;
  pathname: string;
}): SavedMachineViewRequest {
  if (!hasMachineViewConfiguration(searchParams)) {
    const defaultView = views.find((view) => view.isDefault);
    if (!defaultView) return { activeViewId: null, redirectTo: null };
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
  const requested = searchParams.get("view");
  if (requested === MACHINE_VIEW_PRESET_REFERENCE) {
    return { activeViewId: MACHINE_VIEW_PRESET_REFERENCE, redirectTo: null };
  }
  const owned = views.find((view) => view.id === requested);
  return { activeViewId: owned?.id ?? null, redirectTo: null };
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

async function clearDefault(
  tx: DbTransaction,
  userId: string,
  key: SavedMachineViewSurfaceKey
): Promise<void> {
  const t = machineViewSavedViews;
  await tx
    .update(t)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(t.userId, userId), surfaceWhere(key), eq(t.isDefault, true)));
}

async function findOwned(
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
  if (input.makeDefault) await clearDefault(tx, input.userId, input.key);
  const [row] = await tx
    .insert(machineViewSavedViews)
    .values({
      userId: input.userId,
      ...surfaceColumns(input.key),
      name,
      state: input.state,
      isDefault: input.makeDefault,
    })
    .returning({ id: machineViewSavedViews.id });
  if (!row) throw new Error("Saved view insert returned no row");
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
  const owned = await findOwned(tx, input.userId, input.id);
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
 * Delete (spec §8.9). Deleting the Default Saved View leaves the Surface
 * without one (§8.14); no other view is promoted.
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

/** Set or clear the Default Saved View (spec §8.9, §8.10). */
export async function setSavedMachineViewDefault(
  tx: DbTransaction,
  input: { userId: string; id: string; isDefault: boolean }
): Promise<Result<{ id: string }, SavedMachineViewError>> {
  const owned = await findOwned(tx, input.userId, input.id);
  if (!owned) return err("NOT_FOUND", "View not found.");
  const t = machineViewSavedViews;
  if (input.isDefault) await clearDefault(tx, input.userId, owned.key);
  await tx
    .update(t)
    .set({ isDefault: input.isDefault, updatedAt: new Date() })
    .where(and(eq(t.id, owned.id), eq(t.userId, input.userId)));
  return ok({ id: owned.id });
}
