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

  // 4 base-36 characters (1.68M values), not 4 decimal digits (10k). Initials
  // are unique-constrained, so a collision throws in whatever beforeEach called
  // this — and the comprehensive job draws a dozen-plus per run across three
  // browser projects against one database. Six characters total is the app's
  // own initials limit (the /m/new field's maxLength).
  const finalInitials =
    initials ??
    `TM${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0")}`;
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
 *
 * PP-tn6t: seeds a PUBLIC set so it is visible to every viewer (a private draft
 * would only show to its creator/admin — the pre-visibility-model default these
 * specs assume). Left as a community-kind set (is_owner_set defaults false) so
 * it stays broadly editable by staff; the owner-set-protection paths are covered
 * at the action layer.
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
      is_public: true,
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
 * Remove both required Discord notification configuration values. Useful for
 * after-test cleanup and for tests that need the integration unconfigured.
 * Does NOT remove the underlying vault secret.
 */
export async function unconfigureDiscordIntegrationForTest(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("discord_integration_config")
    .update({
      bot_token_vault_id: null,
      guild_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton");
  if (error) throw error;
}

/**
 * Configure the Discord integration with a fake bot token for E2E tests.
 *
 * Creates a vault secret, links it via `bot_token_vault_id`, and supplies a
 * test guild ID when one is not already configured. After this,
 * `getDiscordConfig()` returns a non-null config and the Discord column is
 * rendered on the notification preferences page.
 *
 * Vault writes go through a direct postgres connection because vault.* lives
 * in a separate schema that the supabase-js REST client can't reach. Pair
 * with `unconfigureDiscordIntegrationForTest()` in afterAll so the singleton
 * row is restored for tests that depend on the unconfigured state.
 */
export async function configureDiscordIntegrationForTest(): Promise<void> {
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
      SET bot_token_vault_id = ${vaultId}::uuid,
          guild_id = COALESCE(guild_id, 'e2e-test-guild-id'),
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

/** A tag name's slug, in the format the tags tables' CHECK constraints require. */
export function testTagSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a hand-applied tag type and its tags directly in the database, for
 * specs that tag machines rather than test creating the type. Names must be
 * unique per run (`getTestPrefix()`) and at most 20 characters; slugs derive
 * from them. Remove it with {@link deleteTestTagType}.
 */
export async function createTestTagType(
  name: string,
  options: {
    exclusive: boolean;
    /**
     * Tag names, or a name with its own slug: slugs are unique across every
     * tag, so a second tag sharing a name with one in another type needs one.
     */
    tags: (string | { name: string; slug: string })[];
  }
): Promise<void> {
  const { data: type, error: typeError } = await supabaseAdmin
    .from("tag_types")
    .insert({ slug: testTagSlug(name), name, exclusive: options.exclusive })
    .select("id")
    .single<{ id: string }>();
  if (typeError) throw typeError;
  if (options.tags.length === 0) return;

  const { error: tagsError } = await supabaseAdmin.from("tags").insert(
    options.tags.map((tag) => {
      const { name: tagName, slug } =
        typeof tag === "string" ? { name: tag, slug: testTagSlug(tag) } : tag;
      return {
        tag_type_id: type.id,
        type_exclusive: options.exclusive,
        slug,
        name: tagName,
      };
    })
  );
  if (tagsError) throw tagsError;
}

/**
 * Apply hand-applied tags to a machine directly in the database. Each tag is
 * found by the slug its name derives (see {@link createTestTagType}).
 */
export async function addTestMachineTags(
  machineId: string,
  tagNames: string[]
): Promise<void> {
  const { data: rows, error: tagsError } = await supabaseAdmin
    .from("tags")
    .select("id, tag_type_id, type_exclusive")
    .in("slug", tagNames.map(testTagSlug))
    .returns<
      { id: string; tag_type_id: string | null; type_exclusive: boolean }[]
    >();
  if (tagsError) throw tagsError;
  if (rows.length !== tagNames.length) {
    throw new Error(
      `Expected ${String(tagNames.length)} tags, found ${String(rows.length)}`
    );
  }

  const { error } = await supabaseAdmin.from("machine_tags").insert(
    rows.map((tag) => ({
      machine_id: machineId,
      tag_id: tag.id,
      tag_type_id: tag.tag_type_id,
      type_exclusive: tag.type_exclusive,
    }))
  );
  if (error) throw error;
}

/**
 * Delete a hand-applied tag type by its exact name. Its tags and their machine
 * memberships go with it (ON DELETE CASCADE). A safety net for specs that
 * create a tag type through the UI and may fail before deleting it there.
 */
export async function deleteTestTagType(name: string) {
  const { error } = await supabaseAdmin
    .from("tag_types")
    .delete()
    .eq("name", name);
  if (error) throw error;
}

/**
 * Generate an unsubscribe token for E2E tests.
 * Uses the same HMAC-SHA256 algorithm and signing secret as
 * src/lib/notifications/unsubscribe-token.ts. The test client must
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

/**
 * Seed a row directly into the local PinballMap catalog mirror (PP-l81u E2E).
 * Lets a test search/select a title through the real edit-form picker without
 * depending on whatever the weekly catalog refresh happens to contain, and
 * without ever reaching pinballmap.com (CORE-PBM-001/CORE-TEST-006).
 */
export async function seedPinballMapCatalogEntry(entry: {
  pinballmapMachineId: number;
  name: string;
  manufacturer?: string | null;
  year?: number | null;
  /** Pinball Map's Insider Connected eligibility for the title (spec 3.8). */
  icEligible?: boolean;
}) {
  const { error } = await supabaseAdmin.from("pinballmap_catalog").insert({
    pinballmap_machine_id: entry.pinballmapMachineId,
    name: entry.name,
    manufacturer: entry.manufacturer ?? null,
    year: entry.year ?? null,
    ic_eligible: entry.icEligible ?? false,
  });
  if (error) throw error;
}

/**
 * Remove catalog rows seeded by `seedPinballMapCatalogEntry`.
 */
export async function deletePinballMapCatalogEntries(
  pinballmapMachineIds: number[]
) {
  if (pinballmapMachineIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from("pinballmap_catalog")
    .delete()
    .in("pinballmap_machine_id", pinballmapMachineIds);
  if (error) throw error;
}

/**
 * Put a test machine on the Pinball Map lineup, directly in the DB: link it to
 * a catalog title, set intent On, and add the entry to the STORED lineup.
 *
 * All three, because since PP-o355.21 they are three separate facts and the
 * feature is the comparison between them. Setting intent alone would produce
 * Missing (we want it on the lineup, it is not there), not the
 * already-on-the-lineup state; and the abandonment a re-match records is
 * resolved from the stored lineup by the old title, so without the entry there
 * is nothing to abandon.
 *
 * The stored lineup is a captured fixture that this edits in place — no live
 * fetch, so CORE-PBM-001 / CORE-TEST-006 still hold.
 */
export async function linkMachineToPinballMap(
  machineInitials: string,
  link: {
    pinballmapMachineId: number;
    pinballmapLmxId: number;
    icEnabled?: boolean | null;
  }
) {
  const { error } = await supabaseAdmin
    .from("machines")
    .update({
      pinballmap_machine_id: link.pinballmapMachineId,
      pinballmap_intent: "on",
    })
    .eq("initials", machineInitials);
  if (error) throw error;

  await addLmxToStoredLineup(link);
}

/**
 * Link a test machine to a catalog title and set its listing intent, WITHOUT
 * touching the stored lineup — the "PinPoint wants it on Pinball Map, Pinball
 * Map does not show it" state (the lineup page's To add row).
 */
export async function setMachinePinballMapTitle(
  machineInitials: string,
  link: {
    pinballmapMachineId: number;
    intent: "on" | "off" | "no_sync";
  }
) {
  const { error } = await supabaseAdmin
    .from("machines")
    .update({
      pinballmap_machine_id: link.pinballmapMachineId,
      pinballmap_intent: link.intent,
    })
    .eq("initials", machineInitials);
  if (error) throw error;
}

/**
 * Add one entry to the stored lineup, leaving the rest of the capture alone.
 *
 * Read-modify-write rather than a JSON patch because `snapshot_json` is one
 * blob and PostgREST has no array-append; the window is acceptable here because
 * nothing else writes the singleton during an E2E run.
 */
export async function addLmxToStoredLineup(entry: {
  pinballmapMachineId: number;
  pinballmapLmxId: number;
  icEnabled?: boolean | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("pinballmap_state")
    .select("snapshot_json")
    .eq("id", "singleton")
    .single();
  if (error) throw error;

  const snapshot = data.snapshot_json as {
    lmxes: { id: number; machineId: number }[];
    machineCount: number;
  } | null;
  if (!snapshot) {
    throw new Error(
      "pinballmap_state has no stored lineup — run `pnpm run db:_seed-pinballmap-state` first."
    );
  }
  if (snapshot.lmxes.some((l) => l.id === entry.pinballmapLmxId)) return;

  snapshot.lmxes.push({
    id: entry.pinballmapLmxId,
    machineId: entry.pinballmapMachineId,
    icEnabled: entry.icEnabled ?? null,
    lastUpdatedByUsername: null,
    conditions: [],
  } as never);
  snapshot.machineCount = snapshot.lmxes.length;

  const { error: writeError } = await supabaseAdmin
    .from("pinballmap_state")
    .update({ snapshot_json: snapshot })
    .eq("id", "singleton");
  if (writeError) throw writeError;
}

/**
 * Stamp the stored lineup as just refreshed, so opening Confirm lineup does not
 * refresh it first (pinballmap spec 3.7). A refresh would replace the shared
 * stored lineup with the mock client's, dropping entries other workers seeded.
 */
export async function markStoredLineupFresh() {
  const { error } = await supabaseAdmin
    .from("pinballmap_state")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", "singleton");
  if (error) throw error;
}

/** Undo {@link addLmxToStoredLineup}, so a run does not leak into the next. */
export async function removeLmxFromStoredLineup(lmxIds: number[]) {
  const { data, error } = await supabaseAdmin
    .from("pinballmap_state")
    .select("snapshot_json")
    .eq("id", "singleton")
    .single();
  if (error) throw error;

  const snapshot = data.snapshot_json as {
    lmxes: { id: number }[];
    machineCount: number;
  } | null;
  if (!snapshot) return;

  snapshot.lmxes = snapshot.lmxes.filter((l) => !lmxIds.includes(l.id));
  snapshot.machineCount = snapshot.lmxes.length;

  const { error: writeError } = await supabaseAdmin
    .from("pinballmap_state")
    .update({ snapshot_json: snapshot })
    .eq("id", "singleton");
  if (writeError) throw writeError;
}

/**
 * Seed one imported Pinball Map comment and its timeline copies (PP-o355.4),
 * as the importer would leave them: the comment's identity row plus one
 * `pinballmap` timeline event per machine. Seeded directly rather than through
 * a sync so the test never touches the shared stored lineup and never reaches
 * pinballmap.com (CORE-PBM-001 / CORE-TEST-006). The importer itself is covered
 * by `src/test/integration/pinballmap-comment-import.test.ts`.
 */
export async function seedImportedPinballMapComment(entry: {
  conditionId: number;
  comment: string;
  username: string;
  machineIds: string[];
}) {
  const commentedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("pinballmap_comments").insert({
    condition_id: entry.conditionId,
    location_id: 26454,
    pinballmap_machine_id: 900_000_000,
    lmx_id: 900_000_000,
    comment: entry.comment,
    username: entry.username,
    commented_at: commentedAt,
  });
  if (error) throw error;

  const { error: copyError } = await supabaseAdmin
    .from("timeline_events")
    .insert(
      entry.machineIds.map((machineId) => ({
        machine_id: machineId,
        created_at: commentedAt,
        source_type: "pinballmap",
        tag: "pinballmap",
        event_data: {
          kind: "pinballmap_comment",
          conditionId: entry.conditionId,
        },
      }))
    );
  if (copyError) throw copyError;
}

/** Remove comment identity rows seeded by {@link seedImportedPinballMapComment}. */
export async function deletePinballMapComments(conditionIds: number[]) {
  if (conditionIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from("pinballmap_comments")
    .delete()
    .in("condition_id", conditionIds);
  if (error) throw error;
}

/**
 * Store a saved Stern apron card named "Card 1" on a machine, as the Apron
 * card tab would (PP-esta, PP-o23o). Returns the card's id.
 */
export async function seedSavedApronCard(
  machineId: string,
  card: { description: string; tip?: string }
): Promise<string> {
  // One paragraph per line, as the editor stores card text.
  const doc = (text: string) => ({
    type: "doc",
    content: text
      .split(/\n+/)
      .filter((line) => line.trim())
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  });
  const { data, error } = await supabaseAdmin
    .from("machine_apron_cards")
    .upsert(
      {
        machine_id: machineId,
        name: "Card 1",
        size: "stern",
        use_custom_description: true,
        description: doc(card.description),
        tip: card.tip === undefined ? null : doc(card.tip),
        tip_enabled: card.tip !== undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "machine_id,name" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Drop a user's Pinball Map account link (pinballmap spec 8.4), so a test that
 * links the shared role account leaves it unlinked for the next spec. Deletes
 * the Vault secret with the row, as Unlink does; vault.* needs a direct
 * postgres connection, like `configureDiscordIntegrationForTest`.
 */
export async function deletePinballMapLink(userId: string): Promise<void> {
  const postgresUrl =
    process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];
  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL_NON_POOLING / POSTGRES_URL not set. Check .env.local."
    );
  }

  const sql = postgres(postgresUrl, { connect_timeout: 3, max: 1 });
  try {
    await sql`
      WITH gone AS (
        DELETE FROM pinballmap_user_credentials
        WHERE user_id = ${userId}::uuid
        RETURNING token_vault_id
      )
      DELETE FROM vault.secrets WHERE id IN (SELECT token_vault_id FROM gone)
    `;
  } finally {
    await sql.end();
  }
}
