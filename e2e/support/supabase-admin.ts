import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

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
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
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
  password = "TestPassword123",
  options?: { firstName?: string; lastName?: string }
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: options?.firstName ?? "Test",
      last_name: options?.lastName ?? "User",
    },
  });

  if (error) throw error;
  return data.user;
}

/**
 * Create a test machine directly in the database.
 *
 * Side effect: ensures the owner is at least a `member` before insert.
 * Migration 0027 added a DB trigger (check_machine_owner_not_guest) that
 * blocks INSERT/UPDATE on machines whose owner_id points to a guest. New
 * users created via Supabase auth default to `guest` (handle_new_user
 * trigger), so without this promotion the trigger would reject the insert.
 */
export async function createTestMachine(ownerId: string, initials?: string) {
  // Promote owner to member if needed (no-op if already member+)
  const { error: promoteError } = await supabaseAdmin
    .from("user_profiles")
    .update({ role: "member" })
    .eq("id", ownerId)
    .eq("role", "guest");
  if (promoteError) throw promoteError;

  const finalInitials = initials ?? `TM${Math.floor(Math.random() * 10000)}`;
  const { data, error } = await supabaseAdmin
    .from("machines")
    .insert({
      initials: finalInitials,
      name: `Test Machine ${finalInitials}`,
      owner_id: ownerId,
      next_issue_number: 1,
    })
    .select()
    .single();
  if (error) throw error;

  // Also add owner to machine_watchers (full subscribe)
  const { error: watcherError } = await supabaseAdmin
    .from("machine_watchers")
    .insert({
      machine_id: data.id,
      user_id: ownerId,
      watch_mode: "subscribe",
    });
  if (watcherError) throw watcherError;

  return data;
}

/**
 * Create an invited user directly in the database
 */
export async function createInvitedUser(
  email: string,
  firstName = "Test",
  lastName = "Invite",
  role: "guest" | "member" | "admin" = "member"
) {
  const { data, error } = await supabaseAdmin
    .from("invited_users")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      role,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a user's role directly in the database
 */
export async function updateUserRole(
  userId: string,
  role: "guest" | "member" | "admin"
) {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Delete a test user by ID (admin only)
 */
export async function deleteTestUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * Delete a test issue by machine initials and issue number
 */
export async function deleteTestIssueByNumber(
  machineInitials: string,
  issueNumber: number
) {
  // First, get the machine ID
  const { data: machine } = await supabaseAdmin
    .from("machines")
    .select("id")
    .eq("initials", machineInitials)
    .single();

  if (!machine) {
    // Machine might not exist (already deleted?), so ignore
    return;
  }

  const { error } = await supabaseAdmin
    .from("issues")
    .delete()
    .eq("machine_initials", machineInitials)
    .eq("issue_number", issueNumber);

  if (error) throw error;
}

/**
 * Set the user_profiles.discord_user_id mirror for a test user.
 * Mirrors what the auth callback would write after a Discord OAuth link.
 */
export async function setUserDiscordId(
  userId: string,
  discordUserId: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({ discord_user_id: discordUserId })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Disable the Discord integration (clears bot_token_vault_id + sets
 * enabled=false). Useful for after-test cleanup. Does NOT remove the
 * underlying vault secret — that's harmless leftover.
 */
export async function disableDiscordIntegration(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("discord_integration_config")
    .update({
      enabled: false,
      bot_token_vault_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton");
  if (error) throw error;
}

/**
 * Enable the Discord integration with a fake bot token for E2E tests.
 *
 * Creates a vault secret, links it via `bot_token_vault_id`, and sets
 * `enabled=true` on the singleton config row. After this, `getDiscordConfig()`
 * returns a non-null config and the Discord column is rendered on the
 * notification preferences page.
 *
 * Vault writes go through a direct postgres connection because vault.* lives
 * in a separate schema that the supabase-js REST client can't reach. Pair
 * with `disableDiscordIntegration()` in afterAll so the singleton row is
 * restored for tests that depend on the disabled state.
 */
export async function enableDiscordIntegrationForTest(): Promise<void> {
  const postgresUrl =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL_NON_POOLING / POSTGRES_URL not set. Check .env.local."
    );
  }

  const sql = postgres(postgresUrl, { connect_timeout: 3, max: 1 });
  try {
    const rows = (await sql`
      SELECT vault.create_secret(
        ${"e2e-fake-discord-bot-token"},
        ${`e2e_discord_bot_token_${Date.now()}`},
        'Discord bot token (E2E test)'
      ) AS id
    `) as unknown as { id: string }[];
    const vaultId = rows[0]?.id;
    if (!vaultId) {
      throw new Error("vault.create_secret returned no id");
    }

    await sql`
      UPDATE discord_integration_config
      SET enabled = true,
          bot_token_vault_id = ${vaultId}::uuid,
          updated_at = now()
      WHERE id = 'singleton'
    `;
  } finally {
    await sql.end();
  }
}

/**
 * Update notification preferences for a test user directly in the database.
 * Useful for setting up preconditions in E2E tests without UI interaction.
 */
export async function updateNotificationPreferences(
  userId: string,
  prefs: Record<string, boolean>
) {
  // Convert camelCase keys to snake_case for the database
  const snakePrefs: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(prefs)) {
    const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    snakePrefs[snakeKey] = value;
  }

  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .update(snakePrefs)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Delete a test machine by ID
 */
export async function deleteTestMachine(machineId: string) {
  const { error } = await supabaseAdmin
    .from("machines")
    .delete()
    .eq("id", machineId);
  if (error) throw error;
}

/**
 * Generate an unsubscribe token for E2E tests.
 * Uses the same HMAC-SHA256 algorithm as src/lib/notification-formatting.ts.
 */
export function generateUnsubscribeTokenForTest(userId: string): string {
  return createHmac("sha256", SUPABASE_SERVICE_ROLE_KEY)
    .update(userId + ":unsubscribe")
    .digest("hex");
}

/**
 * Clear a rich-text field on a machine (sets it to null).
 * Useful for restoring ownerRequirements / ownerNotes / description after tests.
 */
export async function clearMachineField(
  machineInitials: string,
  field:
    | "owner_requirements"
    | "owner_notes"
    | "description"
    | "tournament_notes"
) {
  const { error } = await supabaseAdmin
    .from("machines")
    .update({ [field]: null })
    .eq("initials", machineInitials);
  if (error) throw error;
}

/**
 * Get the Supabase auth user ID for a given email address.
 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

/**
 * Set the owner of a machine by machine initials.
 * Pass null to clear the owner.
 */
export async function setMachineOwner(
  machineInitials: string,
  ownerIdOrNull: string | null
) {
  const { error } = await supabaseAdmin
    .from("machines")
    .update({ owner_id: ownerIdOrNull })
    .eq("initials", machineInitials);
  if (error) throw error;
}

/**
 * Fetch notification preferences for a test user.
 */
export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}
