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
import {
  type ProseMirrorDoc,
  docToPlainText,
  proseMirrorDocSchema,
} from "~/lib/tiptap/types";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

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

export interface AssigneeNotMemberMeta {
  assignee: {
    id: string;
    name: string;
    role: "guest";
    type: "active" | "invited";
  };
}

export type CreateMachineResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER" | "ASSIGNEE_NOT_MEMBER",
  AssigneeNotMemberMeta
>;

export type UpdateMachineResult = Result<
  { machineId: string },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER"
  | "ASSIGNEE_NOT_MEMBER",
  AssigneeNotMemberMeta
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

  const accessLevel = getAccessLevel(profile.role);

  // Access control: only admins or technicians can create machines
  if (!checkPermission("machines.create", accessLevel)) {
    log.warn(
      { userId: user.id, action: "createMachineAction" },
      "Unauthorized user attempted to create a machine"
    );
    return err(
      "UNAUTHORIZED",
      "You must be an admin or technician to create a machine."
    );
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
    forcePromoteUserId:
      typeof formData.get("forcePromoteUserId") === "string" &&
      (formData.get("forcePromoteUserId") as string).length > 0
        ? (formData.get("forcePromoteUserId") as string)
        : undefined,
  };

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { name, initials, ownerId, forcePromoteUserId } = validation.data;

  // Handle forcePromoteUserId path: gate, validate, then wrap in transaction
  if (forcePromoteUserId !== undefined) {
    if (!checkPermission("admin.users.promote.guestToMember", accessLevel)) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to promote users."
      );
    }
    if (forcePromoteUserId !== ownerId) {
      return err(
        "VALIDATION",
        "forcePromoteUserId must match the selected owner."
      );
    }
    // Verify target user exists and is a guest
    const targetActive = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, forcePromoteUserId),
    });
    const targetInvited = targetActive
      ? null
      : await db.query.invitedUsers.findFirst({
          where: eq(invitedUsers.id, forcePromoteUserId),
        });
    if (!targetActive && !targetInvited) {
      return err("VALIDATION", "Selected user does not exist.");
    }
    if ((targetActive?.role ?? targetInvited?.role) !== "guest") {
      return err("VALIDATION", "Selected user is not a guest.");
    }

    // Atomic: promote + insert machine + add watcher
    try {
      const [machine] = await db.transaction(async (tx) => {
        // Promote guest to member
        if (targetActive) {
          await tx
            .update(userProfiles)
            .set({ role: "member" })
            .where(eq(userProfiles.id, forcePromoteUserId));
        } else {
          await tx
            .update(invitedUsers)
            .set({ role: "member" })
            .where(eq(invitedUsers.id, forcePromoteUserId));
        }

        // Determine owner columns
        const machineOwnerId = targetActive ? forcePromoteUserId : undefined;
        const machineInvitedOwnerId = targetInvited
          ? forcePromoteUserId
          : undefined;

        // Insert machine
        const [newMachine] = await tx
          .insert(machines)
          .values({
            name,
            initials,
            ownerId: machineOwnerId,
            invitedOwnerId: machineInvitedOwnerId,
          })
          .returning();

        if (!newMachine) {
          throw new Error("Machine creation failed");
        }

        // Add owner as watcher
        if (machineOwnerId) {
          await tx
            .insert(machineWatchers)
            .values({
              machineId: newMachine.id,
              userId: machineOwnerId,
              watchMode: "subscribe",
            })
            .onConflictDoUpdate({
              target: [machineWatchers.machineId, machineWatchers.userId],
              set: { watchMode: "subscribe" },
            });
        }

        return [newMachine];
      });

      // Notify new owner after transaction commits
      if (targetActive) {
        await createNotification({
          type: "machine_ownership_changed",
          resourceId: machine.id,
          resourceType: "machine",
          actorId: user.id,
          includeActor: false,
          machineName: machine.name,
          newStatus: "added",
          additionalRecipientIds: [forcePromoteUserId],
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
        "createMachineAction (forcePromote) failed"
      );
      return err("SERVER", "Failed to create machine. Please try again.");
    }
  }

  // Resolve owner type
  let finalOwnerId: string | undefined = undefined;
  let finalInvitedOwnerId: string | undefined = undefined;

  if (ownerId) {
    const activeOwner = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ownerId),
    });
    if (activeOwner) {
      // Validate assignee is not a guest
      if (activeOwner.role === "guest") {
        return err(
          "ASSIGNEE_NOT_MEMBER",
          "Selected owner is a guest and must be promoted to member first.",
          {
            assignee: {
              id: activeOwner.id,
              name: `${activeOwner.firstName} ${activeOwner.lastName}`,
              role: "guest",
              type: "active",
            },
          }
        );
      }
      finalOwnerId = ownerId;
    } else {
      // Verify the ID exists in invited_users before assigning
      const invitedOwner = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.id, ownerId),
      });
      if (!invitedOwner) {
        return err("VALIDATION", "Selected owner does not exist.");
      }
      // Validate invited assignee is not a guest
      if (invitedOwner.role === "guest") {
        return err(
          "ASSIGNEE_NOT_MEMBER",
          "Selected owner is a guest and must be promoted to member first.",
          {
            assignee: {
              id: invitedOwner.id,
              name: `${invitedOwner.firstName} ${invitedOwner.lastName}`,
              role: "guest",
              type: "invited",
            },
          }
        );
      }
      finalInvitedOwnerId = ownerId;
    }
  }
  // If no ownerId provided, leave both undefined — DB stores NULL (no defaulting to caller)

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

  const accessLevel = getAccessLevel(profile.role);

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
    forcePromoteUserId:
      typeof formData.get("forcePromoteUserId") === "string" &&
      (formData.get("forcePromoteUserId") as string).length > 0
        ? (formData.get("forcePromoteUserId") as string)
        : undefined,
  };

  const validation = updateMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { id, name, ownerId, presenceStatus, forcePromoteUserId } =
    validation.data;

  try {
    // Load current machine by id — permission check is authoritative
    const currentMachine = await db.query.machines.findFirst({
      where: eq(machines.id, id),
      columns: { id: true, ownerId: true, name: true, initials: true },
    });

    if (!currentMachine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    // Permission check via matrix
    if (
      !checkPermission("machines.edit", accessLevel, {
        userId: user.id,
        machineOwnerId: currentMachine.ownerId,
      })
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to edit this machine."
      );
    }

    // Handle forcePromoteUserId path
    if (forcePromoteUserId !== undefined) {
      if (!checkPermission("admin.users.promote.guestToMember", accessLevel)) {
        return err(
          "UNAUTHORIZED",
          "You do not have permission to promote users."
        );
      }
      if (forcePromoteUserId !== ownerId) {
        return err(
          "VALIDATION",
          "forcePromoteUserId must match the selected owner."
        );
      }
      // Verify target user exists and is a guest
      const targetActive = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, forcePromoteUserId),
      });
      const targetInvited = targetActive
        ? null
        : await db.query.invitedUsers.findFirst({
            where: eq(invitedUsers.id, forcePromoteUserId),
          });
      if (!targetActive && !targetInvited) {
        return err("VALIDATION", "Selected user does not exist.");
      }
      if ((targetActive?.role ?? targetInvited?.role) !== "guest") {
        return err("VALIDATION", "Selected user is not a guest.");
      }

      const machineOwnerId = targetActive ? forcePromoteUserId : undefined;
      const machineInvitedOwnerId = targetInvited
        ? forcePromoteUserId
        : undefined;
      const oldOwnerId = currentMachine.ownerId;

      // Atomic: promote + update machine + update watcher
      const [machine] = await db.transaction(async (tx) => {
        // Promote guest to member
        if (targetActive) {
          await tx
            .update(userProfiles)
            .set({ role: "member" })
            .where(eq(userProfiles.id, forcePromoteUserId));
        } else {
          await tx
            .update(invitedUsers)
            .set({ role: "member" })
            .where(eq(invitedUsers.id, forcePromoteUserId));
        }

        // Update machine
        const [updatedMachine] = await tx
          .update(machines)
          .set({
            name,
            ...(presenceStatus !== undefined && { presenceStatus }),
            ownerId: machineOwnerId ?? null,
            invitedOwnerId: machineInvitedOwnerId ?? null,
          })
          .where(eq(machines.id, id))
          .returning();

        if (!updatedMachine) {
          throw new Error("Machine update failed");
        }

        // Add new owner as watcher if active user
        if (machineOwnerId) {
          await tx
            .insert(machineWatchers)
            .values({
              machineId: id,
              userId: machineOwnerId,
              watchMode: "subscribe",
            })
            .onConflictDoUpdate({
              target: [machineWatchers.machineId, machineWatchers.userId],
              set: { watchMode: "subscribe" },
            });
        }

        return [updatedMachine];
      });

      // Notify old owner (outside transaction)
      if (oldOwnerId && oldOwnerId !== machineOwnerId) {
        await db
          .delete(machineWatchers)
          .where(
            and(
              eq(machineWatchers.machineId, id),
              eq(machineWatchers.userId, oldOwnerId)
            )
          );
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

      // Notify new owner (outside transaction)
      if (machineOwnerId && machineOwnerId !== oldOwnerId) {
        await createNotification({
          type: "machine_ownership_changed",
          resourceId: machine.id,
          resourceType: "machine",
          actorId: user.id,
          includeActor: false,
          machineName: machine.name,
          newStatus: "added",
          additionalRecipientIds: [machineOwnerId],
        });
      }

      revalidatePath("/m");
      revalidatePath(`/m/${machine.initials}`);

      return ok({ machineId: machine.id });
    }

    // Resolve owner type if provided (non-forcePromote path)
    let finalOwnerId: string | null | undefined = undefined;
    let finalInvitedOwnerId: string | null | undefined = undefined;
    let shouldUpdateOwner = false;

    if (ownerId) {
      shouldUpdateOwner = true;
      const activeOwner = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, ownerId),
      });
      if (activeOwner) {
        // Validate assignee is not a guest
        if (activeOwner.role === "guest") {
          return err(
            "ASSIGNEE_NOT_MEMBER",
            "Selected owner is a guest and must be promoted to member first.",
            {
              assignee: {
                id: activeOwner.id,
                name: `${activeOwner.firstName} ${activeOwner.lastName}`,
                role: "guest",
                type: "active",
              },
            }
          );
        }
        finalOwnerId = ownerId;
        finalInvitedOwnerId = null; // Reset invited if setting active
      } else {
        // Verify the ID exists in invited_users before assigning
        const invitedOwner = await db.query.invitedUsers.findFirst({
          where: eq(invitedUsers.id, ownerId),
        });
        if (!invitedOwner) {
          return err("VALIDATION", "Selected owner does not exist.");
        }
        // Validate invited assignee is not a guest
        if (invitedOwner.role === "guest") {
          return err(
            "ASSIGNEE_NOT_MEMBER",
            "Selected owner is a guest and must be promoted to member first.",
            {
              assignee: {
                id: invitedOwner.id,
                name: `${invitedOwner.firstName} ${invitedOwner.lastName}`,
                role: "guest",
                type: "invited",
              },
            }
          );
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
      .where(eq(machines.id, id))
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
  value: ProseMirrorDoc | null
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
  value: ProseMirrorDoc | null
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
  value: ProseMirrorDoc | null
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
  value: ProseMirrorDoc | null
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "ownerNotes");
}

