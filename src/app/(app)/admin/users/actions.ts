"use server";

import { createClient } from "~/lib/supabase/server";
import { createAdminClient } from "~/lib/supabase/admin";
import { db } from "~/server/db";
import {
  userProfiles,
  invitedUsers,
  machines,
  issues,
} from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "~/lib/email/invite";
import { requireSiteUrl } from "~/lib/url";
import { inviteUserSchema, updateUserRoleSchema } from "./schema";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { type Result, ok, err } from "~/lib/result";

interface AdminListUsersParams {
  page?: number;
  perPage?: number;
}

type AdminListUsersResult =
  | {
      data: {
        users: { id: string; email?: string | null | undefined }[];
      };
      error: null;
    }
  | {
      data: {
        users: [];
      };
      error: Error;
    };

interface AdminClientSubset {
  auth: {
    admin: {
      listUsers: (
        params?: AdminListUsersParams
      ) => Promise<AdminListUsersResult>;
    };
  };
}

function getAdminClient(): AdminClientSubset {
  if (process.env.NODE_ENV === "test") {
    return {
      auth: {
        admin: {
          listUsers: async (params) => {
            try {
              const result = (await db.execute(
                sql`SELECT id, email FROM auth.users ORDER BY email`
              )) as unknown;
              const rows = (
                Array.isArray(result)
                  ? result
                  : typeof result === "object" &&
                      result !== null &&
                      "rows" in result &&
                      Array.isArray(result.rows)
                    ? result.rows
                    : []
              ) as { id: string; email: string | null }[];

              const all = rows.map((row) => ({
                id: row.id,
                email: row.email ?? undefined,
              }));

              // Simulate GoTrue's server-side per-page cap so callers are
              // forced to paginate — mirrors the real Admin API contract that
              // motivated PP-a4st (a single unpaginated call can miss users,
              // and a short-but-non-empty page does not mean "last page").
              const MAX_PER_PAGE = 50;
              const perPage = Math.min(params?.perPage ?? 50, MAX_PER_PAGE);
              const page = params?.page ?? 1;
              const start = (page - 1) * perPage;
              const slice = all.slice(start, start + perPage);

              return {
                data: { users: slice },
                error: null,
              };
            } catch (err) {
              return {
                data: { users: [] },
                error: err instanceof Error ? err : new Error(String(err)),
              };
            }
          },
        },
      },
    };
  }
  return createAdminClient();
}

// Page size requested from the Admin API. GoTrue caps `per_page` server-side,
// so the effective page may be smaller — we rely on the returned row count, not
// this value, to decide when to stop.
const AUTH_USERS_PER_PAGE = 1000;
// Hard safety cap on pages scanned, so a misbehaving API (e.g. one that ignores
// the `page` param and returns a full page forever) can't loop unboundedly.
// 1000 pages × 1000 rows = 1,000,000 users — far beyond any realistic org.
const AUTH_USERS_MAX_PAGES = 1000;

/**
 * Look up an auth user by email across ALL pages of the Admin API.
 *
 * The Supabase Admin API (@supabase/auth-js) exposes no `getUserByEmail`, and
 * `listUsers()` is paginated (GoTrue defaults to 50 per page). A single
 * unpaginated call therefore misses a matching email that lands on page 2+,
 * which previously let a duplicate invite slip through. (PP-a4st)
 *
 * Termination is **count-based and independent of `nextPage`**: the client
 * derives `nextPage` from an HTTP `Link` header, which is absent when the
 * server omits it and is mis-parsed for page numbers >= 10 (a known auth-js
 * bug — it reads only the first digit). We instead page until the API returns
 * an empty page. We deliberately do NOT stop on a short-but-non-empty page,
 * because GoTrue caps `per_page` server-side, so a page smaller than requested
 * does not imply the last page.
 *
 * `email` must already be normalized (lowercased/trimmed) — the invite schema
 * applies `.trim().toLowerCase()` before this runs.
 */
async function findAuthUserByEmail(
  adminClient: AdminClientSubset,
  email: string
): Promise<{ id: string } | undefined> {
  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) {
      log.error(
        { action: "inviteUser", page, err: error.message },
        "Failed to list auth users during validation"
      );
      throw error;
    }

    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      return match;
    }

    // An empty page means we've paged past the end — stop.
    if (data.users.length === 0) {
      return undefined;
    }
  }

  // Reached the page cap without an empty page: fail loud rather than silently
  // treating the email as unique on an incomplete scan.
  log.error(
    { action: "inviteUser", maxPages: AUTH_USERS_MAX_PAGES },
    "Aborting auth-user email scan: exceeded page cap"
  );
  throw new Error("Failed to verify email uniqueness against existing users");
}

