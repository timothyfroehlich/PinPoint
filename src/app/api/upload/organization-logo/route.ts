import { TRPCError } from "@trpc/server";
import { type NextRequest, NextResponse } from "next/server";

import { imageStorage } from "~/lib/image-storage/local-storage";
import {
  getUploadAuthContext,
  requireUploadPermission,
} from "~/server/auth/uploadAuth";
import { type ExtendedPrismaClient } from "~/server/db";
import {
  getGlobalDatabaseProvider,
  type DatabaseProvider,
} from "~/server/db/provider";

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: true;
  logoUrl: string | null;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const dbProvider: DatabaseProvider = getGlobalDatabaseProvider();
  const db: ExtendedPrismaClient = dbProvider.getClient();
  try {
    const ctx = await getUploadAuthContext(req, db);
    requireUploadPermission(ctx, "organization:manage");

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 },
      );
    }

    const imagePath = await imageStorage.uploadImage(
      file,
      `organization-${ctx.organization.id}`,
    );

    const currentOrg = await db.organization.findUnique({
      where: { id: ctx.organization.id },
      select: { logoUrl: true },
    });

    if (currentOrg?.logoUrl) {
      try {
        await imageStorage.deleteImage(currentOrg.logoUrl);
      } catch (e) {
        console.warn("Failed to delete old logo:", e);
      }
    }

    const updatedOrganization = await db.organization.update({
      where: { id: ctx.organization.id },
      data: { logoUrl: imagePath },
    });

    return NextResponse.json({
      success: true,
      logoUrl: updatedOrganization.logoUrl,
    });
  } catch (error: unknown) {
    console.error("Organization logo upload error:", error);

    if (error instanceof TRPCError) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
      };
      const statusCode = statusMap[error.code] ?? 500;
      return NextResponse.json(
        { error: error.message },
        { status: statusCode },
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    await dbProvider.disconnect();
  }
}
