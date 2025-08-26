/**
 * Multi-Tenant Supabase Client
 *
 * Provides organization-aware Supabase client creation with built-in validation.
 * Ensures all database operations are automatically scoped to the user's organization
 * through RLS policies that read from auth.jwt() app_metadata.
 *
 * Key Features:
 * - Automatic organization context validation
 * - Type-safe organization ID extraction
 * - Clear error handling for missing organization context
 * - Compatible with existing @supabase/ssr patterns
 */

import { createClient } from "./server";
import { getUserWithOrganization } from "./rls-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Organization-aware Supabase client with validated context
 */
export interface OrganizationAwareClient {
  /** Supabase client instance (organization context automatically applied via RLS) */
  supabase: SupabaseClient;
  /** Organization ID extracted from user's app_metadata */
  organizationId: string;
  /** User object with guaranteed organization context */
  user: NonNullable<
    Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
  >;
}

/**
 * Creates a Supabase client with validated organization context.
 *
 * This function ensures:
 * 1. User is authenticated
 * 2. User has organization context in app_metadata
 * 3. RLS policies will automatically scope queries to the user's organization
 *
 * @returns Promise resolving to organization-aware client
 * @throws OrganizationContextError if user lacks organization context
 *
 * @example
 * ```typescript
 * // In Server Components or Server Actions
 * try {
 *   const { supabase, organizationId, user } = await createOrganizationAwareClient();
 *
 *   // All queries automatically scoped to user's organization via RLS
 *   const issues = await supabase
 *     .from('issues')
 *     .select('*'); // No manual organizationId filtering needed!
 *
 * } catch (error) {
 *   if (error instanceof OrganizationContextError) {
 *     redirect('/organization/select');
 *   }
 *   throw error;
 * }
 * ```
 */
export async function createOrganizationAwareClient(): Promise<OrganizationAwareClient> {
  const supabase = await createClient();
  const { user, organizationId } = await getUserWithOrganization(supabase);

  return {
    supabase,
    organizationId,
    user,
  };
}

/**
 * Creates a Supabase client with optional organization validation.
 * Returns organization context if available, or null if user lacks context.
 *
 * Useful for components that can work with or without organization context.
 *
 * @returns Promise resolving to client with optional organization context
 *
 * @example
 * ```typescript
 * const { supabase, organizationId } = await createOptionalOrganizationClient();
 *
 * if (organizationId) {
 *   // Organization-scoped operations (RLS handles filtering)
 *   const issues = await supabase.from('issues').select('*');
 * } else {
 *   // Public or non-organization operations
 *   const publicData = await supabase.from('public_content').select('*');
 * }
 * ```
 */
export async function createOptionalOrganizationClient(): Promise<{
  supabase: SupabaseClient;
  organizationId: string | null;
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const orgId = user?.app_metadata["organizationId"] as unknown;
  const organizationId = typeof orgId === "string" ? orgId : null;

  return {
    supabase,
    organizationId,
    user,
  };
}

/**
 * Type guard to check if client has organization context
 */
export function hasOrganizationContext(
  client: Awaited<ReturnType<typeof createOptionalOrganizationClient>>,
): client is OrganizationAwareClient {
  return !!(client.organizationId && client.user);
}

/**
 * Server Action wrapper that provides organization-aware Supabase client.
 * Handles authentication and organization validation automatically.
 *
 * @param action - Server Action that receives organization-aware client
 * @returns Wrapped Server Action with automatic auth/org validation
 *
 * @example
 * ```typescript
 * export const createIssue = withOrganizationClient(
 *   async ({ supabase, organizationId, user }, formData: FormData) => {
 *     // RLS automatically scopes this insert to user's organization
 *     const { data } = await supabase
 *       .from('issues')
 *       .insert({
 *         title: formData.get('title') as string,
 *         created_by: user.id,
 *         // organizationId automatically set by RLS trigger
 *       })
 *       .select()
 *       .single();
 *
 *     revalidatePath('/issues');
 *     return { success: true, issue: data };
 *   }
 * );
 * ```
 */
export function withOrganizationClient<T extends unknown[], R>(
  action: (client: OrganizationAwareClient, ...args: T) => Promise<R>,
) {
  return async (...args: T): Promise<R> => {
    const client = await createOrganizationAwareClient();
    return action(client, ...args);
  };
}
