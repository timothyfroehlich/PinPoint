# Task 12: Implement QR Code System for Machines

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/12-implement-qr-code-system`
- **PR Target**: `epic/backend-refactor` (NOT main)

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks

## Objective

Implement QR code generation and scanning system for machines to enable the key user journey from CUJs 1.1: "A user finds a machine with a QR code, scans it, and reports an issue, attaching a photo if permitted."

## Status

- [ ] In Progress
- [ ] Completed

## Current Issues

### 1. No QR Code Support in Schema

Machine model lacks QR code fields:

- No QR code URL or identifier
- No QR code generation timestamp
- No QR code regeneration capability

### 2. Missing QR Code Generation

No system to:

- Generate QR codes for machines
- Store QR code data
- Regenerate QR codes when needed

### 3. No Public Issue Reporting Flow

Missing public endpoints for:

- QR code scanning resolution
- Anonymous issue reporting
- Machine identification from QR codes

## Implementation Steps

### 1. Add QR Code Fields to Machine Model

Update `prisma/schema.prisma`:

```prisma
model Machine {
  id             String  @id @default(cuid())
  organizationId String
  locationId     String
  modelId        String
  ownerId        String?

  // Machine ownership notification preferences
  ownerNotificationsEnabled Boolean @default(true)
  notifyOnNewIssues        Boolean @default(true)
  notifyOnStatusChanges    Boolean @default(true)
  notifyOnComments         Boolean @default(false)

  // QR Code system
  qrCodeId       String   @unique @default(cuid()) // Unique identifier for QR code
  qrCodeUrl      String?  // URL to QR code image file
  qrCodeGeneratedAt DateTime? // When QR code was last generated

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  location     Location     @relation(fields: [locationId], references: [id])
  model        Model        @relation(fields: [modelId], references: [id])
  owner        User?        @relation("MachineOwner", fields: [ownerId], references: [id])
  issues       Issue[]
  collections  Collection[]

  @@index([qrCodeId])
}
```

### 2. Create QR Code Service

Create `src/server/services/qrCodeService.ts`:

```typescript
import QRCode from "qrcode";
import { type PrismaClient } from "@prisma/client";
import { imageStorage } from "~/lib/image-storage/local-storage";

export interface QRCodeData {
  machineId: string;
  organizationId: string;
  qrCodeId: string;
}

export interface QRCodeInfo {
  qrCodeUrl: string;
  reportUrl: string;
  machineInfo: {
    id: string;
    modelName: string;
    locationName: string;
    organizationName: string;
  };
}

