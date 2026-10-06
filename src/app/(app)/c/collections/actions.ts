"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import type { UserRole } from "~/lib/types";
import { canManageCollection } from "~/lib/permissions/collections";
import { isEditorCollaborator } from "~/lib/collections/collaborators";
import { generateViewToken } from "~/lib/collections/tokens";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  collections,
  collectionMachines,
  collectionCollaborators,
  machines,
  userProfiles,
} from "~/server/db/schema";
import {
  docToPlainText,
  extractMentions,
  proseMirrorDocValueSchema,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";

type ActionResult<T = undefined> =
  { success: true; data?: T } | { success: false; error: string };

type DeleteCollectionResult =
  { success: true } | { success: false; error: string; code?: "not_found" };

async function resolveActor(): Promise<{
  userId: string;
  role: UserRole;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return null;
  return { userId: user.id, role: profile.role };
}

const nameSchema = z.string().trim().min(1, "Name is required").max(120);

/**
 * Validate and normalize an optional Collection description (spec 2.8). A
 * blank doc (no text once trimmed) is stored as null, so "no description"
 * has one representation and the header shows nothing (spec 4.7). Size caps
 * match the machine description: 10k plain text / 100k serialized JSON.
 * Mentions are rejected: descriptions never notify anyone, so a mention node
 * can only come from a hand-crafted payload (the editor has them disabled).
 */
function parseDescription(
  value: unknown
): { ok: true; value: ProseMirrorDoc | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  const parsed = proseMirrorDocValueSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Invalid description" };
  const doc = parsed.data;
  const plainText = docToPlainText(doc);
  if (plainText.length > 10_000 || JSON.stringify(doc).length > 100_000) {
    return { ok: false, error: "Description is too long" };
  }
  if (extractMentions(doc).length > 0) {
    return { ok: false, error: "Descriptions can't mention people" };
  }
  if (plainText.trim().length === 0) return { ok: true, value: null };
  return { ok: true, value: doc };
}

export async function createCollectionAction(input: {
  name: string;
  description?: ProseMirrorDoc | null;
  machineIds?: string[];
}): Promise<ActionResult<{ id: string }>> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };

  if (!checkPermission("collections.create", getAccessLevel(actor.role))) {
    return { success: false, error: "Forbidden" };
  }
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name",
    };
  }

  const description = parseDescription(input.description ?? null);
  if (!description.ok) return { success: false, error: description.error };

  const idsParsed = z.array(z.uuid()).safeParse(input.machineIds ?? []);
  if (!idsParsed.success) {
    return { success: false, error: "Invalid machine ids" };
  }
  const desired = [...new Set(idsParsed.data)];

  // Reject ids that are not real machines (silently dropping would hide bugs).
  if (desired.length > 0) {
    const existing = await db
      .select({ id: machines.id })
      .from(machines)
      .where(inArray(machines.id, desired));
    if (existing.length !== desired.length) {
      return { success: false, error: "Unknown machine" };
    }
  }

  // Create the collection and attach any initial machines in one transaction,
  // so a create that picks machines can't half-persist. No side effects here
  // (CORE-ARCH-011).
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(collections)
      .values({
        name: parsed.data,
        description: description.value,
        ownerId: actor.userId,
      })
      .returning({ id: collections.id });
    if (!row) return null;
    if (desired.length > 0) {
      await tx.insert(collectionMachines).values(
        desired.map((machineId) => ({
          collectionId: row.id,
          machineId,
          addedBy: actor.userId,
        }))
      );
    }
    return row.id;
  });
  if (!id) return { success: false, error: "Create failed" };

  revalidatePath("/c/collections");
  return { success: true, data: { id } };
}

/** Load a collection's owner for a manage-gate check. */
async function loadOwner(
  collectionId: string
): Promise<{ owner: { id: string } } | null> {
  if (!z.uuid().safeParse(collectionId).success) return null;
  const row = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: { ownerId: true },
  });
  return row ? { owner: { id: row.ownerId } } : null;
}

