"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(["guest", "member", "admin"]),
});

export async function updateUserRole(
  userId: string,
  newRole: "guest" | "member" | "admin"
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify current user is admin
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (currentUserProfile?.role !== "admin") {
    throw new Error("Forbidden: Only admins can change roles");
  }

  // Validate input
  const validated = updateUserRoleSchema.parse({ userId, newRole });

  // Constraint: Admin cannot demote themselves
  if (validated.userId === user.id && validated.newRole !== "admin") {
    throw new Error("Admins cannot demote themselves");
  }

  await db
    .update(userProfiles)
    .set({ role: validated.newRole })
    .where(eq(userProfiles.id, validated.userId));

  revalidatePath("/admin/users");
}
