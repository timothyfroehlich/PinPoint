import { eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { shouldEnableDevFeatures } from "~/lib/environment";
import { getSupabaseUser } from "~/server/auth/supabase";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { users, memberships, roles, organizations } from "~/server/db/schema";

export async function GET(): Promise<NextResponse> {
  console.log("[DEV-API] Dev features enabled:", shouldEnableDevFeatures());
  console.log(
    "[DEV-API] NEXT_PUBLIC_ENABLE_DEV_FEATURES:",
    env.NEXT_PUBLIC_ENABLE_DEV_FEATURES,
  );
  console.log("[DEV-API] NODE_ENV:", env.NODE_ENV);
  console.log("[DEV-API] VERCEL_ENV:", env.VERCEL_ENV);

  if (!shouldEnableDevFeatures()) {
    console.log("[DEV-API] Dev features disabled, returning 404");
    return new NextResponse(null, { status: 404 });
  }

  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient(); // ← Use Drizzle instead of Prisma
  try {
    const user = await getSupabaseUser();

    // Get the organization to fetch memberships
    const organizationResults = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subdomain: organizations.subdomain,
      })
      .from(organizations)
      .limit(1);

    const organization = organizationResults[0];
    console.log("[DEV-API] Found organization:", organization?.name ?? "none");

    if (!organization) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 500 },
      );
    }

    // Query dev users using Drizzle
    console.log("[DEV-API] Querying for dev users...");
    const devUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.email_verified,
        image: users.image,
        bio: users.bio,
        notificationFrequency: users.notification_frequency,
        emailNotificationsEnabled: users.email_notifications_enabled,
        pushNotificationsEnabled: users.push_notifications_enabled,
        createdAt: users.created_at,
        updatedAt: users.updated_at,
        // Join membership and role data
        membershipId: memberships.id,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(memberships, eq(memberships.user_id, users.id))
      .leftJoin(roles, eq(roles.id, memberships.role_id))
      .where(like(users.email, "%@example.com"));

    console.log("[DEV-API] Found", devUsers.length, "dev user records");
    console.log(
      "[DEV-API] Dev user emails:",
      devUsers.map((u) => u.email),
    );

    // Transform results to group by user and include role information
    const userMap = new Map();
    for (const row of devUsers) {
      const userId = row.id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: row.id,
          name: row.name,
          email: row.email,
          emailVerified: row.emailVerified,
          image: row.image,
          bio: row.bio,
          notificationFrequency: row.notificationFrequency,
          emailNotificationsEnabled: row.emailNotificationsEnabled,
          pushNotificationsEnabled: row.pushNotificationsEnabled,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          role: row.roleName,
        });
      }
    }

    const usersWithRoles = Array.from(userMap.values());
    console.log(
      "[DEV-API] Returning",
      usersWithRoles.length,
      "users with roles",
    );

    return NextResponse.json({
      users: usersWithRoles,
      currentUser: user,
    });
  } catch (error) {
    console.error("Error fetching dev users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await dbProvider.disconnect();
  }
}
