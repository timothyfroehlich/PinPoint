/**
 * Machine Server Actions
 *
 * Server-side mutations for machine CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  machines,
  machineWatchers,
  userProfiles,
  invitedUsers,
} from "~/server/db/schema";
import { createMachineSchema, updateMachineSchema } from "./schemas";
import { type Result, ok, err } from "~/lib/result";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log } from "~/lib/logger";
import { createNotification } from "~/lib/notifications";

const NEXT_REDIRECT_DIGEST_PREFIX = "NEXT_REDIRECT;";

const isNextRedirectError = (error: unknown): error is { digest: string } => {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const { digest } = error as { digest?: unknown };
  return (
    typeof digest === "string" && digest.startsWith(NEXT_REDIRECT_DIGEST_PREFIX)
  );
};

interface PostgresError extends Error {
  code: string;
  constraint_name?: string;
}

const isPostgresError = (error: unknown): error is PostgresError => {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as PostgresError).code === "string"
  );
};

export type CreateMachineResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

export type UpdateMachineResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type DeleteMachineResult = Result<
  { machineId: string },
  "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

/**
 * Create Machine Action
 *
 * Creates a new machine with validation.
 * Requires authentication (CORE-SEC-001).
 * Validates input with Zod (CORE-SEC-002).
 *
 * @param _prevState - The previous state of the form.
 * @param formData - Form data from machine creation form
 * @returns The result of the action.
 */
export async function createMachineAction(
  _prevState: CreateMachineResult | undefined,
  formData: FormData
): Promise<CreateMachineResult> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Fetch user profile to check role
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    return err("UNAUTHORIZED", "User profile not found.");
  }

  // Access control: only admins can create machines
  if (profile.role !== "admin") {
    log.warn(
      { userId: user.id, action: "createMachineAction" },
      "Non-admin user attempted to create a machine"
    );
    return err("UNAUTHORIZED", "You must be an admin to create a machine.");
  }

  // Extract form data
  const rawData = {
    name: formData.get("name"),
    initials: formData.get("initials"),
    ownerId:
      typeof formData.get("ownerId") === "string" &&
      (formData.get("ownerId") as string).length > 0
        ? (formData.get("ownerId") as string)
        : undefined,
  };

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { name, initials, ownerId } = validation.data;

  // Resolve owner type
  let finalOwnerId: string | undefined = undefined;
  let finalInvitedOwnerId: string | undefined = undefined;

  // At this point, user is guaranteed to be an admin.
  // If an owner is specified, we resolve them. Otherwise, the admin is the owner.
  if (ownerId) {
    const isActive = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ownerId),
    });
    if (isActive) {
      finalOwnerId = ownerId;
    } else {
      // Verify the ID exists in invited_users before assigning
      const isInvited = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.id, ownerId),
      });
      if (!isInvited) {
        return err("VALIDATION", "Selected owner does not exist.");
      }
      finalInvitedOwnerId = ownerId;
    }
  } else {
    finalOwnerId = user.id;
  }

  // Insert machine
  try {
    const [machine] = await db
      .insert(machines)
      .values({
        name,
        initials,
        ownerId: finalOwnerId,
        invitedOwnerId: finalInvitedOwnerId,
      })
      .returning();

    if (!machine) {
      throw new Error("Machine creation failed");
    }

    // Auto-add owner to machine_watchers (full subscribe mode)
    if (finalOwnerId) {
      await db
        .insert(machineWatchers)
        .values({
          machineId: machine.id,
          userId: finalOwnerId,
          watchMode: "subscribe",
        })
        .onConflictDoUpdate({
          target: [machineWatchers.machineId, machineWatchers.userId],
          set: { watchMode: "subscribe" },
        });
    }

    revalidatePath("/m");

    redirect(`/m/${machine.initials}`);
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    if (isPostgresError(error) && error.code === "23505") {
      return err("VALIDATION", `Initials '${initials}' are already taken.`);
    }

    log.error(
      { error, action: "createMachineAction" },
      "createMachineAction failed"
    );
    return err("SERVER", "Failed to create machine. Please try again.");
  }
}

