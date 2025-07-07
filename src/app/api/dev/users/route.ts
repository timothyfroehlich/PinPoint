import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const session = await auth();

    // Get the organization to fetch memberships
    const organization = await db.organization.findFirst();
    if (!organization) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 500 },
      );
    }

    const users = await db.user.findMany({
      where: {
        OR: [
          { email: { endsWith: "testaccount.dev" } },
          { email: "email9@example.com" },
        ],
      },
      include: {
        memberships: {
          where: {
            organizationId: organization.id,
          },
        },
      },
    });

    // Transform users to include role information
    const usersWithRoles = users.map((user) => ({
      ...user,
      role: user.memberships[0]?.role ?? null,
    }));

    return NextResponse.json({
      users: usersWithRoles,
      currentUser: session?.user,
    });
  } catch (error) {
    console.error("Error fetching dev users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
