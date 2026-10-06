"use server";

import { z } from "zod";
import {
  createSavedViewActionHandlers,
  type DefaultViewActionResult,
  type DefaultViewInput,
  type SavedViewActionResult,
} from "~/lib/list-view/saved-view-actions";
import { issueViewDefaultBuiltInIds } from "~/lib/issues/view/config";
import { normalizeIssueViewSavedState } from "~/lib/issues/view/state";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import {
  ISSUE_FREQUENCY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  ISSUE_VIEW_SORT_FIELDS,
  LIST_PAGE_SIZES,
} from "~/lib/types";

/**
 * Issue Saved View actions (spec list-views §10). Every action works on the
 * account's issue Saved Views, whichever Surface it is called from: a Saved
 * View belongs to the Issue View host, not a Surface (§10.5).
 */

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const range = z.object({ from: day, to: day });
const people = z.array(z.string().max(64)).max(500);

// Values the Issue View parser accepts; the stored configuration is then
// re-validated exactly as URL parameters are (list-views §9.3, §10.14).
const savedStateSchema = z.object({
  q: z.string().max(200),
  status: z.array(z.enum(ISSUE_STATUS_VALUES)),
  severity: z.array(z.enum(ISSUE_SEVERITY_VALUES)),
  priority: z.array(z.enum(ISSUE_PRIORITY_VALUES)),
  machine: z.array(z.string().max(6)).max(500),
  assignee: people,
  presence: z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)),
  created: range,
  updated: range,
  frequency: z.array(z.enum(ISSUE_FREQUENCY_VALUES)),
  owner: people,
  reporter: people,
  watching: z.boolean(),
  sort: z.enum(ISSUE_VIEW_SORT_FIELDS),
  dir: z.enum(["asc", "desc"]),
  pageSize: z.literal(LIST_PAGE_SIZES),
});

type IssueSavedStateInput = z.infer<typeof savedStateSchema>;

const handlers = createSavedViewActionHandlers({
  host: "issues",
  names: {
    create: "createSavedIssueViewAction",
    update: "updateSavedIssueViewAction",
    rename: "renameSavedIssueViewAction",
    remove: "deleteSavedIssueViewAction",
    setDefault: "setIssueViewDefaultAction",
  },
  stateSchema: savedStateSchema,
  normalize: normalizeIssueViewSavedState,
  builtInViewIds: issueViewDefaultBuiltInIds,
});

/** Save as new (list-views §5.3, §10.1). */
export async function createSavedIssueViewAction(input: {
  name: string;
  state: IssueSavedStateInput;
  makeDefault: boolean;
}): Promise<SavedViewActionResult> {
  return handlers.create(input);
}

/** Save changes (list-views §5.3). */
export async function updateSavedIssueViewAction(input: {
  id: string;
  state: IssueSavedStateInput;
}): Promise<SavedViewActionResult> {
  return handlers.update(input);
}

export async function renameSavedIssueViewAction(input: {
  id: string;
  name: string;
}): Promise<SavedViewActionResult> {
  return handlers.rename(input);
}

export async function deleteSavedIssueViewAction(
  id: string
): Promise<SavedViewActionResult> {
  return handlers.remove(id);
}

/** Set or clear the account's issue Default View (list-views §10.8, §10.9). */
export async function setIssueViewDefaultAction(
  input: DefaultViewInput
): Promise<DefaultViewActionResult> {
  return handlers.setDefault(input);
}