/**
 * Update Machine Action
 *
 * Updates a machine's name.
 * Requires authentication.
 *
 * @param _prevState - The previous state of the form.
 * @param formData - The form data.
 * @returns The result of the action.
 */
export async function updateMachineAction(
  _prevState: UpdateMachineResult | undefined,
  formData: FormData
): Promise<UpdateMachineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Fetch user profile to check role
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    return err("UNAUTHORIZED", "User profile not found.");
  }

  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
    ownerId:
      typeof formData.get("ownerId") === "string" &&
      (formData.get("ownerId") as string).length > 0
        ? (formData.get("ownerId") as string)
        : undefined,
    presenceStatus:
      typeof formData.get("presenceStatus") === "string" &&
      (formData.get("presenceStatus") as string).length > 0
        ? (formData.get("presenceStatus") as string)
        : undefined,
  };

  const validation = updateMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { id, name, ownerId, presenceStatus } = validation.data;

  try {
    // Admins can update any machine, non-admins can only update their own machines
    const whereConditions =
      profile.role === "admin"
        ? eq(machines.id, id)
        : and(eq(machines.id, id), eq(machines.ownerId, user.id));

    // Get current machine state to check for owner change
    const currentMachine = await db.query.machines.findFirst({
      where: whereConditions,
      columns: { ownerId: true, name: true },
    });

    if (!currentMachine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    // Resolve owner type if provided
    let finalOwnerId: string | null | undefined = undefined;
    let finalInvitedOwnerId: string | null | undefined = undefined;
    let shouldUpdateOwner = false;

    // Derive ownership from the actual machine record, not from form fields
    const isActualOwner = currentMachine.ownerId === user.id;
    const isOwnerOrAdmin = profile.role === "admin" || isActualOwner;
    if (isOwnerOrAdmin && ownerId) {
      shouldUpdateOwner = true;
      const isActive = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, ownerId),
      });
      if (isActive) {
        finalOwnerId = ownerId;
        finalInvitedOwnerId = null; // Reset invited if setting active
      } else {
        // Verify the ID exists in invited_users before assigning
        const isInvited = await db.query.invitedUsers.findFirst({
          where: eq(invitedUsers.id, ownerId),
        });
        if (!isInvited) {
          return err("VALIDATION", "Selected owner does not exist.");
        }
        finalInvitedOwnerId = ownerId;
        finalOwnerId = null; // Reset active if setting invited
      }
    }

    const [machine] = await db
      .update(machines)
      .set({
        name,
        ...(presenceStatus !== undefined && { presenceStatus }),
        ...(shouldUpdateOwner && {
          ownerId: finalOwnerId,
          invitedOwnerId: finalInvitedOwnerId,
        }),
      })
      .where(whereConditions)
      .returning();

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    // Handle owner changes in machine_watchers
    if (shouldUpdateOwner) {
      const oldOwnerId = currentMachine.ownerId;

      // 1. Handle Old Owner
      if (oldOwnerId && oldOwnerId !== finalOwnerId) {
        // Remove old owner from watchers
        await db
          .delete(machineWatchers)
          .where(
            and(
              eq(machineWatchers.machineId, id),
              eq(machineWatchers.userId, oldOwnerId)
            )
          );

        // Notify old owner
        await createNotification({
          type: "machine_ownership_changed",
          resourceId: machine.id,
          resourceType: "machine",
          actorId: user.id,
          includeActor: false,
          machineName: machine.name,
          newStatus: "removed",
          additionalRecipientIds: [oldOwnerId],
        });
      }

      // 2. Handle New Owner
      if (finalOwnerId && finalOwnerId !== oldOwnerId) {
        // Add new owner as subscriber
        await db
          .insert(machineWatchers)
          .values({
            machineId: id,
            userId: finalOwnerId,
            watchMode: "subscribe",
          })
          .onConflictDoUpdate({
            target: [machineWatchers.machineId, machineWatchers.userId],
            set: { watchMode: "subscribe" },
          });

        // Notify new owner
        await createNotification({
          type: "machine_ownership_changed",
          resourceId: machine.id,
          resourceType: "machine",
          actorId: user.id,
          includeActor: false,
          machineName: machine.name,
          newStatus: "added",
          additionalRecipientIds: [finalOwnerId],
        });
      }
    }

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      { error, action: "updateMachineAction" },
      "updateMachineAction failed"
    );
    return err("SERVER", "Failed to update machine. Please try again.");
  }
}

