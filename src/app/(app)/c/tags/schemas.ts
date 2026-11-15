import { z } from "zod";
import type { Result } from "~/lib/result";
import { tagNameSchema, tagTypeNameSchema } from "~/lib/tags/names";
import type { TagConflictMachine } from "~/lib/tags/types";

/**
 * Input schemas for the tag Server Actions (spec collections-and-tags §11).
 * They live apart from `actions.ts` because a "use server" module may export
 * only async functions.
 */

export const createTagTypeSchema = z.object({
  name: tagTypeNameSchema,
  exclusive: z.boolean(),
});

export const renameTagTypeSchema = z.object({
  tagTypeId: z.uuid(),
  name: tagTypeNameSchema,
});

export const deleteTagTypeSchema = z.object({ tagTypeId: z.uuid() });

export const createTagSchema = z.object({
  name: tagNameSchema,
  /** A hand-applied tag type's id, or null for a tag with no tag type. */
  tagTypeId: z.uuid().nullable(),
});

export const renameTagSchema = z.object({
  tagId: z.uuid(),
  name: tagNameSchema,
});

export const deleteTagSchema = z.object({ tagId: z.uuid() });

/** The tag page's Edit machines dialog: the complete set the tag should have. */
export const setTagMachinesSchema = z.object({
  tagId: z.uuid(),
  machineIds: z.array(z.uuid()).max(5000),
});

/** One tag on one machine, as a machine's page applies it (spec 11.4). */
export const setMachineTagSchema = z.object({
  machineId: z.uuid(),
  tagId: z.uuid(),
  applied: z.boolean(),
});

/** Make a hand-applied tag type exclusive or not (spec 11.7). */
export const setTagTypeExclusiveSchema = z.object({
  tagTypeId: z.uuid(),
  exclusive: z.boolean(),
});

/** Move a hand-applied tag to a hand-applied tag type, or to none (11.16). */
export const moveTagSchema = z.object({
  tagId: z.uuid(),
  /** The destination tag type's id, or null for no tag type. */
  tagTypeId: z.uuid().nullable(),
});

/** Merge a hand-applied tag into another hand-applied tag (spec 11.17). */
export const mergeTagSchema = z
  .object({
    /** The tag merged away, which is deleted. */
    tagId: z.uuid(),
    /** The tag its machines and links go to. */
    targetTagId: z.uuid(),
  })
  .refine((input) => input.tagId !== input.targetTagId, {
    message: "Pick another tag",
  });

export type TagActionCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVER";

export type TagActionResult<T = undefined> = Result<T, TagActionCode>;

/**
 * A tag action that can be refused because machines would hold two tags of
 * an exclusive tag type (11.7, 11.16); the refusal lists those machines.
 */
export type TagConflictResult<T = undefined> = Result<
  T,
  TagActionCode,
  // `| undefined` lets the plain refusals (sign-in, not found) pass through.
  { machines: TagConflictMachine[] } | undefined
>;
