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
  setSavedMachineViewDefault,
  updateSavedMachineViewState,
  type SavedMachineViewError,
} from "~/lib/machines/view/saved-views";
import {
  parseMachineViewState,
  toMachineViewSavedState,
} from "~/lib/machines/view/state";
import type { MachineViewPresetId, MachineViewSavedState } from "~/lib/types";
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

// Shape only: values are re-validated against the Surface's Page Preset
// exactly as URL parameters are (spec §8.15) before they are stored.
const savedStateSchema = z.object({
  q: z.string().max(200),
  presence: z.union([z.literal("all"), z.array(z.string()).max(20)]),
  status: z.array(z.string()).max(20),
  owner: z.array(z.string()).max(500),
  sort: z.string(),
  dir: z.enum(["asc", "desc"]),
  pageSize: z.number().int(),
  columns: z.array(z.string()).max(50),
});

/**
 * Runs a submitted configuration through the URL parser, so storage and URLs
 * agree (spec §4.10) and every unrecognized value is dropped (§8.15).
 */
function normalizeState(
  state: z.infer<typeof savedStateSchema>,
  preset: MachineViewPresetId
): MachineViewSavedState {
  const params = new URLSearchParams();
  params.set("q", state.q);
  params.set(
    "presence",
    state.presence === "all" ? "all" : state.presence.join(",")
  );
  if (state.status.length > 0) params.set("status", state.status.join(","));
  if (state.owner.length > 0) params.set("owner", state.owner.join(","));
  params.set("sort", state.sort);
  params.set("dir", state.dir);
  params.set("pageSize", String(state.pageSize));
  params.set("columns", state.columns.join(","));
  return toMachineViewSavedState(parseMachineViewState(params, preset));
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
    return db.transaction((tx) =>
      createSavedMachineView(tx, {
        userId: user.id,
        key: surface.key,
        name: input.name,
        state: normalizeState(input.state, surface.preset),
        makeDefault: input.makeDefault,
      })
    );
  },
});

/** Save as new (spec §8.7). */
export async function createSavedMachineViewAction(
  input: z.infer<typeof createSchema>
): Promise<SavedViewActionResult> {
  return createProtected(input);
}

const updateSchema = z.object({
  id: z.uuid(),
  surface: surfaceSchema,
  state: savedStateSchema,
});

const updateProtected = createProtectedAction({
  actionName: "updateSavedMachineViewAction",
  schema: updateSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> => {
    const surface = await resolveMachineViewSurface(input.surface);
    if (!surface) return err("NOT_FOUND", "View not found.");
    return updateSavedMachineViewState(db, {
      userId: user.id,
      id: input.id,
      state: normalizeState(input.state, surface.preset),
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
    db.transaction((tx) =>
      renameSavedMachineView(tx, { userId: user.id, ...input })
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

const defaultSchema = z.object({ id: z.uuid(), isDefault: z.boolean() });

const defaultProtected = createProtectedAction({
  actionName: "setSavedMachineViewDefaultAction",
  schema: defaultSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> =>
    db.transaction((tx) =>
      setSavedMachineViewDefault(tx, { userId: user.id, ...input })
    ),
});

export async function setSavedMachineViewDefaultAction(
  input: z.infer<typeof defaultSchema>
): Promise<SavedViewActionResult> {
  return defaultProtected(input);
}
