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

interface AttachmentResult {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: true;
  attachment: AttachmentResult;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const dbProvider: DatabaseProvider = getGlobalDatabaseProvider();
  const db: ExtendedPrismaClient = dbProvider.getClient();
  try {
    const ctx = await getUploadAuthContext(req, db);
    const formData = await req.formData();
    const file = formData.get("file");
    const issueId = formData.get("issueId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (typeof issueId !== "string") {
      return NextResponse.json({ error: "Issue ID required" }, { status: 400 });
    }

    const issue = await db.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        organizationId: true,
        machine: {
          select: { id: true, model: { select: { name: true } } },
        },
      },
    });

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    if (issue.organizationId !== ctx.organization.id) {
      return NextResponse.json(
        { error: "Issue not in organization" },
        { status: 403 },
      );
    }

    requireUploadPermission(ctx, "attachment:create");

    const existingAttachments = await db.attachment.count({
      where: { issueId, organizationId: ctx.organization.id },
    });

    if (existingAttachments >= 3) {
      return NextResponse.json(
        { error: "Maximum of 3 attachments allowed per issue" },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    const filePath = await imageStorage.uploadImage(file, `issue-${issueId}`);
    const attachment = await db.attachment.create({
      data: {
        url: filePath,
        fileName: file.name,
        fileType: file.type,
        issueId: issueId,
        organizationId: ctx.organization.id,
      },
    });

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        url: attachment.url,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
      },
    });
  } catch (error: unknown) {
    console.error("Issue attachment upload error:", error);

    if (error instanceof TRPCError) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        BAD_REQUEST: 400,
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
