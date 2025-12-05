import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client for E2E Tests
 *
 * Provides admin-level operations like auto-confirming user emails.
 * Uses service role key which bypasses RLS and auth restrictions.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

// Create admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Auto-confirm a user's email using Supabase Admin API
 *
 * This bypasses the email confirmation flow for E2E tests.
 * The user must already exist (created via signup).
 *
 * **Note**: This helper lists all users to find by email, which is inefficient
 * and won't scale. This is acceptable for E2E tests against local Supabase
 * with a small number of users. For integration tests where the User object
 * is available, use the helper in `src/test/helpers/supabase.ts` instead.
 *
 * @param email - Email address of the user to confirm
 * @throws Error if user not found or confirmation fails
 */
export async function confirmUserEmail(email: string): Promise<void> {
  // Get user by email
  const { data: users, error: listError } =
    await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Update user to confirm email
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      email_confirm: true,
    }
  );

  if (updateError) {
    throw new Error(
      `Failed to confirm email for ${email}: ${updateError.message}`
    );
  }
}

/**
 * Create a test user with verified email
 */
export async function createTestUser(
  email: string,
  password = "TestPassword123"
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Test",
      last_name: "User",
    },
  });

  if (error) throw error;
  return data.user;
}

/**
 * Create a test machine directly in the database
 */
export async function createTestMachine(ownerId: string) {
  const initials = `TM${Math.floor(Math.random() * 10000)}`;
  const { data, error } = await supabaseAdmin
    .from("machines")
    .insert({
      initials,
      name: `Test Machine ${initials}`,
      owner_id: ownerId,
      next_issue_number: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
