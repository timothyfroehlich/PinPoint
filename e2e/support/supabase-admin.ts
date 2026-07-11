import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Supabase Admin Client for E2E Tests
 *
 * Provides admin-level operations like auto-confirming user emails.
 * Uses service role key which bypasses RLS and auth restrictions.
 */

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

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
 * Seed a machine settings set (PP-43q3) directly in the database for E2E setup.
 * `sections` is the persist-ready `SettingsSection[]` shape (no client `_key`).
 * Returns the inserted set's id.
 */
export async function seedSettingsSet(
  machineId: string,
  name: string,
  sections: unknown[]
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("machine_settings_sets")
    .insert({
      machine_id: machineId,
      name,
      sections,
      is_preferred: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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
    process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];
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
 * Uses the same HMAC-SHA256 algorithm and signing secret as
 * src/lib/notifications/channels/email-channel.ts. The test client must
 * derive tokens using the same UNSUBSCRIBE_SIGNING_SECRET that the dev
 * server uses to verify them, otherwise verification fails.
 */
export function generateUnsubscribeTokenForTest(userId: string): string {
  const secret = process.env["UNSUBSCRIBE_SIGNING_SECRET"];
  if (!secret) {
    throw new Error(
      "Missing UNSUBSCRIBE_SIGNING_SECRET — required for unsubscribe E2E tests. Set it in .env.local (and in CI workflow env)."
    );
  }
  return createHmac("sha256", secret)
    .update(userId + ":unsubscribe")
    .digest("hex");
}

/**
 * Clear a rich-text field on a machine (sets it to null).
 * Useful for restoring ownerRequirements / description after tests.
 */
export async function clearMachineField(
  machineInitials: string,
  field: "owner_requirements" | "description"
) {
  const { error } = await supabaseAdmin
    .from("machines")
    .update({ [field]: null })
    .eq("initials", machineInitials);
  if (error) throw error;
}

/**
 * Get a user_profiles id by email via a direct DB read.
 *
 * `user_profiles.id` is the same UUID as the Supabase `auth.users.id` (enforced
 * by a cross-schema FK), so this returns the auth user id too — use it anywhere
 * an auth user id is needed. Being an exact single-row query against the profiles
 * table, it never misses a user regardless of how large `auth.users` grows,
 * unlike an unpaginated `auth.admin.listUsers()` scan (PP-ph46).
 */
export async function getProfileIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Delete throwaway invite-signup auth users (emails ending in `@example.com`)
 * that accumulate in `auth.users` across E2E runs.
 *
 * Neither `db:fast-reset` nor the `/api/test-data/cleanup` endpoint can remove
 * `auth.users` rows — the Postgres role can't DELETE from the auth schema, so
 * only the Admin API can. Left unswept, these rows pile up unbounded and once
 * `auth.users` exceeds a page (~50) they broke unpaginated `listUsers()` email
 * lookups (PP-ph46). Seed users are `@test.com` / `@pinpoint.internal`, so the
 * `@example.com` filter never touches them.
 *
 * Pagination is count-based — we page until an empty page rather than trusting
 * the auth-js `nextPage`/Link-header derivation, which is unreliable (PP-a4st,
 * the same bug class fixed in prod as #1634). GoTrue caps per_page server-side,
 * so a short-but-non-empty page is NOT necessarily the last one; only an empty
 * page ends the scan. If the scan hits the hard page cap without ever seeing an
 * empty page it throws rather than proceed silently — exhausting the cap means
 * the scan is incomplete, which would leave the DB dirty and hide a pagination/
 * API fault (reintroducing the exact flake this fixes). Returns the number of
 * users deleted.
 */
export async function cleanupInviteSignupUsers(): Promise<number> {
  const perPage = 1000;
  const maxPages = 1000;
  const idsToDelete: string[] = [];
  let scanComplete = false;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    if (data.users.length === 0) {
      scanComplete = true;
      break;
    }
    for (const user of data.users) {
      if (user.email?.toLowerCase().endsWith("@example.com")) {
        idsToDelete.push(user.id);
      }
    }
  }

  if (!scanComplete) {
    throw new Error(
      `cleanupInviteSignupUsers: auth.users scan hit the ${maxPages}-page cap ` +
        `without reaching an empty page — scan incomplete, aborting to avoid a ` +
        `partial sweep. Check the Admin API / pagination.`
    );
  }

  for (const id of idsToDelete) {
    await deleteTestUser(id);
  }

  return idsToDelete.length;
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
    .update({
      owner_id: ownerIdOrNull,
      ...(ownerIdOrNull !== null ? { invited_owner_id: null } : {}),
    })
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
