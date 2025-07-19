import { type NextRequest, NextResponse } from "next/server";

import { imageStorage } from "~/lib/image-storage/local-storage";
import {
  getUploadAuthContext,
  requireUploadPermission,
} from "~/server/auth/uploadAuth";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

export async function POST(req: NextRequest) {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();
  try {
    // Get authenticated context
    const ctx = await getUploadAuthContext(req, db);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const issueId = formData.get("issueId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!issueId) {
      return NextResponse.json({ error: "Issue ID required" }, { status: 400 });
    }

    // Verify issue exists and belongs to organization
    const issue = await db.issue.findUnique({
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
    await requireUploadPermission(ctx, "attachment:create");

    // Check attachment count limit
    const existingAttachments = await db.attachment.count({
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
    const attachment = await db.attachment.create({
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