export class QRCodeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate QR code for a machine
   */
  async generateQRCode(machineId: string): Promise<QRCodeInfo> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Create the URL that the QR code will point to
    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(reportUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Convert data URL to File for upload
    const response = await fetch(qrCodeDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `qr-${machine.qrCodeId}.png`, {
      type: "image/png",
    });

    // Upload QR code image
    const qrCodeUrl = await imageStorage.uploadImage(
      file,
      `qr-codes/machine-${machineId}`,
    );

    // Update machine with QR code info
    await this.prisma.machine.update({
      where: { id: machineId },
      data: {
        qrCodeUrl,
        qrCodeGeneratedAt: new Date(),
      },
    });

    return {
      qrCodeUrl,
      reportUrl,
      machineInfo: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
      },
    };
  }

  /**
   * Get QR code information for a machine
   */
  async getQRCodeInfo(machineId: string): Promise<QRCodeInfo | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return null;
    }

    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return {
      qrCodeUrl: machine.qrCodeUrl || "",
      reportUrl,
      machineInfo: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
      },
    };
  }

  /**
   * Regenerate QR code for a machine
   */
  async regenerateQRCode(machineId: string): Promise<QRCodeInfo> {
    // Delete old QR code if it exists
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { qrCodeUrl: true },
    });

    if (machine?.qrCodeUrl) {
      try {
        await imageStorage.deleteImage(machine.qrCodeUrl);
      } catch (error) {
        console.warn("Failed to delete old QR code:", error);
      }
    }

    // Generate new QR code
    return this.generateQRCode(machineId);
  }

  /**
   * Resolve machine information from QR code scan
   */
  async resolveMachineFromQR(qrCodeId: string): Promise<{
    machine: {
      id: string;
      modelName: string;
      locationName: string;
      organizationName: string;
      organizationSubdomain: string;
    };
    reportUrl: string;
  } | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { qrCodeId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return null;
    }

    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return {
      machine: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
        organizationSubdomain: machine.organization.subdomain || "",
      },
      reportUrl,
    };
  }

  /**
   * Bulk generate QR codes for all machines in an organization
   */
  async generateQRCodesForOrganization(organizationId: string): Promise<{
    generated: number;
    failed: number;
    errors: string[];
  }> {
    const machines = await this.prisma.machine.findMany({
      where: { organizationId },
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const machine of machines) {
      try {
        await this.generateQRCode(machine.id);
        generated++;
      } catch (error) {
        failed++;
        errors.push(
          `Machine ${machine.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return { generated, failed, errors };
  }
}
```

### 3. Create QR Code tRPC Router

Create `src/server/api/routers/qrCode.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  organizationProcedure,
  machineEditProcedure,
  organizationManageProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { QRCodeService } from "~/server/services/qrCodeService";

export const qrCodeRouter = createTRPCRouter({
  // Generate QR code for a machine
  generate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      return service.generateQRCode(input.machineId);
    }),

  // Get QR code info for a machine
  getInfo: organizationProcedure
    .input(z.object({ machineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      const info = await service.getQRCodeInfo(input.machineId);

      if (!info) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }

      return info;
    }),

  // Regenerate QR code for a machine
  regenerate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      return service.regenerateQRCode(input.machineId);
    }),

  // Bulk generate QR codes for organization
  generateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = new QRCodeService(ctx.db);
    return service.generateQRCodesForOrganization(ctx.organization.id);
  }),

  // Public endpoint: Resolve machine from QR code
  resolve: publicProcedure
    .input(z.object({ qrCodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      const result = await service.resolveMachineFromQR(input.qrCodeId);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "QR code not found",
        });
      }

      return result;
    }),
});
```

### 4. Create Public QR Code API Route

Create `src/app/api/qr/[qrCodeId]/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { qrCodeId: string } },
) {
  try {
    const { qrCodeId } = params;

    const machine = await db.machine.findUnique({
      where: { qrCodeId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    // Redirect to the machine's report issue page
    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return NextResponse.redirect(reportUrl);
  } catch (error) {
    console.error("QR code resolution error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### 5. Install QR Code Dependencies

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

### 6. Update Machine Router

Add QR code endpoints to machine router:

```typescript
// In src/server/api/routers/machine.ts

// Generate QR code when machine is created
async createMachine(...) {
  // ... create machine logic

  // Generate QR code for new machine
  const qrCodeService = new QRCodeService(ctx.db);
  await qrCodeService.generateQRCode(newMachine.id);

  return newMachine;
}
```

### 7. Database Migration

```bash
# Install dependencies
npm install qrcode @types/qrcode

# Push schema changes
npm run db:push

# Reset database with new schema
npm run db:reset
```

## Validation Steps

### 1. TypeScript Compilation

```bash
npm run typecheck
# Should pass without QR code-related errors
```

### 2. Test QR Code Generation

1. Create a machine
2. Generate QR code
3. Verify QR code image is created
4. Test QR code scanning resolution

### 3. Test Public Access

1. Scan QR code (or visit QR URL)
2. Verify redirect to report issue page
3. Test anonymous issue reporting flow

### 4. Test Bulk Generation

1. Create multiple machines
2. Run bulk QR code generation
3. Verify all machines get QR codes

## Progress Notes

### Implementation Decisions Made:

- Used unique qrCodeId field for machine identification
- QR codes point to machine-specific report issue pages
- Stored QR code images in file storage system
- Created public API endpoints for QR code resolution

### QR Code URL Structure:

- QR codes link to: `https://{subdomain}.pinpoint.app/machines/{machineId}/report-issue`
- Public API available at: `/api/qr/{qrCodeId}` for redirection
- QR code images stored in file storage under `qr-codes/` directory

### Database Changes:

- Added qrCodeId (unique identifier)
- Added qrCodeUrl (path to QR code image)
- Added qrCodeGeneratedAt (timestamp)
- Maintained backward compatibility

## Rollback Procedure

```bash
# Remove QR code dependencies
npm uninstall qrcode @types/qrcode

# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove QR code files
rm src/server/services/qrCodeService.ts
rm src/server/api/routers/qrCode.ts
rm -rf src/app/api/qr/

# Reset database
npm run db:reset
```
