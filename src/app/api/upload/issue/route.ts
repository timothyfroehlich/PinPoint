
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
interface IssueWithMachine {
  id: string;
  organizationId: string;
  machine: {
    id: string;
    model: {
      name: string;
    };
  };
}

interface AttachmentResult {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const db: ExtendedPrismaClient = dbProvider.getClient();
  try {
    // Get authenticated context
    const ctx: UploadAuthContext = await getUploadAuthContext(req, db);

    const formData = await req.formData();
    const file = formData.get("file");
    const issueId = formData.get("issueId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!issueId || typeof issueId !== "string") {
      return NextResponse.json({ error: "Issue ID required" }, { status: 400 });
    }

    // Verify issue exists and belongs to organization
    const issue: IssueWithMachine | null = await db.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        organizationId: true,
        machine: {
          select: {
            id: true,
            model: {
              select: {
                name: true,
              },
            },
          },
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

    // Check if user has permission to attach files
    requireUploadPermission(ctx, "attachment:create");

    // Check attachment count limit
    const existingAttachments: number = await db.attachment.count({
      where: { issueId, organizationId: ctx.organization.id },
    });

    if (existingAttachments >= 3) {
      return NextResponse.json(
        { error: "Maximum of 3 attachments allowed per issue" },
        { status: 400 },
      );
    }

    // Validate file size (max 10MB for attachments)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Upload file
    const filePath = await imageStorage.uploadImage(file, `issue-${issueId}`);

    // Create attachment record with organizationId
    const attachment: AttachmentResult = await db.attachment.create({
      data: {
        url: filePath,
        fileName: file.name,
        fileType: file.type,
        issueId: issueId,
        organizationId: ctx.organization.id, // Now properly supported
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
  } catch (error) {
    console.error("Issue attachment upload error:", error);

    // Handle TRPCError with proper status code mapping
    if (error && typeof error === "object" && "code" in error) {
      const trpcError = error as { code: string; message: string };

      switch (trpcError.code) {
        case "UNAUTHORIZED":
          return NextResponse.json(
            { error: trpcError.message },
            { status: 401 },
          );
        case "FORBIDDEN":
          return NextResponse.json(
            { error: trpcError.message },
            { status: 403 },
          );
        case "NOT_FOUND":
          return NextResponse.json(
            { error: trpcError.message },
            { status: 404 },
          );
        case "BAD_REQUEST":
          return NextResponse.json(
            { error: trpcError.message },
            { status: 400 },
          );
        default:
          return NextResponse.json(
            { error: trpcError.message },
            { status: 500 },
          );
      }
    }

    // Fallback for other error types
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await dbProvider.disconnect();
  }
}
