import { z } from "zod";
import { tagNameSchema } from "~/lib/tags/names";

/**
 * Input schemas for the settings tag Server Actions (machine-settings §3.3).
 * They live apart from `actions.ts` because a "use server" module may export
 * only async functions.
 */

export const createSettingsTagSchema = z.object({ name: tagNameSchema });

export const renameSettingsTagSchema = z.object({
  tagId: z.uuid(),
  name: tagNameSchema,
});

export const deleteSettingsTagSchema = z.object({ tagId: z.uuid() });