export async function updateCollectionAction(input: {
  collectionId: string;
  name: string;
  /**
   * The new description; null clears it. Omitted leaves it unchanged, for
   * callers that only change machines (the empty Overview's inline picker).
   */
  description?: ProseMirrorDoc | null;
  machineIds: string[];
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  // The owner (manage) short-circuits without the collaborator lookup; only a
  // non-owner needs the editor-membership query (avoids a needless query per
  // owner edit).
  const viewer = { userId: actor.userId };
  const canEdit =
    canManageCollection(collection, viewer) ||
    (await isEditorCollaborator(db, input.collectionId, actor.userId));
  if (!canEdit) {
    return { success: false, error: "Forbidden" };
  }

  const parsedName = nameSchema.safeParse(input.name);
  if (!parsedName.success) {
    return {
      success: false,
      error: parsedName.error.issues[0]?.message ?? "Invalid name",
    };
  }

  const description =
    input.description === undefined
      ? undefined
      : parseDescription(input.description);
  if (description && !description.ok) {
    return { success: false, error: description.error };
  }

  const idsParsed = z.array(z.uuid()).safeParse(input.machineIds);
  if (!idsParsed.success) {
    return { success: false, error: "Invalid machine ids" };
  }
  const desired = [...new Set(idsParsed.data)];

  // Reject ids that are not real machines (silently dropping would hide bugs).
  if (desired.length > 0) {
    const existing = await db
      .select({ id: machines.id })
      .from(machines)
      .where(inArray(machines.id, desired));
    if (existing.length !== desired.length) {
      return { success: false, error: "Unknown machine" };
    }
  }

  // Name, description, and the machine-set diff-replace commit together, so a
  // partial edit (name saved but membership not, or vice versa) can never
  // persist (spec 2.4). No external side effects run in this transaction
  // (CORE-ARCH-011).
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ machineId: collectionMachines.machineId })
      .from(collectionMachines)
      .where(eq(collectionMachines.collectionId, input.collectionId));
    const currentSet = new Set(current.map((r) => r.machineId));
    const desiredSet = new Set(desired);

    const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));
    const toAdd = desired.filter((id) => !currentSet.has(id));

    if (toRemove.length > 0) {
      await tx
        .delete(collectionMachines)
        .where(
          and(
            eq(collectionMachines.collectionId, input.collectionId),
            inArray(collectionMachines.machineId, toRemove)
          )
        );
    }
    if (toAdd.length > 0) {
      await tx.insert(collectionMachines).values(
        toAdd.map((machineId) => ({
          collectionId: input.collectionId,
          machineId,
          addedBy: actor.userId,
        }))
      );
    }
    await tx
      .update(collections)
      .set({
        name: parsedName.data,
        ...(description ? { description: description.value } : {}),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, input.collectionId));
  });

  revalidatePath(`/c/${input.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}

/**
 * Enable or disable view-link sharing (Wave 0b, PP-wqit.2). Owner-only.
 *
 * Enable mints a token only if one isn't already set (so a no-op enable keeps
 * the existing link stable); disable nulls it, permanently revoking every prior
 * link of that collection. Token generation is a pure value computed before the
 * single UPDATE — no transaction, no side effects (CORE-ARCH-011).
 *
 * Returns the resulting token (null when disabled) so the Share dialog can
 * render the link without a re-fetch.
 */
const setCollectionSharingSchema = z.object({
  collectionId: z.uuid(),
  enabled: z.boolean(),
});

export async function setCollectionSharingAction(input: {
  collectionId: string;
  enabled: boolean;
}): Promise<ActionResult<{ viewToken: string | null }>> {
  // Validate before any branching: `enabled` gates a security-sensitive
  // choice (revoke vs. keep a live share link). Without z.boolean(), a
  // stringified "false" would be truthy and silently take the *enable*
  // branch — leaving a collection shareable after the owner revoked it.
  const parsed = setCollectionSharingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { collectionId, enabled } = parsed.data;

  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }

  if (!enabled) {
    await db
      .update(collections)
      .set({ viewToken: null, updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
    revalidatePath(`/c/${collectionId}`);
    return { success: true, data: { viewToken: null } };
  }

  // Enable: reuse an existing token if present, else mint one.
  const existing = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: { viewToken: true },
  });
  const token = existing?.viewToken ?? generateViewToken();
  if (!existing?.viewToken) {
    await db
      .update(collections)
      .set({ viewToken: token, updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
  }
  revalidatePath(`/c/${collectionId}`);
  return { success: true, data: { viewToken: token } };
}

export async function deleteCollectionAction(input: {
  collectionId: string;
}): Promise<DeleteCollectionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection)
    return {
      success: false,
      error:
        "This collection is no longer available. It may already have been deleted.",
      code: "not_found",
    };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  // collection_machines rows cascade-delete via the FK.
  await db.delete(collections).where(eq(collections.id, input.collectionId));
  revalidatePath("/c/collections");
  return { success: true };
}

const collaboratorSchema = z.object({
  collectionId: z.uuid(),
  userId: z.uuid(),
});

/**
 * Grant a member editor access to a collection (PP-wqit.7). Owner-only
 * (managing access). Idempotent: re-granting the same person is a no-op, so the
 * UI can fire without first checking existing membership. No transaction — a
 * single insert with no external side effects (CORE-ARCH-011).
 */
export async function addCollectionCollaboratorAction(input: {
  collectionId: string;
  userId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request" };

  const collection = await loadOwner(parsed.data.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  if (parsed.data.userId === collection.owner.id) {
    return { success: false, error: "The owner already has full access" };
  }
  const target = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, parsed.data.userId),
    columns: { id: true, role: true },
  });
  if (!target) return { success: false, error: "Unknown user" };
  // Guests (default signup role) can't create collections, so they can't be
  // granted edit access either — enforced here, not just hidden in the picker
  // (PP-wqit.7, "all members").
  // permissions-audit-allow: collaborator eligibility on the target, not an actor gate
  if (target.role === "guest") {
    return { success: false, error: "Guests can't be given edit access" };
  }

  await db
    .insert(collectionCollaborators)
    .values({
      collectionId: parsed.data.collectionId,
      userId: parsed.data.userId,
      role: "editor",
      addedBy: actor.userId,
    })
    .onConflictDoNothing();

  revalidatePath(`/c/${parsed.data.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}

/** Revoke a collaborator's access (PP-wqit.7). Owner-only. */
export async function removeCollectionCollaboratorAction(input: {
  collectionId: string;
  userId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request" };

  const collection = await loadOwner(parsed.data.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }

  await db
    .delete(collectionCollaborators)
    .where(
      and(
        eq(collectionCollaborators.collectionId, parsed.data.collectionId),
        eq(collectionCollaborators.userId, parsed.data.userId)
      )
    );

  revalidatePath(`/c/${parsed.data.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}
