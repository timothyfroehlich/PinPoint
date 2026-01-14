"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, invitedUsers, authUsers } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "~/lib/email/invite";
import { requireSiteUrl } from "~/lib/url";
import { inviteUserSchema, updateUserRoleSchema } from "./schema";
import { type Result, ok, err } from "~/lib/result";
import { log } from "~/lib/logger";

export type UpdateUserRoleResult = Result<
  void,
  "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "SERVER"
>;

export type InviteUserResult = Result<
  { userId: string },
  "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "SERVER"
>;

export type ResendInviteResult = Result<
  void,
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "SERVER"
>;

async function verifyAdmin(userId: string): Promise<boolean> {
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  return currentUserProfile?.role === "admin";
}

export async function updateUserRole(
  userId: string,
  newRole: "guest" | "member" | "admin",
  userType: "active" | "invited" = "active"
): Promise<UpdateUserRoleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const isAdmin = await verifyAdmin(user.id);
  if (!isAdmin) {
    return err("FORBIDDEN", "Only admins can perform this action");
  }

  // Validate input
  const validation = updateUserRoleSchema.safeParse({
    userId,
    newRole,
    userType,
  });

  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  const validated = validation.data;

  // Constraint: Admin cannot demote themselves
  if (
    validated.userType === "active" &&
    validated.userId === user.id &&
    validated.newRole !== "admin"
  ) {
    return err("VALIDATION", "Admins cannot demote themselves");
  }

  try {
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
    return ok(undefined);
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "updateUserRole",
      },
      "Failed to update user role"
    );
    return err("SERVER", "Failed to update role");
  }
}

export async function inviteUser(formData: FormData): Promise<InviteUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const isAdmin = await verifyAdmin(user.id);
  if (!isAdmin) {
    return err("FORBIDDEN", "Only admins can perform this action");
  }

  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    role: formData.get("role"),
    sendInvite: formData.get("sendInvite") === "true",
  };

  const validation = inviteUserSchema.safeParse(rawData);

  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  const validated = validation.data;

  try {
    // Check if user already exists
    const existingUser = await db.query.authUsers.findFirst({
      where: eq(authUsers.email, validated.email),
    });

    if (existingUser) {
      return err(
        "CONFLICT",
        "A user with this email already exists and is active."
      );
    }

    const existingInvited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.email, validated.email),
    });

    if (existingInvited) {
      return err("CONFLICT", "This user has already been invited.");
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
      return err("SERVER", "Failed to create invited user");
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
        log.error(
          {
            error: emailResult.error,
            action: "inviteUser.email",
          },
          "Failed to send invitation email"
        );
        // Note: User created but email failed. We still return success but could warn?
        // Or should we fail? The previous code threw an error.
        // Let's fail the action but the user is already created. Ideally we should rollback.
        // But for now, let's return a SERVER error so the UI shows failure.
        // The user is in the DB though.
        return err("SERVER", "User created but failed to send email.");
      }

      await db
        .update(invitedUsers)
        .set({ inviteSentAt: new Date() })
        .where(eq(invitedUsers.id, newInvited.id));
    }

    revalidatePath("/admin/users");
    return ok({ userId: newInvited.id });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "inviteUser",
      },
      "Invite user error"
    );
    return err("SERVER", "An unexpected error occurred");
  }
}

export async function resendInvite(userId: string): Promise<ResendInviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const isAdmin = await verifyAdmin(user.id);
  if (!isAdmin) {
    return err("FORBIDDEN", "Only admins can perform this action");
  }

  try {
    const invited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.id, userId),
    });

    if (!invited) {
      return err("NOT_FOUND", "Invited user not found");
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
          error: emailResult.error,
          action: "resendInvite",
        },
        "Failed to send invitation email"
      );
      return err("SERVER", "Failed to send invitation email");
    }

    await db
      .update(invitedUsers)
      .set({ inviteSentAt: new Date() })
      .where(eq(invitedUsers.id, userId));

    revalidatePath("/admin/users");
    return ok(undefined);
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "resendInvite",
      },
      "Resend invite error"
    );
    return err("SERVER", "An unexpected error occurred");
  }
}
