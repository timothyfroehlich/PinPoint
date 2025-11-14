/**
 * Machine Server Actions
 *
 * Server-side mutations for machine CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { createMachineSchema } from "./schemas";
import { setFlash } from "~/lib/flash";

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
export async function createMachineAction(formData: FormData): Promise<void> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({
      type: "error",
      message: "Unauthorized. Please log in.",
    });
    redirect("/login");
  }

  // Extract form data
  const rawData = {
    name: formData.get("name"),
  };

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/machines/new");
  }

  const { name } = validation.data;

  // Insert machine (direct Drizzle query - no DAL)
  let machine;
  try {
    const [result] = await db
      .insert(machines)
      .values({
        name,
      })
      .returning();
    machine = result;
  } catch (error) {
    // Database insert failed
    await setFlash({
      type: "error",
      message: "Failed to create machine. Please try again.",
    });
    redirect("/machines/new");
  }

  if (!machine) {
    await setFlash({
      type: "error",
      message: "Failed to create machine. Please try again.",
    });
    redirect("/machines/new");
  }

  // Set success flash message
  await setFlash({
    type: "success",
    message: `Machine "${name}" created successfully`,
  });

  // Revalidate machines list
  revalidatePath("/machines");

  // Redirect to machine detail page (throws - must be outside try/catch)
  redirect(`/machines/${machine.id}`);
}
