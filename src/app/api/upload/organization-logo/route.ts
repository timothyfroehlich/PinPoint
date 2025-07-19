 
import { type NextRequest, NextResponse } from "next/server";

import type { ExtendedPrismaClient } from "~/server/db";

import { imageStorage } from "~/lib/image-storage/local-storage";
import {
  getUploadAuthContext,
  requireUploadPermission,
  type UploadAuthContext,
} from "~/server/auth/uploadAuth";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

// Database query result interfaces
interface OrganizationWithLogo {
  logoUrl: string | null;
}

interface UpdatedOrganization {
  logoUrl: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const db: ExtendedPrismaClient = dbProvider.getClient();
  try {
    // Get authenticated context with organization resolution
    const ctx: UploadAuthContext = await getUploadAuthContext(req, db);

    // Require organization management permission
    requireUploadPermission(ctx, "organization:manage");

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 },
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 },
      );
    }

    // Upload image
    const imagePath = await imageStorage.uploadImage(
      file,
      `organization-${ctx.organization.id}`,
    );

    // Delete old logo if it exists
    const currentOrg: OrganizationWithLogo | null = await db.organization.findUnique({
      where: { id: ctx.organization.id },
      select: { logoUrl: true },
    });

    if (currentOrg?.logoUrl) {
      try {
        await imageStorage.deleteImage(currentOrg.logoUrl);
      } catch (error) {
        // Ignore deletion errors for old files
        console.warn("Failed to delete old logo:", error);
      }
    }

    // Update organization logo
    const updatedOrganization: UpdatedOrganization = await db.organization.update({
      where: { id: ctx.organization.id },
      data: { logoUrl: imagePath },
    });

    return NextResponse.json({
      success: true,
      logoUrl: updatedOrganization.logoUrl,
    });
  } catch (error) {
    console.error("Organization logo upload error:", error);

    if (
      error instanceof Error &&
      error.message.includes("Permission required")
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message.includes("Authentication required")
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await dbProvider.disconnect();
  }
}
