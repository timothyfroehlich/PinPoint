import { NextResponse } from "next/server";

import type { Prisma } from "@prisma/client";

import { shouldEnableDevFeatures } from "~/lib/environment";
import { getSupabaseUser } from "~/server/auth/supabase";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

export async function GET(): Promise<NextResponse> {
  if (!shouldEnableDevFeatures()) {
    return new NextResponse(null, { status: 404 });
  }

  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();
  try {
    const user = await getSupabaseUser();

    // Get the organization to fetch memberships
    const organization = await db.organization.findFirst();
    if (!organization) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 500 },
      );
    }

    type UserWithMemberships = Prisma.UserGetPayload<{
      include: {
        memberships: {
          include: {
            role: true;
          };
        };
      };
    }>;

    const users = (await db.user.findMany({
      where: {
        OR: [
          { email: { endsWith: "@dev.local" } },
          { email: { endsWith: "@test.com" } },
          { email: { endsWith: "@pinpoint.dev" } },
        ],
      },
      include: {
        memberships: {
          where: {
            organizationId: organization.id,
          },
          include: {
            role: true,
          },
        },
      },
    })) as UserWithMemberships[];

    // Transform users to include role information
    const usersWithRoles = users.map((user) => ({
      ...user,
      role: user.memberships[0]?.role.name ?? null,
    }));

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
