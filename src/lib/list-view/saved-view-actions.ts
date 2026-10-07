import "server-only";

import { z } from "zod";
import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { err } from "~/lib/result";
import type { ListHost, SavedViewError } from "~/lib/types";
import { db } from "~/server/db";
import {
  createSavedView,
  deleteSavedView,
  renameSavedView,
  setDefaultView,
  updateSavedViewState,
} from "./saved-views";

/**
 * The Saved View Server Actions of one List Host (spec list-views §10).
 * Every action works on the account's Saved Views of that host, whichever
 * Surface it is called from: a Saved View belongs to its host, not a Surface
 * (§10.5). Each host's `"use server"` module wraps these handlers in its own
 * exported actions.
 */

export type SavedViewActionResult = ProtectedActionResult<
  { id: string },
  SavedViewError
>;
export type DefaultViewActionResult = ProtectedActionResult<
  { id: string | null },
  SavedViewError
>;

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

const defaultSchema = z.object({
  target: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("saved"), id: z.uuid() }),
      z.object({ kind: z.literal("builtIn"), id: z.string().max(64) }),
    ])
    .nullable(),
});

export type DefaultViewInput = z.infer<typeof defaultSchema>;

export interface SavedViewActionHandlers<State> {
  create: (input: {
    name: string;
    state: State;
    makeDefault: boolean;
  }) => Promise<SavedViewActionResult>;
  update: (input: {
    id: string;
    state: State;
  }) => Promise<SavedViewActionResult>;
  rename: (input: {
    id: string;
    name: string;
  }) => Promise<SavedViewActionResult>;
  remove: (id: string) => Promise<SavedViewActionResult>;
  setDefault: (input: DefaultViewInput) => Promise<DefaultViewActionResult>;
}

/**
 * Builds a host's Saved View handlers. `stateSchema` accepts the values the
 * host's URL parser accepts, and `normalize` then re-validates the stored
 * configuration exactly as URL parameters are (list-views §9.3, §10.14).
 * `builtInViewIds` are the Built-in Views that can be the host's Default
 * View: its main page's own, since only that page opens a default.
 */
export function createSavedViewActionHandlers<State>({
  host,
  names,
  stateSchema,
  normalize,
  builtInViewIds,
}: {
  host: ListHost;
  /** Stable operation names for unexpected-error reports. */
  names: {
    create: string;
    update: string;
    rename: string;
    remove: string;
    setDefault: string;
  };
  stateSchema: z.ZodType<State>;
  normalize: (state: State) => unknown;
  builtInViewIds: () => string[];
}): SavedViewActionHandlers<State> {
  const create = createProtectedAction({
    actionName: names.create,
    schema: z.object({
      name: z.string(),
      state: stateSchema,
      makeDefault: z.boolean(),
    }),
    permission: "views.save",
    handler: async (input, { user }): Promise<SavedViewActionResult> =>
      withNameConflict(() =>
        db.transaction((tx) =>
          createSavedView(tx, {
            userId: user.id,
            host,
            name: input.name,
            state: normalize(input.state),
            makeDefault: input.makeDefault,
          })
        )
      ),
  });

  const update = createProtectedAction({
    actionName: names.update,
    schema: z.object({ id: z.uuid(), state: stateSchema }),
    permission: "views.save",
    handler: async (input, { user }): Promise<SavedViewActionResult> =>
      updateSavedViewState(db, {
        userId: user.id,
        host,
        id: input.id,
        state: normalize(input.state),
      }),
  });

  const rename = createProtectedAction({
    actionName: names.rename,
    schema: z.object({ id: z.uuid(), name: z.string() }),
    permission: "views.save",
    handler: async (input, { user }): Promise<SavedViewActionResult> =>
      withNameConflict(() =>
        db.transaction((tx) =>
          renameSavedView(tx, { userId: user.id, host, ...input })
        )
      ),
  });

  const remove = createProtectedAction({
    actionName: names.remove,
    schema: z.uuid(),
    permission: "views.save",
    handler: async (id, { user }): Promise<SavedViewActionResult> =>
      deleteSavedView(db, { userId: user.id, host, id }),
  });

  const setDefault = createProtectedAction({
    actionName: names.setDefault,
    schema: defaultSchema,
    permission: "views.save",
    handler: async (input, { user }): Promise<DefaultViewActionResult> =>
      db.transaction((tx) =>
        setDefaultView(tx, {
          userId: user.id,
          host,
          target: input.target,
          builtInViewIds: builtInViewIds(),
        })
      ),
  });

  return { create, update, rename, remove, setDefault };
}
