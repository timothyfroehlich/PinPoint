/**
 * Machine Timeline Comment Server Actions (PP-0x98)
 *
 * - `addMachineCommentAction` — insert a user-authored comment on a machine
 *   timeline. Member+ only. Validates the requested tag against
 *   `userTagSchema` (rejects reserved tags lifecycle/issue) and the body
 *   against `proseMirrorDocSchema`.
 *
 * - `deleteMachineCommentAction` — soft-delete a comment. Authorization is
 *   delegated entirely to the matrix entry for
 *   `machines.timeline.comment.delete` (admin → always; member/technician →
 *   `own_or_owner`, i.e. comment author OR machine owner). Per AGENTS.md
 *   rule 12 (Matrix-Only Permissions), no layered ad-hoc auth checks live in
 *   this action.
 */

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createClient } from "~/lib/supabase/server";
import {
  createMachineComment,
  softDeleteMachineComment,
  updateMachineComment,
} from "~/lib/timeline/machine-events";
import { userTagSchema } from "~/lib/timeline/machine-tags";
import { type ProseMirrorDoc, proseMirrorDocSchema } from "~/lib/tiptap/types";
import { db } from "~/server/db";
import { machines, timelineEvents, userProfiles } from "~/server/db/schema";

type ActionResult = { success: true } | { success: false; error: string };

const addSchema = z.object({
  machineId: z.string().uuid(),
  tag: userTagSchema,
  contentJson: z.string().min(1),
});

const editSchema = z.object({
  id: z.string().uuid(),
  tag: userTagSchema,
  contentJson: z.string().min(1),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Insert a user-authored comment on a machine timeline.
 *
 * Permission: `machines.timeline.comment.add` (member+; unconditional, no
 * OwnershipContext required).
 */
export async function addMachineCommentAction(
  input: z.input<typeof addSchema>
): Promise<ActionResult> {
  // 1. Auth (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // 2. Validate input (CORE-SEC-002). Reserved-tag rejection is built into
  //    `userTagSchema` and surfaces as the schema's refinement message.
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // 3. Validate ProseMirror content. `proseMirrorDocSchema` only checks the
  //    top-level shape (type:"doc", optional content array) — we additionally
  //    require a non-empty content array so the stored row is meaningful.
  let content: ProseMirrorDoc;
  try {
    const raw = JSON.parse(parsed.data.contentJson) as unknown;
    const validated = proseMirrorDocSchema.safeParse(raw);
    if (!validated.success) {
      return { success: false, error: "Invalid content" };
    }
    if (!validated.data.content || validated.data.content.length === 0) {
      return { success: false, error: "Invalid content" };
    }
    // The schema validates the top-level shape; deeper node validation is
    // handled by Tiptap on render. Cast through `unknown` to align with the
    // `ProseMirrorDoc` interface (matches the established m/actions.ts
    // pattern for the existing prose-field actions).
    content = raw as ProseMirrorDoc;
  } catch {
    return { success: false, error: "Invalid content JSON" };
  }

  // 4. Resolve actor profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { id: true, role: true },
  });
  if (!profile) return { success: false, error: "Profile not found" };

  const accessLevel = getAccessLevel(profile.role);

  // 5. Matrix gate (no OwnershipContext: this permission is unconditional)
  if (!checkPermission("machines.timeline.comment.add", accessLevel)) {
    return { success: false, error: "Forbidden" };
  }

  // 6. Resolve machine for the revalidation path
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, parsed.data.machineId),
    columns: { id: true, initials: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  // 7. Insert
  await db.transaction(async (tx) => {
    await createMachineComment(
      machine.id,
      {
        content,
        tag: parsed.data.tag,
        authorId: profile.id,
      },
      tx
    );
  });

  revalidatePath(`/m/${machine.initials}/timeline`);
  // Also refresh the overview tab — the "Recent activity" section and a note
  // posted from the header's New Note action both live off the machine root.
  revalidatePath(`/m/${machine.initials}`);
  return { success: true };
}

/**
 * Edit an existing comment's content and tag.
 *
 * Permission: `machines.timeline.comment.edit` — `own` for all authenticated
 * levels (admin included). Editing someone else's comment would put words in
 * their mouth, so this differs from delete (which admins+owners get) — see
 * the matrix entry's description.
 */