async function verifyAdmin(userId: string): Promise<void> {
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  if (
    !checkPermission(
      "admin.users.roles",
      getAccessLevel(currentUserProfile?.role)
    )
  ) {
    throw new Error("Forbidden: Only admins can perform this action");
  }
}

export async function updateUserRole(
  userId: string,
  newRole: "guest" | "member" | "technician" | "admin",
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
        err: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to update user role"
    );
    throw new Error("An unexpected error occurred while updating user role", {
      cause: error,
    });
  }
}

/**
 * Result of {@link inviteUser}. On success it carries the new invited-user id
 * plus the submitted name so the client can build a display row without a
 * round-trip. Errors are returned (not thrown) so the form can surface them via
 * `useActionState` — the progressive-enhancement pattern (CORE-ARCH-002/007).
 */
export type InviteUserResult = Result<
  { userId: string; firstName: string; lastName: string },
  | "VALIDATION"
  | "FORBIDDEN"
  | "EMAIL_TAKEN"
  | "ALREADY_INVITED"
  | "EMAIL_FAILED"
  | "SERVER"
>;

export async function inviteUser(
  _prevState: InviteUserResult | undefined,
  formData: FormData
): Promise<InviteUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("FORBIDDEN", "You must be signed in to invite users.");
  }

  try {
    // Fetch role + name in one query (reused for permission check and email personalization)
    const currentUserProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true, name: true },
    });

    const accessLevel = getAccessLevel(currentUserProfile?.role);
    if (!checkPermission("admin.users.invite", accessLevel)) {
      return err("FORBIDDEN", "You do not have permission to invite users.");
    }

    const parsed = inviteUserSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      role: formData.get("role"),
      sendInvite: formData.get("sendInvite") === "true",
    });

    if (!parsed.success) {
      log.warn(
        { action: "inviteUser", errors: parsed.error.issues },
        "Invite validation failed"
      );
      return err(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }

    const validated = parsed.data;

    // Check both auth.users and user_profiles — a user could exist in
    // auth.users without a profile row if the handle_new_user trigger failed.
    // listUsers is paginated and there is no getUserByEmail, so scan every
    // page: an unpaginated call misses collisions on page 2+. (PP-a4st)
    const adminClient = getAdminClient();
    const existingAuthUser = await findAuthUserByEmail(
      adminClient,
      validated.email
    );

    if (existingAuthUser) {
      return err(
        "EMAIL_TAKEN",
        "A user with this email already exists and is active."
      );
    }

    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.email, validated.email),
    });

    if (existingProfile) {
      return err(
        "EMAIL_TAKEN",
        "A user with this email already exists and is active."
      );
    }

    const existingInvited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.email, validated.email),
    });

    if (existingInvited) {
      return err("ALREADY_INVITED", "This user has already been invited.");
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

      const emailResult = await sendInviteEmail({
        to: validated.email,
        firstName: validated.firstName,
        inviterName: currentUserProfile?.name ?? "An administrator",
        siteUrl,
      });

      if (!emailResult.success) {
        // Log the full error but don't expose it to the client. The invited
        // row is intentionally left in place (creation succeeded before the
        // email step) so the admin can resend without re-entering details.
        log.error(
          {
            action: "inviteUser",
            email: validated.email,
            err: emailResult.error,
          },
          "Failed to send invitation email"
        );
        return err("EMAIL_FAILED", "Failed to send invitation email");
      }

      await db
        .update(invitedUsers)
        .set({ inviteSentAt: new Date() })
        .where(eq(invitedUsers.id, newInvited.id));
    }

    revalidatePath("/admin/users");
    return ok({
      userId: newInvited.id,
      firstName: validated.firstName,
      lastName: validated.lastName,
    });
  } catch (error) {
    log.error(
      {
        action: "inviteUser",
        err: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Invite user failed"
    );
    return err(
      "SERVER",
      "An unexpected error occurred while inviting the user."
    );
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
        err: error instanceof Error ? error.message : "Unknown",
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
          err: emailResult.error,
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
        err: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Resend invite failed"
    );
    throw new Error("An unexpected error occurred while resending the invite", {
      cause: error,
    });
  }
}
