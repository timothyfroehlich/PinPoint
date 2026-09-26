"use server";

import { z } from "zod";
import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { err } from "~/lib/result";
import {
  createSavedMachineView,
  deleteSavedMachineView,
  renameSavedMachineView,
  setMachineViewDefault,
  findOwnedSavedMachineView,
  presetForSurface,
  updateSavedMachineViewState,
  type SavedMachineViewError,
} from "~/lib/machines/view/saved-views";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { normalizeMachineViewSavedState } from "~/lib/machines/view/state";
import { MACHINE_VIEW_FIELD_IDS } from "~/lib/types";
import { db } from "~/server/db";
import { resolveMachineViewSurface } from "./saved-view-surface";

type SavedViewActionResult = ProtectedActionResult<
  { id: string },
  SavedMachineViewError
>;

const surfaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("machines") }),
  z.object({ kind: z.literal("collection"), handle: z.string().min(1) }),
  z.object({ kind: z.literal("owner"), ownerId: z.uuid() }),
]);

// Values the Machine View parser accepts; the stored configuration is then
// re-validated against the Surface's Page Preset (spec §4.10, §8.15).
const savedStateSchema = z.object({
  q: z.string().max(200),
  presence: z.union([
    z.literal("all"),
    z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)),
  ]),
  status: z.array(z.enum(["operational", "needs_service", "unplayable"])),
  owner: z.array(z.string().max(64)).max(500),
  sort: z.enum(MACHINE_VIEW_FIELD_IDS),
  dir: z.enum(["asc", "desc"]),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  columns: z.array(z.enum(MACHINE_VIEW_FIELD_IDS)),
});

/**
 * The name check runs before the write, so two concurrent saves of one name
 * can both pass it; the unique index then rejects the second (spec §8.8).
 */
async function withNameConflict(
  write: () => Promise<SavedViewActionResult>
): Promise<SavedViewActionResult> {
  try {
    return await write();
  } catch (error) {
    if (isPgErrorCode(error, "23505")) {
      return err("NAME_TAKEN", "A view with this name already exists");
    }
    throw error;
  }
}

const createSchema = z.object({
  surface: surfaceSchema,
  name: z.string(),
  state: savedStateSchema,
  makeDefault: z.boolean(),
});

const createProtected = createProtectedAction({
  actionName: "createSavedMachineViewAction",
  schema: createSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> => {
    const surface = await resolveMachineViewSurface(input.surface);
    if (!surface) return err("NOT_FOUND", "View not found.");
    return withNameConflict(() =>
      db.transaction((tx) =>
        createSavedMachineView(tx, {
          userId: user.id,
          key: surface.key,
          name: input.name,
          state: normalizeMachineViewSavedState(input.state, surface.preset),
          makeDefault: input.makeDefault,
        })
      )
    );
  },
});

/** Save as new (spec §8.7). */
export async function createSavedMachineViewAction(
  input: z.infer<typeof createSchema>
): Promise<SavedViewActionResult> {
  return createProtected(input);
}

const updateSchema = z.object({ id: z.uuid(), state: savedStateSchema });

const updateProtected = createProtectedAction({
  actionName: "updateSavedMachineViewAction",
  schema: updateSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> => {
    // Validate against the stored view's own Surface, not one the client names.
    const owned = await findOwnedSavedMachineView(db, user.id, input.id);
    if (!owned) return err("NOT_FOUND", "View not found.");
    return updateSavedMachineViewState(db, {
      userId: user.id,
      id: owned.id,
      state: normalizeMachineViewSavedState(
        input.state,
        presetForSurface(owned.key.surface)
      ),
    });
  },
});

/** Save changes (spec §8.7). */
export async function updateSavedMachineViewAction(
  input: z.infer<typeof updateSchema>
): Promise<SavedViewActionResult> {
  return updateProtected(input);
}

const renameSchema = z.object({ id: z.uuid(), name: z.string() });

const renameProtected = createProtectedAction({
  actionName: "renameSavedMachineViewAction",
  schema: renameSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> =>
    withNameConflict(() =>
      db.transaction((tx) =>
        renameSavedMachineView(tx, { userId: user.id, ...input })
      )
    ),
});

export async function renameSavedMachineViewAction(
  input: z.infer<typeof renameSchema>
): Promise<SavedViewActionResult> {
  return renameProtected(input);
}

const deleteProtected = createProtectedAction({
  actionName: "deleteSavedMachineViewAction",
  schema: z.uuid(),
  permission: "machines.views.save",
  handler: async (id, { user }): Promise<SavedViewActionResult> =>
    deleteSavedMachineView(db, { userId: user.id, id }),
});

export async function deleteSavedMachineViewAction(
  id: string
): Promise<SavedViewActionResult> {
  return deleteProtected(id);
}

const defaultSchema = z.object({
  surface: surfaceSchema,
  target: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("saved"), id: z.uuid() }),
      z.object({ kind: z.literal("builtIn"), id: z.string().max(64) }),
    ])
    .nullable(),
});

const defaultProtected = createProtectedAction({
  actionName: "setMachineViewDefaultAction",
  schema: defaultSchema,
  permission: "machines.views.save",
  handler: async (
    input,
    { user }
  ): Promise<
    ProtectedActionResult<{ id: string | null }, SavedMachineViewError>
  > => {
    const surface = await resolveMachineViewSurface(input.surface);
    if (!surface) return err("NOT_FOUND", "View not found.");
    return db.transaction((tx) =>
      setMachineViewDefault(tx, {
        userId: user.id,
        key: surface.key,
        target: input.target,
      })
    );
  },
});

/** Set or clear the account's default on a Surface (spec §8.9, §8.10). */
export async function setMachineViewDefaultAction(
  input: z.infer<typeof defaultSchema>
): Promise<
  ProtectedActionResult<{ id: string | null }, SavedMachineViewError>
> {
  return defaultProtected(input);
}
