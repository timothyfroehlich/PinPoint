"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { type Result, ok, err } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  pronouns: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(500).optional(),
});

export type UpdateProfileResult = Result<
  { success: boolean },
  "UNAUTHORIZED" | "VALIDATION" | "SERVER"
>;

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

export async function updateProfileAction(
  _prevState: UpdateProfileResult | undefined,
  formData: FormData
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Unauthorized");

  const validation = updateProfileSchema.safeParse({
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    pronouns: str(formData, "pronouns"),
    bio: str(formData, "bio"),
  });
  if (!validation.success) return err("VALIDATION", "Invalid input");

  const { firstName, lastName, pronouns, bio } = validation.data;
  try {
    await db
      .update(userProfiles)
      .set({ firstName, lastName, pronouns, bio, updatedAt: new Date() })
      .where(eq(userProfiles.id, user.id));
    revalidatePath(`/u/${user.id}`);
    revalidatePath("/", "layout");
    return ok({ success: true });
  } catch (error) {
    return serverActionError(error, "SERVER", "Failed to update profile", {
      action: "updateProfileAction",
    });
  }
}
