import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Test helpers for Supabase operations
 */

/**
 * Confirms a test user's email using the admin API.
 * This is required for integration tests when email confirmations are enabled.
 *
 * @param adminClient - Supabase client with service role key (admin privileges)
 * @param user - The user object to confirm
 * @throws Error if confirmation fails
 *
 * @example
 * ```typescript
 * const { data: signupData } = await supabase.auth.signUp({
 *   email: testEmail,
 *   password: "TestPassword123",
 * });
 *
 * if (signupData.user) {
 *   await confirmTestUserEmail(adminSupabase, signupData.user);
 * }
 * ```
 */
export async function confirmTestUserEmail(
  adminClient: SupabaseClient,
  user: User
): Promise<void> {
  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to confirm user email: ${error.message}`);
  }
}
