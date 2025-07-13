import { type NextRequest, NextResponse } from "next/server";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    // TODO: Update authorization for new RBAC system
    // Need to check user's role through membership and permissions
    // For now, just require authenticated user
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    // TODO: Get organizationId from context/subdomain instead of user session
    const organizationId = "temp-org-id"; // Placeholder - needs proper implementation

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization ID found in session" },
        { status: 400 },
      );
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    if (!(await imageStorage.validateProfilePicture(file))) {
      return NextResponse.json(
        { error: "Invalid image file. Must be JPEG, PNG, or WebP under 2MB" },
        { status: 400 },
      );
    }

    const imageUrl = await imageStorage.uploadOrganizationLogo(
      file,
      organization.subdomain ?? "default",
    );

    await db.organization.update({
      where: { id: organizationId },
      data: { logoUrl: imageUrl },
    });

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error("Organization logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 },
    );
  }
}
