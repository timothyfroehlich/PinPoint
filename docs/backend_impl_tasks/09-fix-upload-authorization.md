# Task 09: Fix Upload Authorization for RBAC System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3A development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/09-fix-upload-authorization`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-09-fix-upload-authorization/`

## Dependencies

- Task 05 (Rebuild tRPC Authorization) must be completed first
- This task addresses critical security vulnerabilities

## Objective

Replace placeholder authorization in upload endpoints with proper RBAC system integration. Currently, upload endpoints have TODO comments indicating incomplete authorization that could lead to security vulnerabilities.

## Status

- [ ] In Progress
- [ ] Completed

## Current Security Issues

### 1. Organization Logo Upload Vulnerability

`src/app/api/upload/organization-logo/route.ts:11`:

- TODO: Update authorization for new RBAC system
- Line 21: Uses placeholder "temp-org-id" instead of proper organization resolution
- Only checks for authenticated user, not organization permissions

### 2. Issue Attachment Upload Issues

`src/app/api/upload/issue/route.ts:106`:

- TODO: Attachment model no longer has organizationId in new schema
- Missing proper authorization checks
- No verification that user can attach files to the specific issue

### 3. Missing Organization Context Resolution

Both upload endpoints lack proper organization context:

- Cannot determine which organization the user is working with
- No subdomain or context-based organization resolution
- Hardcoded placeholder values

## Implementation Steps

### 1. Fix Attachment Model Multi-Tenancy

First, update `prisma/schema.prisma` to add organizationId to Attachment:

```prisma
model Attachment {
  id             String   @id @default(cuid())
  url            String
  fileName       String
  fileType       String
  createdAt      DateTime @default(now())

  // Add multi-tenancy
  organizationId String

  // Relations
  issueId        String
  issue          Issue        @relation(fields: [issueId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

### 2. Update Organization Model

Add Attachment relation to Organization:

```prisma
model Organization {
  // ... existing fields

  // Relations
  memberships     Membership[]
  locations       Location[]
  roles           Role[]
  machines        Machine[]
  issues          Issue[]
  priorities      Priority[]
  issueStatuses   IssueStatus[]
  collectionTypes CollectionType[]
  attachments     Attachment[]     // Add this line
}
```

### 3. Create Upload Authorization Utility

Create `src/server/auth/uploadAuth.ts`:

```typescript
import { type NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { hasPermission } from "./permissions";

export interface UploadAuthContext {
  session: NonNullable<Awaited<ReturnType<typeof auth>>>;
  organization: {
    id: string;
    name: string;
    subdomain: string | null;
  };
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    roleId: string;
    role: {
      id: string;
      name: string;
      permissions: { name: string }[];
    };
  };
  userPermissions: string[];
}

export async function getUploadAuthContext(
  req: NextRequest,
): Promise<UploadAuthContext> {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // 2. Resolve organization from subdomain
  const subdomain = req.headers.get("x-subdomain");
  if (!subdomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No subdomain found in request",
    });
  }

  const organization = await db.organization.findUnique({
    where: { subdomain },
  });

  if (!organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization with subdomain "${subdomain}" not found`,
    });
  }

  // 3. Get user's membership and permissions
  const membership = await db.membership.findFirst({
    where: {
      organizationId: organization.id,
      userId: session.user.id,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    });
  }

  return {
    session,
    organization,
    membership,
    userPermissions: membership.role.permissions.map((p) => p.name),
  };
}

export async function requireUploadPermission(
  ctx: UploadAuthContext,
  permission: string,
): Promise<void> {
  if (!ctx.userPermissions.includes(permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: ${permission}`,
    });
  }
}
```

### 4. Fix Organization Logo Upload

Update `src/app/api/upload/organization-logo/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { db } from "~/server/db";
import {
  getUploadAuthContext,
  requireUploadPermission,
} from "~/server/auth/uploadAuth";

export async function POST(req: NextRequest) {
  try {
    // Get authenticated context with organization resolution
    const ctx = await getUploadAuthContext(req);

    // Require organization management permission
    await requireUploadPermission(ctx, "organization:manage");

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
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
    const currentOrg = await db.organization.findUnique({
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
    const updatedOrganization = await db.organization.update({
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
  }
}
```

### 5. Fix Issue Attachment Upload

Update `src/app/api/upload/issue/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { db } from "~/server/db";
import {
  getUploadAuthContext,
  requireUploadPermission,
} from "~/server/auth/uploadAuth";

export async function POST(req: NextRequest) {
  try {
    // Get authenticated context
    const ctx = await getUploadAuthContext(req);

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
    // For now, anyone who can create issues can attach files
    // Later this could be more granular with "attachment:create" permission
    await requireUploadPermission(ctx, "issue:create");

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
  }
}
```

### 6. Add Upload Permissions to Seed Data

Update `prisma/seed.ts` to include upload permissions:

```typescript
// Add to permissions array
{
  name: "attachment:create",
  roles: ["Admin", "Technician", "Member"] // All users can attach files for now
},
{
  name: "organization:manage",
  roles: ["Admin"] // Only admins can upload organization logos
}
```

### 7. Update Attachment Queries

All attachment queries must scope by organizationId:

```typescript
// Example: In tRPC attachment router
async getIssueAttachments(issueId: string, organizationId: string) {
  return this.prisma.attachment.findMany({
    where: {
      issueId,
      organizationId, // Ensure multi-tenant isolation
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
```

### 8. Database Migration

```bash
# Push schema changes
npm run db:push

# Reset database with new schema
npm run db:reset
```

## Validation Steps

### 1. TypeScript Compilation

```bash
npm run typecheck
# Should pass without upload-related errors
```

### 2. Test Upload Authorization

Test scenarios:

- Authenticated user with permission can upload
- Unauthenticated user cannot upload
- User without permission cannot upload
- Cross-organization access is blocked

### 3. Test Organization Resolution

Verify:

- Subdomain properly resolves to organization
- User membership is verified
- Permissions are correctly checked

### 4. Manual Security Testing

1. Try uploading organization logo without admin permission (should fail)
2. Try uploading to issue in different organization (should fail)
3. Verify file size limits are enforced
4. Check file type validation works

## Progress Notes

### Implementation Decisions Made:

- Created centralized upload authorization utility
- Added organizationId to Attachment model for proper isolation
- Used existing permission system for authorization
- Implemented proper organization resolution from subdomain

### Security Improvements:

- Replaced placeholder authorization with RBAC
- Added multi-tenant isolation for attachments
- Implemented proper permission checking
- Added file size and type validation

### Database Changes:

- Added organizationId to Attachment model
- Added foreign key constraint to Organization
- Maintained data integrity and isolation

## Rollback Procedure

```bash
# Restore upload route files
git checkout HEAD -- src/app/api/upload/

# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove new auth utility
rm src/server/auth/uploadAuth.ts

# Reset database
npm run db:reset
```
