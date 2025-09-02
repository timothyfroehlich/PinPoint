/**
 * Organization Server Actions (2025 Performance Patterns)
 * Form handling and mutations for organization management with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { nameSchema, LIMITS } from "~/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { organizations } from "~/server/db/schema";
import { db } from "~/lib/dal/shared";
import { transformKeysToSnakeCase } from "~/lib/utils/case-transformers";
import {
  requireAuthContextWithRole,
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { requirePermission } from "./shared";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
// Duplicate import removed

// Enhanced validation schemas with better error messages
const updateOrganizationProfileSchema = z.object({
  name: nameSchema,
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  website: z
    .string()
    .url("Please enter a valid website URL")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone number must be less than 20 characters")
    .optional(),
  address: z
    .string()
    .max(LIMITS.TITLE_MAX, "Address must be less than 200 characters")
    .optional(),
});

const updateOrganizationLogoSchema = z.object({
  logoUrl: z
    .string()
    .url("Please enter a valid logo URL")
    .optional()
    .or(z.literal("")),
});

/**
 * Update organization profile via Server Action (React 19 useActionState compatible)
 * Enhanced with validation and background processing
 */
export async function updateOrganizationProfileAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();
    await requirePermission(membership, PERMISSIONS.ORGANIZATION_MANAGE, db);

    // Enhanced validation with Zod
    const validation = validateFormData(
      formData,
      updateOrganizationProfileSchema,
    );
    if (!validation.success) {
      return validation;
    }

    // Update organization with validated data
    const updateData = {
      name: validation.data.name,
      description: validation.data.description ?? null,
      website: validation.data.website ?? null,
      phone: validation.data.phone ?? null,
      address: validation.data.address ?? null,
      updated_at: new Date(),
    };

    const [updatedOrg] = await db
      .update(organizations)
      .set(
        transformKeysToSnakeCase(
          updateData,
        ) as typeof organizations.$inferInsert,
      )
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id, name: organizations.name });

    if (!updatedOrg) {
      return actionError("Organization not found or access denied");
    }

    // Granular cache invalidation
    revalidatePath("/settings/organization");
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidateTag("organizations");
    revalidateTag(`organization-${organizationId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `Organization ${organizationId} profile updated by ${user.email ?? "unknown"}`,
      );
    });

    return actionSuccess(
      { success: true },
      "Organization profile updated successfully",
    );
  } catch (error) {
    console.error("Update organization profile error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to update organization profile. Please try again.",
    );
  }
}

/**
 * Update organization logo via Server Action (React 19 useActionState compatible)
 */
export async function updateOrganizationLogoAction(
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();
    await requirePermission(membership, PERMISSIONS.ORGANIZATION_MANAGE, db);

    // Enhanced validation
    const validation = validateFormData(formData, updateOrganizationLogoSchema);
    if (!validation.success) {
      return validation;
    }

    // Update logo URL
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        logo_url: validation.data.logoUrl ?? null,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id });

    if (!updatedOrg) {
      return actionError("Organization not found or access denied");
    }

    // Cache invalidation
    revalidatePath("/settings/organization");
    revalidatePath("/settings");
    revalidateTag("organizations");
    revalidateTag(`organization-${organizationId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `Organization ${organizationId} logo updated by ${user.email ?? "unknown"}`,
      );
    });

    return actionSuccess(
      { success: true },
      "Organization logo updated successfully",
    );
  } catch (error) {
    console.error("Update organization logo error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update logo",
    );
  }
}
