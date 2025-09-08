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
import { getRequestAuthContext } from "~/server/auth/context";
import { db } from "~/lib/dal/shared";
import { machines } from "~/server/db/schema";
import {
  generateMachineQRCode,
  validateQRCodeParams,
} from "~/lib/services/qr-code-service";
import type { ActionResult } from "~/lib/actions/shared";
import { validateFormData } from "~/lib/actions/shared";

// ================================
// VALIDATION SCHEMAS
// ================================

const CreateMachineSchema = z.object({
  name: nameSchema,
  locationId: idSchema,
  modelId: idSchema,
  ownerId: idSchema.optional(),
});

// Explicit type for better TypeScript inference
type CreateMachineData = z.infer<typeof CreateMachineSchema>;

const UpdateMachineSchema = CreateMachineSchema.partial().extend({
  id: idSchema,
});

// Explicit type for better TypeScript inference
type UpdateMachineData = z.infer<typeof UpdateMachineSchema>;

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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  // Enhanced validation with validateFormData
  const validation: ActionResult<CreateMachineData> = validateFormData(
    formData,
    CreateMachineSchema,
  );
  if (!validation.success) {
    return validation;
  }

  try {
    // Create machine with organization scoping
    const machineResult = await db
      .insert(machines)
      .values({
        id: crypto.randomUUID(),
        name: validation.data.name,
        organization_id: organizationId,
        location_id: validation.data.locationId,
        model_id: validation.data.modelId,
        owner_id: validation.data.ownerId ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning({ id: machines.id });

    const [machine] = machineResult;
    if (!machine) {
      return {
        success: false,
        error: "Failed to create machine. No data returned.",
      };
    }

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidateTag(`dashboard-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId: machine.id } };
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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  // Enhanced validation with validateFormData
  const validation: ActionResult<UpdateMachineData> = validateFormData(
    formData,
    UpdateMachineSchema,
  );
  if (!validation.success) {
    return validation;
  }

  try {
    // Build update object (only include defined values)
    const updateData: Partial<typeof machines.$inferInsert> = {
      updated_at: new Date(),
    };

    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.locationId)
      updateData.location_id = validation.data.locationId;
    if (validation.data.modelId) updateData.model_id = validation.data.modelId;
    if (validation.data.ownerId !== undefined)
      updateData.owner_id = validation.data.ownerId ?? null;

    // Update with organization scoping
    const updatedMachineResult = await db
      .update(machines)
      .set(updateData)
      .where(
        and(
          eq(machines.id, validation.data.id),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    const [updatedMachine] = updatedMachineResult;

    if (!updatedMachine) {
      return {
        success: false,
        error: "Resource not found or access denied",
      };
    }

    // Cache invalidation
    revalidateTag(`machine-${updatedMachine.id}`);
    revalidateTag(`machines-${organizationId}`);
    revalidatePath(`/machines/${updatedMachine.id}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId: updatedMachine.id } };
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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  if (!machineId) {
    return {
      success: false,
      error: "Machine ID is required",
    };
  }

  try {
    // Delete with organization scoping
    const deletedMachineResult = await db
      .delete(machines)
      .where(
        and(
          eq(machines.id, machineId),
          eq(machines.organization_id, organizationId),
        ),
      )
      .returning({ id: machines.id });

    const [deletedMachine] = deletedMachineResult;

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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  const machineIdsValue = formData.get("machineIds");
  const machineIdsString =
    typeof machineIdsValue === "string" ? machineIdsValue : "";
  const machineIds = machineIdsString ? machineIdsString.split(",") : [];

  // Enhanced validation with validateFormData (using parsed machineIds)
  const locationIdValue = formData.get("locationId");
  const ownerIdValue = formData.get("ownerId");
  const bulkData = {
    machineIds,
    locationId:
      typeof locationIdValue === "string" ? locationIdValue : undefined,
    ownerId: typeof ownerIdValue === "string" ? ownerIdValue : undefined,
  };
  const validation = BulkUpdateMachineSchema.safeParse(bulkData);
  if (!validation.success) {
    return {
      success: false,
      error: "Validation failed",
    };
  }

  try {
    // Build update object
    const updateData: Partial<typeof machines.$inferInsert> = {
      updated_at: new Date(),
    };

    if (validation.data.locationId)
      updateData.location_id = validation.data.locationId;
    if (validation.data.ownerId !== undefined)
      updateData.owner_id = validation.data.ownerId ?? null;

    // Update machines with organization scoping using inArray for multiple IDs
    const updatedMachines = await db
      .update(machines)
      .set(updateData)
      .where(
        and(
          eq(machines.organization_id, organizationId),
          // Use inArray for proper multiple ID handling
          inArray(machines.id, validation.data.machineIds),
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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  const machineIdValue = formData.get("machineId");
  const result = GenerateQRCodeSchema.safeParse({
    machineId: typeof machineIdValue === "string" ? machineIdValue : "",
  });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
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
    const updatedMachineResult = await db
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

    const [updatedMachine] = updatedMachineResult;

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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
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
    const updatedMachineResult = await db
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

    const [updatedMachine] = updatedMachineResult;

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
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Member access required");
  }
  const { org: organization } = authContext;
  const organizationId = organization.id;

  const machineIdsValue = formData.get("machineIds");
  const machineIdsString =
    typeof machineIdsValue === "string" ? machineIdsValue : "";
  const machineIds = machineIdsString ? machineIdsString.split(",") : [];

  const result = BulkQRGenerateSchema.safeParse({ machineIds });

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
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

          const updatedMachineResult = await db
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

          const [updatedMachine] = updatedMachineResult;

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
