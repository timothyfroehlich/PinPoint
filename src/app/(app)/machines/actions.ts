/**
 * Machine Server Actions
 *
 * Server-side mutations for machine CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createMachineSchema } from "./schemas";
import { type Result, ok, err } from "~/lib/result";
import { eq } from "drizzle-orm";

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
 * Uses redirect() for navigation, which throws to exit the function.
 * On error, sets flash message for PRG pattern.
 *
 * @param formData - Form data from machine creation form
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

  // Extract form data
  const rawData = {
    name: formData.get("name"),
  };

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { name } = validation.data;

  // Insert machine (direct Drizzle query - no DAL)
  try {
    const [machine] = await db
      .insert(machines)
      .values({
        name,
      })
      .returning();

    if (!machine) {
      throw new Error("Machine creation failed");
    }

    revalidatePath("/machines");

    return ok({ machineId: machine.id });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("createMachineAction failed", error);
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

  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
  };

  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { id, name } = validation.data;

  try {
    const [machine] = await db
      .update(machines)
      .set({ name })
      .where(eq(machines.id, id))
      .returning();

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    revalidatePath("/machines");
    revalidatePath(`/machines/${machine.id}`);

    return ok({ machineId: machine.id });
  } catch (error) {
    console.error("updateMachineAction failed", error);
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
      .where(eq(machines.id, machineId))
      .returning();

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    revalidatePath("/machines");

    return ok({ machineId });
  } catch (error) {
    console.error("deleteMachineAction failed", error);
    return err("SERVER", "Failed to delete machine. Please try again.");
  }
}
