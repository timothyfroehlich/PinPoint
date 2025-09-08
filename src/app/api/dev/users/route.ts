import { NextResponse } from "next/server";

import { env } from "~/env";
import { shouldEnableDevFeatures } from "~/lib/environment";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import { getSupabaseUser } from "~/server/auth/supabase";
import { getDevUsers, getDevOrganization } from "~/lib/dal/dev-users";

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

  try {
    const user = await getSupabaseUser();

    // Get the organization to fetch memberships
    const organization = await getDevOrganization();
    console.log("[DEV-API] Found organization:", organization?.name ?? "none");

    if (!organization) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 500 },
      );
    }

    // Query dev users using DAL
    console.log("[DEV-API] Querying for dev users...");
    const devUsers = await getDevUsers();

    console.log("[DEV-API] Found", devUsers.length, "dev user records");
    console.log(
      "[DEV-API] Dev user emails:",
      devUsers.map((u) => u.email),
    );

    // Transform current user for consistency
    const transformedUser = transformKeysToCamelCase(user);

    console.log("[DEV-API] Returning", devUsers.length, "users with roles");

    return NextResponse.json({
      users: devUsers,
      currentUser: transformedUser,
    });
  } catch (error) {
    console.error("Error fetching dev users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
