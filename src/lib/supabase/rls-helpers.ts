/**
 * RLS (Row Level Security) Helper Functions
 *
 * Provides secure, non-tamperable organization context management for RLS policies.
 * Uses Supabase app_metadata (service role only) to store organizationId that RLS
 * policies can safely read from auth.jwt().
 *
 * Key Security Features:
 * - app_metadata is only modifiable by service role (non-tamperable by users)
 * - RLS policies read directly from JWT: auth.jwt() ->> 'app_metadata' ->> 'organizationId'
 * - Automatic organizational scoping without manual filtering
 */

import { createAdminClient, createClient } from "./server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Error thrown when user lacks organization context
 */
export class OrganizationContextError extends Error {
  constructor(message = "User does not have organization context") {
    super(message);
    this.name = "OrganizationContextError";
  }
}

/**
 * Updates a user's organization context in their app_metadata.
 * This function MUST use the admin client as app_metadata can only be modified by service role.
 *
 * @param userId - The user's unique identifier
 * @param organizationId - The organization ID to associate with the user
 * @throws Error if admin operation fails
 *
 * @example
 * ```typescript
 * // Called during user onboarding or organization switching
 * await updateUserOrganization('user-123', 'org-456');
 * ```
 */
export async function updateUserOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  const supabaseAdmin = await createAdminClient();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      organizationId, // RLS policies will read this automatically
    },
  });

  if (error) {
    throw new Error(`Failed to update user organization: ${error.message}`);
  }
}

/**
 * Retrieves the organization ID from the current user's app_metadata.
 * Returns null if user is not authenticated or has no organization context.
 *
 * @param supabase - Optional Supabase client, will create one if not provided
 * @returns The organization ID or null if not found
 *
 * @example
 * ```typescript
 * const orgId = await getUserOrganizationId();
 * if (!orgId) {
 *   redirect('/organization/select');
 * }
 * ```
 */
export async function getUserOrganizationId(
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = supabase ?? (await createClient());

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  const orgId = user.app_metadata?.["organizationId"] as unknown;
  return typeof orgId === "string" ? orgId : null;
}

/**
 * Retrieves the current user with validated organization context.
 * Throws OrganizationContextError if user has no organization context.
 *
 * @param supabase - Optional Supabase client, will create one if not provided
 * @returns User object with guaranteed organization context
 * @throws OrganizationContextError if user lacks organization context
 *
 * @example
 * ```typescript
 * try {
 *   const { user, organizationId } = await getUserWithOrganization();
 *   // Safe to proceed with organization-scoped operations
 * } catch (error) {
 *   if (error instanceof OrganizationContextError) {
 *     redirect('/organization/select');
 *   }
 * }
 * ```
 */
export async function getUserWithOrganization(
  supabase?: SupabaseClient,
): Promise<{
  user: NonNullable<
    Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
  >;
  organizationId: string;
}> {
  const client = supabase ?? (await createClient());

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new OrganizationContextError("User is not authenticated");
  }

  const orgId = user.app_metadata?.["organizationId"] as unknown;
  if (typeof orgId !== "string" || !orgId) {
    throw new OrganizationContextError(
      "User does not have organization context",
    );
  }

  const organizationId = orgId;

  return { user, organizationId };
}

/**
 * Removes organization context from a user's app_metadata.
 * Useful when removing user from an organization.
 *
 * @param userId - The user's unique identifier
 * @throws Error if admin operation fails
 */
export async function removeUserOrganization(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const supabaseAdmin = await createAdminClient();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      organizationId: null,
    },
  });

  if (error) {
    throw new Error(`Failed to remove user organization: ${error.message}`);
  }
}

/**
 * Type guard to check if a user has organization context
 *
 * @param user - User object from Supabase auth
 * @returns true if user has organization context
 */
export function hasOrganizationContext(
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"],
): user is NonNullable<typeof user> & {
  app_metadata: { organizationId: string };
} {
  const orgId = user?.app_metadata?.["organizationId"] as unknown;
  return typeof orgId === "string" && !!orgId;
}

/**
 * Validates that the current user has organization context for RLS policies.
 * This function ensures RLS policies will work correctly by verifying the
 * organizationId exists in app_metadata.
 *
 * @param supabase - Optional Supabase client
 * @returns Promise<void> - Resolves if valid, rejects if invalid
 * @throws OrganizationContextError if validation fails
 */
export async function validateOrganizationContext(
  supabase?: SupabaseClient,
): Promise<void> {
  await getUserWithOrganization(supabase);
}
