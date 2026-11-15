/**
 * Settings tag Server Actions (docs/feature-specs/machine-settings.md §3.3).
 *
 * Thin entry points over `~/services/settings-tags`: they parse, check
 * `machines.settings.tags.manage` (technicians and admins), call the service,
 * and revalidate. They answer in the tag actions' Result shape so the shared
 * rename and delete dialogs work unchanged.
 */

"use server";

import { revalidatePath } from "next/cache";

import { createProtectedAction } from "~/lib/actions";
import { err, ok } from "~/lib/result";
import type { SettingsTagRow } from "~/services/settings-tags";
import {
  createSettingsTag,
  deleteSettingsTag,
  renameSettingsTag,
} from "~/services/settings-tags";
import type { SettingsWriteError } from "~/services/machine-settings";
import type {
  TagActionCode,
  TagActionResult,
} from "~/app/(app)/c/tags/schemas";
import {
  createSettingsTagSchema,
  deleteSettingsTagSchema,
  renameSettingsTagSchema,
} from "./schemas";

const CODES: Record<SettingsWriteError, TagActionCode> = {
  not_found: "NOT_FOUND",
  denied: "FORBIDDEN",
  invalid: "VALIDATION",
  conflict: "CONFLICT",
};

const FORBIDDEN = "Only technicians and admins can manage settings tags.";

/** The tag browse, every tag page, and the machines whose sets changed. */
function revalidateSettingsTags(machineInitials: readonly string[] = []): void {
  revalidatePath("/c/settings-tags");
  // Route patterns name their route groups, or they match no route.
  revalidatePath("/(app)/c/settings-tags/[slug]", "page");
  for (const initials of new Set(machineInitials)) {
    revalidatePath(`/m/${initials}/settings`);
    revalidatePath(`/m/${initials}/timeline`);
  }
}

const createProtected = createProtectedAction({
  actionName: "createSettingsTagAction",
  schema: createSettingsTagSchema,
  permission: "machines.settings.tags.manage",
  forbiddenMessage: FORBIDDEN,
  handler: async (
    { name },
    { user, accessLevel }
  ): Promise<TagActionResult<SettingsTagRow>> => {
    const created = await createSettingsTag({
      actor: { userId: user.id, access: accessLevel },
      name,
    });
    if (!created.ok) return err(CODES[created.code], created.message);
    revalidateSettingsTags();
    return ok(created.value);
  },
});

/** Create a settings tag (§3.3); returns it so a picker can apply it. */
export async function createSettingsTagAction(input: {
  name: string;
}): Promise<TagActionResult<SettingsTagRow>> {
  return await createProtected(input);
}

const renameProtected = createProtectedAction({
  actionName: "renameSettingsTagAction",
  schema: renameSettingsTagSchema,
  permission: "machines.settings.tags.manage",
  forbiddenMessage: FORBIDDEN,
  handler: async (
    { tagId, name },
    { user, accessLevel }
  ): Promise<TagActionResult> => {
    const renamed = await renameSettingsTag({
      actor: { userId: user.id, access: accessLevel },
      tagId,
      name,
    });
    if (!renamed.ok) return err(CODES[renamed.code], renamed.message);
    // Set cards show the name; a rename reaches every machine's tab on its
    // next render.
    revalidatePath("/(app)/m/[initials]/(tabs)/settings", "page");
    revalidateSettingsTags();
    return ok(undefined);
  },
});

/** Rename a settings tag (§3.3). Its slug and page address stay the same. */
export async function renameSettingsTagAction(input: {
  tagId: string;
  name: string;
}): Promise<TagActionResult> {
  return await renameProtected(input);
}

const deleteProtected = createProtectedAction({
  actionName: "deleteSettingsTagAction",
  schema: deleteSettingsTagSchema,
  permission: "machines.settings.tags.manage",
  forbiddenMessage: FORBIDDEN,
  handler: async (
    { tagId },
    { user, accessLevel }
  ): Promise<TagActionResult> => {
    const deleted = await deleteSettingsTag({
      actor: { userId: user.id, access: accessLevel },
      tagId,
    });
    if (!deleted.ok) return err(CODES[deleted.code], deleted.message);
    revalidateSettingsTags(deleted.value.machineInitials);
    return ok(undefined);
  },
});

/** Delete a settings tag, taking it off every set (§3.3). */
export async function deleteSettingsTagAction(input: {
  tagId: string;
}): Promise<TagActionResult> {
  return await deleteProtected(input);
}
