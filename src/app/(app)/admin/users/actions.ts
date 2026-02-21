"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  userProfiles,
  invitedUsers,
  authUsers,
  machines,
  issues,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "~/lib/email/invite";
import { requireSiteUrl } from "~/lib/url";
import { inviteUserSchema, updateUserRoleSchema } from "./schema";
import { log } from "~/lib/logger";

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

  try {
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
  } catch (error) {
    // Allow specific validation/permission errors to pass through
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden") ||
        error.message === "Admins cannot demote themselves")
    ) {
      throw error;
    }

    // Validation errors from Zod (if they propagate as Error)
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }

    log.error(
      {
        action: "updateUserRole",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to update user role"
    );
    throw new Error("An unexpected error occurred while updating user role", {
      cause: error,
    });
  }
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

  try {
    await verifyAdmin(user.id);

    const rawData = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      role: formData.get("role"),
      sendInvite: formData.get("sendInvite") === "true",
    };

    const validated = inviteUserSchema.parse(rawData);

    // Check both auth.users and user_profiles — a user could exist in
    // auth.users without a profile row if the handle_new_user trigger failed.
    const existingAuthUser = await db.query.authUsers.findFirst({
      where: eq(authUsers.email, validated.email),
    });

    if (existingAuthUser) {
      throw new Error("A user with this email already exists and is active.");
    }

    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.email, validated.email),
    });

    if (existingProfile) {
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
      // Security: Use configured site URL to prevent Host Header Injection
      const siteUrl = requireSiteUrl("invite-user");

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
        // Log the full error but don't expose it to the client
        log.error(
          {
            action: "inviteUser",
            email: validated.email,
            error: emailResult.error,
          },
          "Failed to send invitation email"
        );
        throw new Error("Failed to send invitation email");
      }

      await db
        .update(invitedUsers)
        .set({ inviteSentAt: new Date() })
        .where(eq(invitedUsers.id, newInvited.id));
    }

    revalidatePath("/admin/users");
    return { ok: true, userId: newInvited.id };
  } catch (error) {
    // Allow known errors to propagate
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden") ||
        error.message ===
          "A user with this email already exists and is active." ||
        error.message === "This user has already been invited." ||
        error.message === "Failed to send invitation email")
    ) {
      throw error;
    }

    // Validation errors from Zod (if they propagate as Error)
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }

    log.error(
      {
        action: "inviteUser",
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Invite user failed"
    );
    throw new Error("An unexpected error occurred while inviting the user", {
      cause: error,
    });
  }
}

export async function removeInvitedUser(
  userId: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    await verifyAdmin(user.id);

    const invited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.id, userId),
    });

    if (!invited) {
      throw new Error("Invited user not found");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ invitedOwnerId: null })
        .where(eq(machines.invitedOwnerId, userId));

      await tx
        .update(issues)
        .set({ invitedReportedBy: null })
        .where(eq(issues.invitedReportedBy, userId));

      await tx.delete(invitedUsers).where(eq(invitedUsers.id, userId));
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden") ||
        error.message === "Invited user not found")
    ) {
      throw error;
    }

    log.error(
      {
        action: "removeInvitedUser",
        userId,
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Remove invited user failed"
    );
    throw new Error(
      "An unexpected error occurred while removing the invited user",
      { cause: error }
    );
  }
}

export async function resendInvite(userId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    await verifyAdmin(user.id);

    const invited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.id, userId),
    });

    if (!invited) {
      throw new Error("Invited user not found");
    }

    // Security: Use configured site URL to prevent Host Header Injection
    const siteUrl = requireSiteUrl("resend-invite");

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
      log.error(
        {
          action: "resendInvite",
          userId,
          email: invited.email,
          error: emailResult.error,
        },
        "Failed to resend invitation email"
      );
      throw new Error("Failed to send invitation email");
    }

    await db
      .update(invitedUsers)
      .set({ inviteSentAt: new Date() })
      .where(eq(invitedUsers.id, userId));

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden") ||
        error.message === "Invited user not found" ||
        error.message === "Failed to send invitation email")
    ) {
      throw error;
    }

    log.error(
      {
        action: "resendInvite",
        userId,
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Resend invite failed"
    );
    throw new Error("An unexpected error occurred while resending the invite", {
      cause: error,
    });
  }
}