/**
 * Internal helper for updating a machine text field.
 *
 * Permission logic:
 * - description, tournamentNotes, ownerRequirements: owner + tech + admins
 * - ownerNotes: owner only (machines.edit.ownerNotes)
 */
async function updateMachineTextField(
  machineId: string,
  value: ProseMirrorDoc | null,
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

  // Simple validation for machineId
  if (!z.string().uuid().safeParse(machineId).success) {
    return err("VALIDATION", "Invalid machine ID");
  }

  // Validate ProseMirror payload: must be null or a well-formed doc with type:"doc"
  // Normalize empty docs to null so the DB stores NULL rather than a semantically-empty JSON blob.
  let normalizedValue: ProseMirrorDoc | null = value;
  if (value !== null) {
    if (!proseMirrorDocSchema.safeParse(value).success) {
      return err("VALIDATION", "Invalid rich text payload.");
    }
    const plainText = docToPlainText(value);
    if (plainText.length > 10_000) {
      return err("VALIDATION", "Text is too long.");
    }
    if (JSON.stringify(value).length > 100_000) {
      return err("VALIDATION", "Text is too long.");
    }
    // Normalize empty doc to null
    if (plainText.trim().length === 0) {
      normalizedValue = null;
    }
  }

  try {
    // Fetch user profile and machine in parallel
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: { id: true, ownerId: true, initials: true },
      }),
    ]);

    if (!profile) {
      return err("UNAUTHORIZED", "User profile not found.");
    }

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    const accessLevel = getAccessLevel(profile.role);
    const ctx = { userId: user.id, machineOwnerId: machine.ownerId };

    // Permission check via matrix — ownerNotes uses its own permission
    const permissionId =
      field === "ownerNotes" ? "machines.edit.ownerNotes" : "machines.edit";
    if (!checkPermission(permissionId, accessLevel, ctx)) {
      if (field === "ownerNotes") {
        return err(
          "UNAUTHORIZED",
          "Only the machine owner can edit owner notes."
        );
      }
      return err(
        "UNAUTHORIZED",
        "Only the machine owner, technicians, or admins can edit this field."
      );
    }

    // Update the field
    await db
      .update(machines)
      .set({ [field]: normalizedValue })
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
