/**
 * Machine Server Actions
 * Phase 3B: CRUD operations with QR code management and validation
 * Following established patterns from issue-actions.ts
 */

"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { nameSchema, idSchema } from "~/lib/validation/schemas";
import { eq, and, inArray } from "drizzle-orm";
import { requireMemberAccess } from "~/lib/organization-context";
import { db } from "~/lib/dal/shared";
import { machines } from "~/server/db/schema";
import {
  generateMachineQRCode,
  validateQRCodeParams,
} from "~/lib/services/qr-code-service";
import type { ActionResult } from "~/lib/actions/shared";

// ================================
// VALIDATION SCHEMAS
// ================================

const CreateMachineSchema = z.object({
  name: nameSchema,
  locationId: idSchema,
  modelId: idSchema,
  ownerId: idSchema.optional(),
});

const UpdateMachineSchema = CreateMachineSchema.partial().extend({
  id: idSchema,
});

const BulkUpdateMachineSchema = z.object({
  machineIds: z
    .array(idSchema)
    .min(1, "At least one machine must be selected")
    .max(50, "Cannot process more than 50 machines at once"),
  locationId: idSchema.optional(),
  ownerId: idSchema.optional(),
});

const GenerateQRCodeSchema = z.object({
  machineId: idSchema,
});

const BulkQRGenerateSchema = z.object({
  machineIds: z
    .array(idSchema)
    .min(1, "At least one machine must be selected")
    .max(50, "Cannot process more than 50 machines at once"),
});

// ================================
// MACHINE CRUD OPERATIONS
// ================================

export async function createMachineAction(
  formData: FormData,
): Promise<ActionResult<{ machineId: string }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  const result = CreateMachineSchema.safeParse({
    name: formData.get("name"),
    locationId: formData.get("locationId"),
    modelId: formData.get("modelId"),
    ownerId: formData.get("ownerId") || undefined,
  });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }

  try {
    // Create machine with organization scoping
    const [machine] = await db
      .insert(machines)
      .values({
        id: crypto.randomUUID(),
        name: result.data.name,
        organization_id: organizationId,
        location_id: result.data.locationId,
        model_id: result.data.modelId,
        owner_id: result.data.ownerId || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning({ id: machines.id });

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidateTag(`dashboard-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId: machine!.id } };
  } catch (error) {
    console.error("Create machine error:", error);
    return {
      success: false,
      error: "Failed to create machine. Please try again.",
    };
  }
}

export async function updateMachineAction(
  formData: FormData,
): Promise<ActionResult<{ machineId: string }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  const result = UpdateMachineSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    locationId: formData.get("locationId"),
    modelId: formData.get("modelId"),
    ownerId: formData.get("ownerId") || undefined,
  });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }

  try {
    // Build update object (only include defined values)
    const updateData: Partial<typeof machines.$inferInsert> = {
      updated_at: new Date(),
    };

    if (result.data.name) updateData.name = result.data.name;
    if (result.data.locationId) updateData.location_id = result.data.locationId;
    if (result.data.modelId) updateData.model_id = result.data.modelId;
    if (result.data.ownerId !== undefined)
      updateData.owner_id = result.data.ownerId || null;

    // Update with organization scoping
    const [updatedMachine] = await db
      .update(machines)
      .set(updateData)
      .where(
        and(
          eq(machines.id, result.data.id),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    if (!updatedMachine) {
      return {
        success: false,
        error: "Resource not found or access denied",
      };
    }

    // Cache invalidation
    revalidateTag(`machine-${result.data.id}`);
    revalidateTag(`machines-${organizationId}`);
    revalidatePath(`/machines/${result.data.id}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId: result.data.id } };
  } catch (error) {
    console.error("Update machine error:", error);
    return {
      success: false,
      error: "Failed to update machine. Please try again.",
    };
  }
}

