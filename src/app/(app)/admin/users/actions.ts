"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, invitedUsers, authUsers } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "~/lib/email/invite";
import { headers } from "next/headers";
import { inviteUserSchema, updateUserRoleSchema } from "./schema";

async function verifyAdmin(userId: string): Promise<void> {
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  if (currentUserProfile?.role !== "admin") {
    throw new Error("Forbidden: Only admins can perform this action");
  }
}

export async function updateUserRole(
  userId: string,
  newRole: "guest" | "member" | "admin",
  userType: "active" | "invited" = "active"
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  await verifyAdmin(user.id);

  // Validate input
  const validated = updateUserRoleSchema.parse({ userId, newRole, userType });

  // Constraint: Admin cannot demote themselves
  if (
    validated.userType === "active" &&
    validated.userId === user.id &&
    validated.newRole !== "admin"
  ) {
    throw new Error("Admins cannot demote themselves");
  }

  if (validated.userType === "active") {
    await db
      .update(userProfiles)
      .set({ role: validated.newRole })
      .where(eq(userProfiles.id, validated.userId));
  } else {
    await db
      .update(invitedUsers)
      .set({ role: validated.newRole })
      .where(eq(invitedUsers.id, validated.userId));
  }

  revalidatePath("/admin/users");
}

export async function inviteUser(
  formData: FormData
): Promise<{ ok: boolean; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  await verifyAdmin(user.id);

  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
    sendInvite: formData.get("sendInvite") === "true",
  };

  const validated = inviteUserSchema.parse(rawData);

  // Check if user already exists
  const existingUser = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, validated.email),
  });

  if (existingUser) {
    throw new Error("A user with this email already exists and is active.");
  }

  const existingInvited = await db.query.invitedUsers.findFirst({
    where: eq(invitedUsers.email, validated.email),
  });

  if (existingInvited) {
    throw new Error("This user has already been invited.");
  }

  // Create invited user
  const [newInvited] = await db
    .insert(invitedUsers)
    .values({
      firstName: validated.firstName,
      lastName: validated.lastName,
      email: validated.email,
      role: validated.role,
    })
    .returning();

  if (!newInvited) {
    throw new Error("Failed to create invited user");
  }

  if (validated.sendInvite) {
    const host = (await headers()).get("host") ?? "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const siteUrl = `${protocol}://${host}`;

    const currentUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });

    const emailResult = await sendInviteEmail({
      to: validated.email,
      firstName: validated.firstName,
      inviterName: currentUser?.name ?? "An administrator",
      siteUrl,
    });

    if (!emailResult.success) {
      throw new Error(
        `Failed to send invitation email: ${String(emailResult.error)}`
      );
    }

    await db
      .update(invitedUsers)
      .set({ inviteSentAt: new Date() })
      .where(eq(invitedUsers.id, newInvited.id));
  }

  revalidatePath("/admin/users");
  return { ok: true, userId: newInvited.id };
}

export async function resendInvite(userId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  await verifyAdmin(user.id);

  const invited = await db.query.invitedUsers.findFirst({
    where: eq(invitedUsers.id, userId),
  });

  if (!invited) {
    throw new Error("Invited user not found");
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const siteUrl = `${protocol}://${host}`;

  const currentUser = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  const emailResult = await sendInviteEmail({
    to: invited.email,
    firstName: invited.firstName,
    inviterName: currentUser?.name ?? "An administrator",
    siteUrl,
  });

  if (!emailResult.success) {
    throw new Error(
      `Failed to send invitation email: ${String(emailResult.error)}`
    );
  }

  await db
    .update(invitedUsers)
    .set({ inviteSentAt: new Date() })
    .where(eq(invitedUsers.id, userId));

  revalidatePath("/admin/users");
  return { ok: true };
}
