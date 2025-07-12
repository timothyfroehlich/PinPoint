import { type NextRequest, NextResponse } from "next/server";

import { env } from "~/env";
import { imageStorage } from "~/lib/image-storage/local-storage";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(req: NextRequest) {
  try {
    // Check authentication - require authenticated user for uploads
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve organization context from subdomain (similar to tRPC context)
    const subdomain =
      req.headers.get("x-subdomain") ?? env.DEFAULT_ORG_SUBDOMAIN;
    const organization = await db.organization.findUnique({
      where: { subdomain },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Validate user is a member of the organization
    const membership = await db.membership.findFirst({
      where: {
        organizationId: organization.id,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied - user not a member of organization" },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const issueId = formData.get("issueId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!issueId) {
      return NextResponse.json(
        { error: "No issue ID provided" },
        { status: 400 },
      );
    }

    // Validate the issue exists and belongs to the user's organization
    const issue = await db.issue.findUnique({
      where: {
        id: issueId,
        organizationId: organization.id, // Ensure issue belongs to user's organization
      },
      select: { organizationId: true },
    });

    if (!issue) {
      return NextResponse.json(
        {
          error: "Issue not found or access denied",
        },
        { status: 404 },
      );
    }

    // Check attachment count limit
    const existingAttachments = await db.attachment.count({
      where: { issueId },
    });

    if (existingAttachments >= 3) {
      return NextResponse.json(
        { error: "Maximum of 3 attachments allowed per issue" },
        { status: 400 },
      );
    }

    // Validate image file
    if (!(await imageStorage.validateIssueAttachment(file))) {
      return NextResponse.json(
        { error: "Invalid image file. Must be JPEG, PNG, or WebP under 5MB" },
        { status: 400 },
      );
    }

    // Upload image with high quality settings
    const imagePath = await imageStorage.uploadIssueAttachment(file, issueId);

    // Create attachment record
    const attachment = await db.attachment.create({
      data: {
        url: imagePath,
        issueId,
        organizationId: issue.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        url: attachment.url,
      },
    });
  } catch (error) {
    console.error("Issue attachment upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 },
    );
  }
}
