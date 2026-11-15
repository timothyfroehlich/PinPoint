"use server";

import { z } from "zod";
import {
  createSavedViewActionHandlers,
  type DefaultViewActionResult,
  type DefaultViewInput,
  type SavedViewActionResult,
} from "~/lib/list-view/saved-view-actions";
import { LIST_PAGE_SIZES } from "~/lib/types";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { machineViewDefaultBuiltInIds } from "~/lib/machines/view/saved-views";
import {
  MACHINE_STATUS_VALUES,
  normalizeMachineViewSavedState,
} from "~/lib/machines/view/state";
import { ISSUE_SEVERITY_VALUES, MACHINE_VIEW_FIELD_IDS } from "~/lib/types";

/**
 * Machine Saved View actions (spec list-views §10). Every action works on the
 * account's machine Saved Views, whichever Surface it is called from: a Saved
 * View belongs to the Machine View host, not a Surface (§10.5).
 */

// Values the Machine View parser accepts; the stored configuration is then
// re-validated exactly as URL parameters are (list-views §9.3, §10.14).
const savedStateSchema = z.object({
  q: z.string().max(200),
  presence: z.union([
    z.literal("all"),
    z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)),
  ]),
  status: z.array(z.enum(MACHINE_STATUS_VALUES)),
  severity: z.array(z.enum(ISSUE_SEVERITY_VALUES)),
  owner: z.array(z.string().max(64)).max(500),
  sort: z.enum(MACHINE_VIEW_FIELD_IDS),
  dir: z.enum(["asc", "desc"]),
  pageSize: z.literal(LIST_PAGE_SIZES),
  columns: z.array(z.enum(MACHINE_VIEW_FIELD_IDS)),
});

type MachineSavedStateInput = z.infer<typeof savedStateSchema>;

const handlers = createSavedViewActionHandlers({
  host: "machines",
  names: {
    create: "createSavedMachineViewAction",
    update: "updateSavedMachineViewAction",
    rename: "renameSavedMachineViewAction",
    remove: "deleteSavedMachineViewAction",
    setDefault: "setMachineViewDefaultAction",
  },
  stateSchema: savedStateSchema,
  normalize: normalizeMachineViewSavedState,
  builtInViewIds: machineViewDefaultBuiltInIds,
});

/** Save as new (list-views §5.3, §10.1). */
export async function createSavedMachineViewAction(input: {
  name: string;
  state: MachineSavedStateInput;
  makeDefault: boolean;
}): Promise<SavedViewActionResult> {
  return handlers.create(input);
}

/** Save changes (list-views §5.3). */
export async function updateSavedMachineViewAction(input: {
  id: string;
  state: MachineSavedStateInput;
}): Promise<SavedViewActionResult> {
  return handlers.update(input);
}

export async function renameSavedMachineViewAction(input: {
  id: string;
  name: string;
}): Promise<SavedViewActionResult> {
  return handlers.rename(input);
}

export async function deleteSavedMachineViewAction(
  id: string
): Promise<SavedViewActionResult> {
  return handlers.remove(id);
}

/** Set or clear the account's machine Default View (list-views §10.8, §10.9). */
export async function setMachineViewDefaultAction(
  input: DefaultViewInput
): Promise<DefaultViewActionResult> {
  return handlers.setDefault(input);
}