export async function deleteMachineAction(
  machineId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  if (!machineId) {
    return {
      success: false,
      error: "Machine ID is required",
    };
  }

  try {
    // Delete with organization scoping
    const [deletedMachine] = await db
      .delete(machines)
      .where(
        and(
          eq(machines.id, machineId),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    if (!deletedMachine) {
      return {
        success: false,
        error: "Resource not found or access denied",
      };
    }

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidateTag(`dashboard-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { deleted: true } };
  } catch (error) {
    console.error("Delete machine error:", error);
    return {
      success: false,
      error: "Failed to delete machine. Please try again.",
    };
  }
}

// ================================
// BULK OPERATIONS
// ================================

export async function bulkUpdateMachinesAction(
  formData: FormData,
): Promise<ActionResult<{ updatedCount: number }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  const machineIdsString = formData.get("machineIds") as string;
  const machineIds = machineIdsString ? machineIdsString.split(",") : [];

  const result = BulkUpdateMachineSchema.safeParse({
    machineIds,
    locationId: formData.get("locationId") || undefined,
    ownerId: formData.get("ownerId") || undefined,
  });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }

  try {
    // Build update object
    const updateData: Partial<typeof machines.$inferInsert> = {
      updated_at: new Date(),
    };

    if (result.data.locationId) updateData.location_id = result.data.locationId;
    if (result.data.ownerId !== undefined)
      updateData.owner_id = result.data.ownerId || null;

    // Update machines with organization scoping using inArray for multiple IDs
    const updatedMachines = await db
      .update(machines)
      .set(updateData)
      .where(
        and(
          eq(machines.organization_id, organizationId),
          // Use inArray for proper multiple ID handling
          inArray(machines.id, result.data.machineIds),
        ),
      )
      .returning({ id: machines.id });

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { updatedCount: updatedMachines.length } };
  } catch (error) {
    console.error("Bulk update machines error:", error);
    return {
      success: false,
      error: "Failed to update machines. Please try again.",
    };
  }
}

// ================================
// QR CODE OPERATIONS
// ================================

export async function generateQRCodeAction(
  formData: FormData,
): Promise<ActionResult<{ qrCodeUrl: string }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  const result = GenerateQRCodeSchema.safeParse({
    machineId: formData.get("machineId"),
  });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }

  // Validate machine ID format
  if (!validateQRCodeParams(result.data.machineId)) {
    return {
      success: false,
      error: "Invalid machine ID format",
    };
  }

  try {
    // Generate actual QR code using the service
    const qrCode = await generateMachineQRCode(result.data.machineId);

    // Update machine with QR code information
    const [updatedMachine] = await db
      .update(machines)
      .set({
        qr_code_id: qrCode.id,
        qr_code_url: qrCode.dataUrl, // Store the base64 data URL
        qr_code_generated_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(machines.id, result.data.machineId),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    if (!updatedMachine) {
      return {
        success: false,
        error: "Resource not found or access denied",
      };
    }

    // Cache invalidation
    revalidateTag(`machine-${result.data.machineId}`);
    revalidateTag(`machines-${organizationId}`);
    revalidatePath(`/machines/${result.data.machineId}`);
    revalidatePath("/machines");

    return { success: true, data: { qrCodeUrl: qrCode.dataUrl } };
  } catch (error) {
    console.error("Generate QR code error:", error);
    return {
      success: false,
      error: "Failed to generate QR code. Please try again.",
    };
  }
}

export async function regenerateQRCodeAction(
  machineId: string,
): Promise<ActionResult<{ qrCodeUrl: string }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  if (!machineId) {
    return {
      success: false,
      error: "Machine ID is required",
    };
  }

  // Validate machine ID format
  if (!validateQRCodeParams(machineId)) {
    return {
      success: false,
      error: "Invalid machine ID format",
    };
  }

  try {
    // Generate new QR code using the service
    const qrCode = await generateMachineQRCode(machineId);

    // Update machine with new QR code
    const [updatedMachine] = await db
      .update(machines)
      .set({
        qr_code_id: qrCode.id,
        qr_code_url: qrCode.dataUrl, // Store the base64 data URL
        qr_code_generated_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(machines.id, machineId),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    if (!updatedMachine) {
      return {
        success: false,
        error: "Resource not found or access denied",
      };
    }

    // Cache invalidation
    revalidateTag(`machine-${machineId}`);
    revalidateTag(`machines-${organizationId}`);
    revalidatePath(`/machines/${machineId}`);
    revalidatePath("/machines");

    return { success: true, data: { qrCodeUrl: qrCode.dataUrl } };
  } catch (error) {
    console.error("Regenerate QR code error:", error);
    return {
      success: false,
      error: "Failed to regenerate QR code. Please try again.",
    };
  }
}

export async function bulkGenerateQRCodesAction(
  formData: FormData,
): Promise<ActionResult<{ processedCount: number }>> {
  const { organization } = await requireMemberAccess();
  const organizationId = organization.id;

  const machineIdsString = formData.get("machineIds") as string;
  const machineIds = machineIdsString ? machineIdsString.split(",") : [];

  const result = BulkQRGenerateSchema.safeParse({ machineIds });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: result.error.flatten().fieldErrors,
    };
  }

  try {
    let processedCount = 0;

    // Process machines in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < result.data.machineIds.length; i += batchSize) {
      const batch = result.data.machineIds.slice(i, i + batchSize);

      // Process each machine in the batch
      for (const machineId of batch) {
        try {
          // Validate machine ID before processing
          if (!validateQRCodeParams(machineId)) {
            console.error(`Invalid machine ID format: ${machineId}`);
            continue;
          }

          // Generate actual QR code
          const qrCode = await generateMachineQRCode(machineId);

          const [updatedMachine] = await db
            .update(machines)
            .set({
              qr_code_id: qrCode.id,
              qr_code_url: qrCode.dataUrl, // Store the base64 data URL
              qr_code_generated_at: new Date(),
              updated_at: new Date(),
            })
            .where(
              and(
                eq(machines.id, machineId),
                eq(machines.organization_id, organizationId),
              ),
            )
            .returning({ id: machines.id });

          if (updatedMachine) {
            processedCount++;
          }
        } catch (error) {
          console.error(
            `Failed to generate QR for machine ${machineId}:`,
            error,
          );
        }
      }
    }

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { processedCount } };
  } catch (error) {
    console.error("Bulk QR generation error:", error);
    return {
      success: false,
      error: "Failed to generate QR codes. Please try again.",
    };
  }
}

// ================================
// HELPER FUNCTIONS
// ================================
