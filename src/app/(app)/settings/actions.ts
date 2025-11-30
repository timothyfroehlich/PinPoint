/**
 * Settings Server Actions
 *
 * Server-side mutations for user settings and profile management.
 */

"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type Result, ok, err } from "~/lib/result";

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
});

export type UpdateProfileResult = Result<
  { success: boolean },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

/**
 * Update Profile Action
 *
 * Updates the user's profile information (First Name, Last Name).
 * Also updates the 'name' field by combining first and last name for backward compatibility.
 */
export async function updateProfileAction(
  _prevState: UpdateProfileResult | undefined,
  formData: FormData
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const rawData = {
    firstName:
      typeof formData.get("firstName") === "string"
        ? (formData.get("firstName") as string)
        : undefined,
    lastName:
      typeof formData.get("lastName") === "string"
        ? (formData.get("lastName") as string)
        : undefined,
  };

  const validation = updateProfileSchema.safeParse(rawData);

  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  const { firstName, lastName } = validation.data;

  try {
    await db
      .update(userProfiles)
      .set({
        firstName,
        lastName,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, user.id));

    revalidatePath("/settings");
    revalidatePath("/", "layout"); // Update user menu in layout

    return ok({ success: true });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return err("SERVER", "Failed to update profile");
  }
}
