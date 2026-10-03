"use server";

import { z } from "zod";
import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { err } from "~/lib/result";
import {
  createSavedView,
  deleteSavedView,
  renameSavedView,
  setDefaultView,
  updateSavedViewState,
} from "~/lib/list-view/saved-views";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { machineViewDefaultBuiltInIds } from "~/lib/machines/view/saved-views";
import { normalizeMachineViewSavedState } from "~/lib/machines/view/state";
import {
  ISSUE_SEVERITY_VALUES,
  MACHINE_VIEW_FIELD_IDS,
  type SavedViewError,
} from "~/lib/types";
import { db } from "~/server/db";

/**
 * Machine Saved View actions (spec list-views §10). Every action works on the
 * account's machine Saved Views, whichever Surface it is called from: a Saved
 * View belongs to the Machine View host, not a Surface (§10.5).
 */

type SavedViewActionResult = ProtectedActionResult<
  { id: string },
  SavedViewError
>;

// Values the Machine View parser accepts; the stored configuration is then
// re-validated exactly as URL parameters are (list-views §9.3, §10.14).
const savedStateSchema = z.object({
  q: z.string().max(200),
  presence: z.union([
    z.literal("all"),
    z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)),
  ]),
  status: z.array(z.enum(["operational", "needs_service", "unplayable"])),
  severity: z.array(z.enum(ISSUE_SEVERITY_VALUES)),
  owner: z.array(z.string().max(64)).max(500),
  sort: z.enum(MACHINE_VIEW_FIELD_IDS),
  dir: z.enum(["asc", "desc"]),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  columns: z.array(z.enum(MACHINE_VIEW_FIELD_IDS)),
});

/**
 * The name check runs before the write, so two concurrent saves of one name
 * can both pass it; the unique index then rejects the second (§10.7).
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
  name: z.string(),
  state: savedStateSchema,
  makeDefault: z.boolean(),
});

const createProtected = createProtectedAction({
  actionName: "createSavedMachineViewAction",
  schema: createSchema,
  permission: "machines.views.save",
  handler: async (input, { user }): Promise<SavedViewActionResult> =>
    withNameConflict(() =>
      db.transaction((tx) =>
        createSavedView(tx, {
          userId: user.id,
          host: "machines",
          name: input.name,
          state: normalizeMachineViewSavedState(input.state),
          makeDefault: input.makeDefault,
        })
      )
    ),
});

/** Save as new (list-views §5.3, §10.1). */
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
  handler: async (input, { user }): Promise<SavedViewActionResult> =>
    updateSavedViewState(db, {
      userId: user.id,
      host: "machines",
      id: input.id,
      state: normalizeMachineViewSavedState(input.state),
    }),
});

/** Save changes (list-views §5.3). */
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
        renameSavedView(tx, { userId: user.id, host: "machines", ...input })
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
    deleteSavedView(db, { userId: user.id, host: "machines", id }),
});

export async function deleteSavedMachineViewAction(
  id: string
): Promise<SavedViewActionResult> {
  return deleteProtected(id);
}

const defaultSchema = z.object({
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
  ): Promise<ProtectedActionResult<{ id: string | null }, SavedViewError>> =>
    db.transaction((tx) =>
      setDefaultView(tx, {
        userId: user.id,
        host: "machines",
        target: input.target,
        builtInViewIds: machineViewDefaultBuiltInIds(),
      })
    ),
});

/** Set or clear the account's machine Default View (list-views §10.8, §10.9). */
export async function setMachineViewDefaultAction(
  input: z.infer<typeof defaultSchema>
): Promise<ProtectedActionResult<{ id: string | null }, SavedViewError>> {
  return defaultProtected(input);
}
