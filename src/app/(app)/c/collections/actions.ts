"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { canManageCollection } from "~/lib/collections/access";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  collections,
  collectionMachines,
  machines,
  userProfiles,
} from "~/server/db/schema";

type ActionResult<T = undefined> =
  { success: true; data?: T } | { success: false; error: string };

type UserRole = "guest" | "member" | "technician" | "admin";

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

export async function createCollectionAction(input: {
  name: string;
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
      .values({ name: parsed.data, ownerId: actor.userId })
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
  machineIds: string[];
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }

  const parsedName = nameSchema.safeParse(input.name);
  if (!parsedName.success) {
    return {
      success: false,
      error: parsedName.error.issues[0]?.message ?? "Invalid name",
    };
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

  // Name change + machine-set diff-replace commit together, so a partial edit
  // (name saved but membership not, or vice versa) can never persist. No
  // external side effects run in this transaction (CORE-ARCH-011).
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
      .set({ name: parsedName.data, updatedAt: new Date() })
      .where(eq(collections.id, input.collectionId));
  });

  revalidatePath(`/c/collection/${input.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}

export async function deleteCollectionAction(input: {
  collectionId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  // collection_machines rows cascade-delete via the FK.
  await db.delete(collections).where(eq(collections.id, input.collectionId));
  revalidatePath("/c/collections");
  return { success: true };
}