export async function editMachineCommentAction(
  input: z.input<typeof editSchema>
): Promise<ActionResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // 2. Validate input (reserved-tag rejection in userTagSchema)
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // 3. Validate ProseMirror content (matches addMachineCommentAction)
  let content: ProseMirrorDoc;
  try {
    const raw = JSON.parse(parsed.data.contentJson) as unknown;
    const validated = proseMirrorDocSchema.safeParse(raw);
    if (!validated.success) {
      return { success: false, error: "Invalid content" };
    }
    if (!validated.data.content || validated.data.content.length === 0) {
      return { success: false, error: "Invalid content" };
    }
    content = raw as ProseMirrorDoc;
  } catch {
    return { success: false, error: "Invalid content JSON" };
  }

  // 4. Load comment row for matrix context
  const row = await db.query.timelineEvents.findFirst({
    where: eq(timelineEvents.id, parsed.data.id),
    columns: {
      id: true,
      authorId: true,
      machineId: true,
      sourceType: true,
      deletedAt: true,
    },
  });
  if (row?.sourceType !== "comment") {
    return { success: false, error: "Not found" };
  }
  if (row.deletedAt !== null) {
    return { success: false, error: "Already deleted" };
  }
  if (!row.machineId) {
    return { success: false, error: "Not editable" };
  }

  // 5. Load machine (need ownerId for context + initials for revalidate)
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, row.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  // 6. Resolve actor access level
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return { success: false, error: "Profile not found" };

  const accessLevel = getAccessLevel(profile.role);

  // 7. Matrix gate
  const allowed = checkPermission(
    "machines.timeline.comment.edit",
    accessLevel,
    {
      userId: user.id,
      reporterId: row.authorId,
      machineOwnerId: machine.ownerId,
    }
  );
  if (!allowed) {
    return { success: false, error: "Forbidden" };
  }

  // 8. Update
  await db.transaction(async (tx) => {
    await updateMachineComment(
      parsed.data.id,
      { content, tag: parsed.data.tag },
      tx
    );
  });

  revalidatePath(`/m/${machine.initials}/timeline`);
  // Also refresh the overview tab — the "Recent activity" section renders the
  // same row (with the new content + "(edited)" marker) off the machine root.
  revalidatePath(`/m/${machine.initials}`);
  return { success: true };
}

/**
 * Soft-delete a comment on a machine timeline.
 *
 * Permission: `machines.timeline.comment.delete`. The matrix encodes:
 *   admin       → always
 *   member/tech → own_or_owner  (comment author OR machine owner)
 *   guest       → false
 *
 * AGENTS.md rule 12 (Matrix-Only Permissions): authorization is ONLY the
 * `checkPermission` call below. No additional ad-hoc admin/author/owner
 * checks live here — the matrix is the single source of truth.
 */
export async function deleteMachineCommentAction(
  input: z.input<typeof deleteSchema>
): Promise<ActionResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // 2. Validate
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  // 3. Load comment row (need authorId + machineId for the matrix context)
  const row = await db.query.timelineEvents.findFirst({
    where: eq(timelineEvents.id, parsed.data.id),
    columns: {
      id: true,
      authorId: true,
      machineId: true,
      sourceType: true,
      deletedAt: true,
    },
  });
  if (row?.sourceType !== "comment") {
    return { success: false, error: "Not found" };
  }
  if (row.deletedAt !== null) {
    return { success: false, error: "Already deleted" };
  }
  if (!row.machineId) {
    return { success: false, error: "Not deletable" };
  }

  // 4. Load the machine (need ownerId + initials)
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, row.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  // 5. Resolve actor access level
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return { success: false, error: "Profile not found" };

  const accessLevel = getAccessLevel(profile.role);

  // 6. Matrix gate. `reporterId` is the OwnershipContext slot for "resource
  //    creator" — here, the comment author.
  const allowed = checkPermission(
    "machines.timeline.comment.delete",
    accessLevel,
    {
      userId: user.id,
      reporterId: row.authorId,
      machineOwnerId: machine.ownerId,
    }
  );
  if (!allowed) {
    return { success: false, error: "Forbidden" };
  }

  // 7. Soft-delete
  await db.transaction(async (tx) => {
    await softDeleteMachineComment(parsed.data.id, { deletedBy: user.id }, tx);
  });

  revalidatePath(`/m/${machine.initials}/timeline`);
  // Also refresh the overview tab — a deleted comment in "Recent activity"
  // must flip to a tombstone there too, not just on the timeline.
  revalidatePath(`/m/${machine.initials}`);
  return { success: true };
}