/**
 * Delete Machine Action
 *
 * Deletes a machine.
 * Requires authentication.
 *
 * @param _prevState - The previous state of the form.
 * @param formData - The form data.
 * @returns The result of the action.
 */
export async function deleteMachineAction(
  _prevState: DeleteMachineResult | undefined,
  formData: FormData
): Promise<DeleteMachineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  const machineId = formData.get("id") as string;

  try {
    const [machine] = await db
      .delete(machines)
      .where(and(eq(machines.id, machineId), eq(machines.ownerId, user.id)))
      .returning();

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    revalidatePath("/m");

    return ok({ machineId });
  } catch (error) {
    log.error(
      { error, action: "deleteMachineAction" },
      "deleteMachineAction failed"
    );
    return err("SERVER", "Failed to delete machine. Please try again.");
  }
}

// --- Machine Text Field Update Actions ---

/**
 * Schema for updating a machine text field
 */
const updateMachineTextFieldSchema = z.object({
  machineId: z.string().uuid("Invalid machine ID"),
  value: z
    .string()
    .max(5000, "Text must be less than 5000 characters")
    .transform((v) => (v.trim() === "" ? null : v.trim())),
});

export type UpdateMachineFieldResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

/**
 * Update Machine Description
 *
 * Editable by machine owner and admins.
 */
export async function updateMachineDescription(
  machineId: string,
  value: string
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "description");
}

/**
 * Update Machine Tournament Notes
 *
 * Editable by machine owner and admins.
 */
export async function updateMachineTournamentNotes(
  machineId: string,
  value: string
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "tournamentNotes");
}

/**
 * Update Machine Owner Requirements
 *
 * Editable by machine owner and admins.
 */
export async function updateMachineOwnerRequirements(
  machineId: string,
  value: string
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "ownerRequirements");
}

/**
 * Update Machine Owner Notes
 *
 * Editable by machine owner ONLY (not even admins).
 */
export async function updateMachineOwnerNotes(
  machineId: string,
  value: string
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "ownerNotes");
}

/**
 * Internal helper for updating a machine text field.
 *
 * Permission logic:
 * - description, tournamentNotes, ownerRequirements: owner + admins
 * - ownerNotes: owner only
 */
async function updateMachineTextField(
  machineId: string,
  value: string,
  field: "description" | "tournamentNotes" | "ownerRequirements" | "ownerNotes"
): Promise<UpdateMachineFieldResult> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Validate input (CORE-SEC-002)
  const validation = updateMachineTextFieldSchema.safeParse({
    machineId,
    value,
  });
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  try {
    // Fetch user profile and machine in parallel
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      db.query.machines.findFirst({
        where: eq(machines.id, validation.data.machineId),
        columns: { id: true, ownerId: true, initials: true },
      }),
    ]);

    if (!profile) {
      return err("UNAUTHORIZED", "User profile not found.");
    }

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    // Permission check
    const isOwner = user.id === machine.ownerId;
    const isAdmin = profile.role === "admin";

    if (field === "ownerNotes") {
      // Owner notes: owner only (not even admins)
      if (!isOwner) {
        return err(
          "UNAUTHORIZED",
          "Only the machine owner can edit owner notes."
        );
      }
    } else {
      // description, tournamentNotes, ownerRequirements: owner + admins
      if (!isOwner && !isAdmin) {
        return err(
          "UNAUTHORIZED",
          "Only the machine owner or admins can edit this field."
        );
      }
    }

    // Update the field
    await db
      .update(machines)
      .set({ [field]: validation.data.value })
      .where(eq(machines.id, machine.id));

    revalidatePath(`/m/${machine.initials}`);

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      { error, action: "updateMachineTextField", field },
      `updateMachineTextField (${field}) failed`
    );
    return err("SERVER", "Failed to update field. Please try again.");
  }
}
