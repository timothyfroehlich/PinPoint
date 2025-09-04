/**
 * Shared utilities for Server Actions (2025 Patterns)
 * Form handling and mutations for RSC architecture with React 19 cache API
 */

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { cache } from "react"; // React 19 cache API
// TODO: Enable when Next.js supports unstable_after in current version
// import { unstable_after } from "next/server"; // Background tasks
import type { z } from "zod";
import { createClient } from "~/lib/supabase/server";
import { requireMemberAccess } from "~/lib/organization-context";
import { requirePermission as baseRequirePermission } from "~/server/auth/permissions";
import { requireAuthContextWithRole, db } from "~/lib/dal/shared";
import { getErrorMessage } from "~/lib/utils/type-guards";
export { requireAuthContextWithRole };

/**
 * Server Action result types (React 19 useActionState compatible)
 */
export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Get authenticated user for Server Actions (React 19 cached)
 * Uses cache() to prevent duplicate auth checks within same request
 */
export const getActionAuthContext = cache(async () => {
  // Fetch full AuthUser first to preserve redirect behavior for unauthenticated users
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in");
  }

  // Validate org access using secure subdomain + membership check
  const { organization } = await requireMemberAccess();

  return { user, organizationId: organization.id };
});

/**
 * Alias for DAL compatibility (same as getServerAuthContext)
 */
export const getServerAuthContext = getActionAuthContext;

/**
 * Combined auth + permission helper for Server Actions.
 * Ensures user is authenticated, has org context and required permission.
 */
export async function requireActionAuthContextWithPermission(
  permission: string,
): Promise<{
  user: { id: string };
  organizationId: string;
  membership: { role_id?: string | null };
}> {
  const { user, organizationId, membership } =
    await requireAuthContextWithRole();
  await baseRequirePermission({ roleId: membership.role_id }, permission, db);
  return { user, organizationId, membership };
}

export type ActionAuthContextWithRole = Awaited<
  ReturnType<typeof requireAuthContextWithRole>
>;

/**
 * Safe FormData extraction with validation
 */
export function getFormField(
  formData: FormData,
  field: string,
  required = false,
): string | null {
  const value = formData.get(field);

  if (
    required &&
    (!value || typeof value !== "string" || value.trim() === "")
  ) {
    throw new Error(`${field} is required`);
  }

  return typeof value === "string" ? value.trim() : null;
}

/**
 * Validate required fields from FormData
 */
export function validateRequiredFields(
  formData: FormData,
  requiredFields: string[],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const field of requiredFields) {
    const value = getFormField(formData, field, true);
    if (value) {
      result[field] = value;
    }
  }

  return result;
}

/**
 * Enhanced result helpers for React 19 patterns
 */
export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  const result: ActionResult<T> = { success: true, data };
  if (message) {
    result.message = message;
  }
  return result;
}

export function actionError(
  error: unknown,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  const safeMessage = getErrorMessage(error);
  const result: ActionResult<never> = { success: false, error: safeMessage };
  if (fieldErrors) {
    result.fieldErrors = fieldErrors;
  }
  return result;
}

/**
 * Enhanced form validation with Zod integration
 */
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodType<T>,
): ActionResult<T> {
  const rawData = Object.fromEntries(formData.entries());

  // Convert empty strings to undefined for optional fields
  const processedData = Object.entries(rawData).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      acc[key] = value === "" ? undefined : value;
      return acc;
    },
    {},
  );

  const result = schema.safeParse(processedData);

  if (result.success) {
    return actionSuccess(result.data);
  }

  // Format Zod errors for form display
  const fieldErrors = result.error.issues.reduce<Record<string, string[]>>(
    (acc: Record<string, string[]>, issue) => {
      const path = issue.path.join(".");
      acc[path] ??= [];
      acc[path].push(issue.message);
      return acc;
    },
    {},
  );

  return actionError("Validation failed", fieldErrors);
}

/**
 * Background task runner (runs after response sent to user)
 * TODO: Enable when Next.js supports unstable_after
 */
export function runAfterResponse(task: () => Promise<void>): void {
  // For now, run immediately (in production, would use unstable_after)
  task().catch((error) => {
    console.error("Background task failed:", error);
  });
}

/**
 * Cache revalidation helpers
 */
export function revalidateIssues(): void {
  revalidatePath("/issues");
  revalidateTag("issues");
}

export function revalidateMachines(): void {
  revalidatePath("/machines");
  revalidateTag("machines");
}

export function revalidateDashboard(): void {
  revalidatePath("/dashboard");
  revalidateTag("dashboard");
}

/**
 * Wrapper exporting a membership-aware permission check for Actions code.
 * Accepts DAL membership (snake_case), adapts to permissions API shape.
 */
export async function requirePermission(
  membership: { role_id?: string | null } | null,
  permission: string,
  db: Parameters<typeof baseRequirePermission>[2],
): Promise<void> {
  await baseRequirePermission(
    { roleId: membership?.role_id ?? null },
    permission,
    db,
  );
}

/**
 * Wrapper for Server Actions with comprehensive error handling
 */
export async function withActionErrorHandling<T>(
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return actionSuccess(data);
  } catch (error) {
    console.error("Server Action error:", error);
    return actionError(
      error instanceof Error ? error.message : "An error occurred",
    );
  }
}
