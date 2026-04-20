# Discord Admin Config Subpage Implementation Plan (PR 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-configurable Discord bot integration infrastructure — a singleton-row `discord_integration_config` table, Supabase Vault-backed bot token storage, admin-only RLS, a server accessor, a matrix permission, and an `/admin/integrations/discord` subpage with status / configuration / test sections. No runtime DM delivery (that is PR 4).

**Architecture:** One new Drizzle table with an `id = 'singleton'` constraint row that stores non-secret config (guild ID, invite link, enabled flag, bot health). The bot token itself lives in Supabase Vault (`vault.decrypted_secrets`) referenced by a UUID column. A SQL `SECURITY DEFINER` function — callable only by `service_role` — joins the config row and the decrypted vault secret into a single payload. The Next.js server accessor (`getDiscordConfig`) invokes that RPC through the existing `createAdminClient()` (service-role Supabase client) and returns a typed `DiscordConfig | null`. RLS on the config table admits `admin` via the existing `request.user_role` session context used elsewhere in PinPoint. A new `admin.integrations.manage` matrix permission gates the admin UI and server actions.

**Tech Stack:** Drizzle ORM (PostgreSQL 17), Supabase Vault (`pgsodium`-backed), Supabase service-role client, Next.js 15 App Router, Server Components + Server Actions, shadcn/ui (Card, Input, Button, Switch, Badge), Zod validation, Vitest + PGlite (integration tests), Playwright (E2E smoke).

**Spec:** `docs/superpowers/specs/2026-04-19-discord-integration-design.md` (§ PR 3)

**Bead:** PP-mud (epic PP-bsy)

---

## Context7 — Supabase Vault findings

These API signatures are confirmed against current Supabase docs (retrieved 2026-04-20):

| Operation             | SQL call                                                                                                                    | Returns                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Create secret         | `vault.create_secret(secret text, name text DEFAULT NULL, description text DEFAULT NULL)`                                   | `uuid` (the new secret's ID) |
| Update secret         | `vault.update_secret(id uuid, new_secret text DEFAULT NULL, new_name text DEFAULT NULL, new_description text DEFAULT NULL)` | `void`                       |
| Read decrypted secret | `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1`                                                        | `text`                       |
| Delete secret         | `DELETE FROM vault.decrypted_secrets WHERE id = $1` (via service-role direct SQL)                                           | n/a                          |

**Access control rules (confirmed via Supabase troubleshooting docs):**

- The `vault` schema is NOT in PostgREST's exposed schemas. PostgREST roles (`anon`, `authenticated`) get HTTP 42501 if they try to touch it directly. We want that — it's the security boundary.
- A **`SECURITY DEFINER`** function created in the `public` schema by the `postgres` superuser CAN read `vault.decrypted_secrets`. Authors must audit the function body carefully because it runs with the definer's privileges.
- The SQL function we ship is called only from server-side code via the **service-role Supabase client** (which already bypasses RLS). We further gate it with `EXECUTE` granted only to `service_role` (revoke from `PUBLIC`, `anon`, `authenticated`).

**Permission pitfalls to avoid:**

1. Never `GRANT EXECUTE ... TO anon` or `authenticated` on the definer function. It would expose the bot token to any logged-in user via an RPC call.
2. Do not put the definer function in a schema listed under Supabase's "Exposed schemas" config — per Supabase's auth-deep-dive docs, definer functions in exposed schemas can bypass intended access controls. We keep it in `public` only because `public` is already exposed; we mitigate by restricting `EXECUTE`.
3. `vault.update_secret` is a function, not a direct UPDATE on `vault.decrypted_secrets`. Writing to the view directly fails silently or errors depending on version.
4. When rotating a token, always `UPDATE` the same vault row via `vault.update_secret()` — do NOT `create_secret` a new row and orphan the old one. Orphaned secrets accumulate without cleanup.

---

## File Structure

| File                                                               | Responsibility                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts`                                          | Add `discordIntegrationConfig` table export                                                                                         |
| `drizzle.config.ts`                                                | Add `"discord_integration_config"` to `tablesFilter`                                                                                |
| `drizzle/0028_discord_admin_config.sql`                            | Create table, singleton check constraint, enable RLS, admin-only policies, `get_discord_config()` SECURITY DEFINER function, grants |
| `drizzle/meta/0028_snapshot.json`                                  | Drizzle snapshot (auto-generated by `pnpm db:generate`)                                                                             |
| `drizzle/meta/_journal.json`                                       | Journal entry (auto-updated by `pnpm db:generate`)                                                                                  |
| `src/lib/discord/config.ts`                                        | `getDiscordConfig()` server accessor; `DiscordConfig` type                                                                          |
| `src/lib/discord/config.test.ts`                                   | Unit tests for accessor (mocked service-role client)                                                                                |
| `src/lib/permissions/matrix.ts`                                    | Add `admin.integrations.manage` permission                                                                                          |
| `src/app/(app)/admin/integrations/layout.tsx`                      | Optional breadcrumb/wrapper; delegates to parent admin layout                                                                       |
| `src/app/(app)/admin/integrations/discord/page.tsx`                | Server Component: renders status + config + test sections                                                                           |
| `src/app/(app)/admin/integrations/discord/actions.ts`              | Server actions: `updateDiscordConfig`, `rotateBotToken`, `sendTestDm`                                                               |
| `src/app/(app)/admin/integrations/discord/schema.ts`               | Zod schemas: `updateDiscordConfigSchema`, `rotateBotTokenSchema`                                                                    |
| `src/app/(app)/admin/integrations/discord/discord-config-form.tsx` | Client form component (Switch, Input, Button)                                                                                       |
| `src/app/(app)/admin/integrations/discord/test-dm-button.tsx`      | Client button with inline result area                                                                                               |
| `src/app/(app)/admin/integrations/discord/bot-token-field.tsx`     | Client sub-component: `••••••` placeholder with Replace/Set button                                                                  |
| `src/components/layout/user-menu-client.tsx`                       | Add "Integrations" link to admin submenu                                                                                            |
| `src/test/integration/supabase/discord-config-rls.test.ts`         | RLS: admin can read/write, member/guest cannot; service-role can call `get_discord_config()`                                        |
| `src/test/unit/lib/discord/config.test.ts`                         | Accessor unit tests                                                                                                                 |
| `e2e/smoke/admin-discord-integration.spec.ts`                      | E2E smoke: admin loads page, saves config, hits test button                                                                         |

---

## Data model decisions

**Singleton row pattern.** `discord_integration_config` has exactly one row, keyed by a constant string `'singleton'` in a text PK column, enforced by `CHECK (id = 'singleton')`. This is simpler than `SELECT ... LIMIT 1` and makes `ON CONFLICT (id) DO UPDATE` idempotent. The initial row is seeded in the migration with `enabled = false` and all nullable fields NULL so the app has something to read before any admin touches it.

**Columns (final):**

| Column               | Type        | Nullable | Default       | Purpose                                                                               |
| -------------------- | ----------- | -------- | ------------- | ------------------------------------------------------------------------------------- | --------- | ----------- |
| `id`                 | text        | NOT NULL | `'singleton'` | PK, enforced single row                                                               |
| `enabled`            | boolean     | NOT NULL | `false`       | Master toggle                                                                         |
| `guild_id`           | text        | NULL     | NULL          | APC Discord server ID                                                                 |
| `invite_link`        | text        | NULL     | NULL          | URL shown in PR 5 warnings                                                            |
| `bot_token_vault_id` | uuid        | NULL     | NULL          | FK-in-spirit to `vault.secrets.id`; no enforced FK (cross-schema, Drizzle limitation) |
| `bot_health_status`  | text        | NOT NULL | `'unknown'`   | Enum via CHECK: `'unknown'                                                            | 'healthy' | 'degraded'` |
| `last_bot_check_at`  | timestamptz | NULL     | NULL          | Populated by PR 5                                                                     |
| `updated_at`         | timestamptz | NOT NULL | `now()`       | Audit                                                                                 |
| `updated_by`         | uuid        | NULL     | NULL          | `auth.users(id)` — no FK (cross-schema)                                               |

`bot_health_status` and `last_bot_check_at` land in this PR even though PR 5 writes to them — cheaper to add nullable columns once than to migrate again.

**Indexes:** none needed (single row table). No foreign keys are declared across schema boundaries (`auth`, `vault`); the Drizzle schema omits them and documentation in the migration explains why.

---

## Migration patterns to follow

- Existing RLS policies (e.g., `drizzle/0008_email_privacy_rls.sql`) use `current_setting('request.user_role', true)` with a JWT fallback. We reuse that pattern exactly — NO new session-context mechanism.
- `--> statement-breakpoint` separates DDL statements for drizzle-kit (see `drizzle/0027_machine_owner_member_invariant.sql`).
- `drizzle-kit` regenerates the `_journal.json` and `_snapshot.json` files; we do NOT hand-edit them. The `.sql` file is primary.
- After adding the new table to `src/server/db/schema.ts`, we must also add `"discord_integration_config"` to the `tablesFilter` array in `drizzle.config.ts` — there is a ⚠️ comment at the top of `schema.ts` reminding us.

---

## Routing decision

**Admin page lives at `/admin/integrations/discord`**, matching the spec (§ PR 3, line 167). Reasons:

1. Existing admin routes already use `/admin/<resource>/<sub>` nesting (`/admin/users`). Extending with `/admin/integrations/<provider>` parallels that.
2. Future integrations (Slack, Teams, etc.) slot in as siblings: `/admin/integrations/slack`, so the `integrations` path segment earns its keep.
3. Admin auth is already enforced by `src/app/(app)/admin/layout.tsx`. A nested route inherits the layout's gate automatically — no redundant admin check needed at the page level. (Server actions still re-check permission, because the layout is a view-layer gate and actions can be called directly.)

An optional `src/app/(app)/admin/integrations/layout.tsx` is included as a shell in case a later PR wants an "Integrations" sidebar / tab bar. For PR 3, it just renders `{children}`.

---

## Permissions decision

Add one new permission: **`admin.integrations.manage`** — admin only. Reusing `admin.access` is tempting but too coarse — a future "Integrations Manager" sub-role (member-tier staff who flip the feature toggle during outages but can't manage users) would need to be wedged in later, and a dedicated permission ID lets us change it without a matrix restructure. For PR 3 all four non-admin tiers are `false`.

Matrix entry (added under the existing `admin` category):

```typescript
{
  id: "admin.integrations.manage",
  label: "Manage integrations",
  description:
    "View and configure third-party integrations (Discord bot, etc.)",
  access: {
    unauthenticated: false,
    guest: false,
    member: false,
    technician: false,
    admin: true,
  },
},
```

Every server action in `actions.ts` starts with:

```typescript
const accessLevel = getAccessLevel(profile?.role);
if (!checkPermission("admin.integrations.manage", accessLevel)) {
  throw new Error(
    "Forbidden: You do not have permission to manage integrations"
  );
}
```

Per NON_NEGOTIABLE #14, this MUST go through `checkPermission` — no standalone `if (role !== "admin")` checks. The admin layout's `profile?.role !== "admin"` check remains and is annotated `// permissions-audit-allow` (same pattern as existing admin pages — there's an open cleanup bead PP-wwf for that layer).

---

## Secrets hygiene

- Bot token is ONLY ever returned from `getDiscordConfig()`. Nothing else reads the vault.
- The accessor's return type marks `botToken` as a branded `BotToken` string (`type BotToken = string & { readonly __brand: "BotToken" }`). All `log.error` / `log.info` call sites in this plan log `{ hasBotToken: !!config.botToken }` — NEVER the token itself. A grep guard is added to `scripts/audit/` in a later task (optional hardening — if time-boxed, skip).
- Server actions that accept a new token value read it from `FormData` and immediately pass to `vault.create_secret()` / `vault.update_secret()`. The raw string NEVER lands in application logs, even on error — the `actions.ts` catch block redacts by logging `{ hasToken: rawToken.length > 0 }`.
- The `••••••` placeholder behavior: when the DB row has `bot_token_vault_id IS NOT NULL`, the page renders a disabled input with placeholder `"••••••••••"` plus a "Replace" button. Submitting without clicking Replace sends an empty token field, and the action interprets empty as "keep existing". The "Replace" button reveals a new input.
- CI: `DISCORD_BOT_TOKEN` is NOT added as a CI secret — PR 3 does not use env vars. The E2E test uses a fake token fixture stored in Vault by the setup SQL (local Supabase only).

---

## Test DM stub — exact behavior in this PR

The spec says "Send test DM to me" is a stub this PR. Concrete definition:

- Button posts `FormData` to `sendTestDm` server action.
- Action:
  1. Loads config via `getDiscordConfig()`. If `config === null` or `!config.enabled` or no `botToken`, return `{ ok: false, reason: "not_configured" }`.
  2. Calls Discord REST `GET https://discord.com/api/v10/users/@me` with `Authorization: Bot ${config.botToken}`.
     - 200 → return `{ ok: true, botUsername: body.username }`.
     - 401 → return `{ ok: false, reason: "invalid_token" }`.
     - Other → return `{ ok: false, reason: "transient", status }`.
  3. Does NOT attempt a real DM. That's PR 4.
- Client renders the result inline next to the button. No toast, no navigation.

This validates the token without the blast radius of actually messaging an admin's Discord account.

---

## Risks & mitigations

| Risk                                                           | Mitigation                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS bypass via service-role client in app code                 | The only file that uses `createAdminClient()` for this table is `src/lib/discord/config.ts`. Integration test asserts that reading `discord_integration_config` with an anon client returns 0 rows.                             |
| Vault permission error in PGlite / test env                    | PGlite does NOT have Supabase Vault. RLS tests run against the real local Supabase instance (same pattern as `email-privacy-rls.test.ts`). Unit tests of `getDiscordConfig()` mock the RPC call — they do not hit Vault at all. |
| Token leakage via error messages                               | Server actions catch and re-throw only sanitized `Error` instances; never pass `error.message` from Discord API calls to the client (may contain token echoes in headers).                                                      |
| Race condition on concurrent token rotation                    | Use `UPDATE ... WHERE bot_token_vault_id = $existingId` so the second writer's update fails (0 rows affected) and its new vault secret can be cleaned up. Actions return an explicit "stale, please retry" error.               |
| Definer function leaks via `EXPLAIN ANALYZE` or log statements | Set `SET log_statement = 'none'` in the function body (safe default; local Supabase already has this). The function body has no `RAISE NOTICE` with token.                                                                      |
| Admin accidentally clears token by saving an empty form        | Empty bot-token field is interpreted as "no change" — never as "clear the token". Explicit "Remove bot token" destructive action is out of scope for PR 3 (not in spec).                                                        |
| `tablesFilter` drift                                           | Plan task explicitly adds the new table name; PR checklist includes `pnpm db:generate` producing zero diff after all migrations applied.                                                                                        |

---

## Task list

### Task 1: Add `admin.integrations.manage` permission to matrix

**Files:**

- Modify: `src/lib/permissions/matrix.ts` (add inside the "admin" category, after `admin.users.roles`)
- Test: `src/test/unit/permissions-matrix.test.ts` (extend)

- [ ] **Step 1: Write failing tests for the new permission**

Append to `src/test/unit/permissions-matrix.test.ts`:

```typescript
import { checkPermission } from "~/lib/permissions/helpers";
import { PERMISSIONS_BY_ID } from "~/lib/permissions/matrix";

describe("admin.integrations.manage permission", () => {
  it("is defined in the matrix", () => {
    expect(PERMISSIONS_BY_ID["admin.integrations.manage"]).toBeDefined();
  });

  it("grants only admin access", () => {
    expect(checkPermission("admin.integrations.manage", "admin")).toBe(true);
    expect(checkPermission("admin.integrations.manage", "technician")).toBe(
      false
    );
    expect(checkPermission("admin.integrations.manage", "member")).toBe(false);
    expect(checkPermission("admin.integrations.manage", "guest")).toBe(false);
    expect(
      checkPermission("admin.integrations.manage", "unauthenticated")
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/test/unit/permissions-matrix.test.ts`
Expected: FAIL — `PERMISSIONS_BY_ID["admin.integrations.manage"]` is undefined.

- [ ] **Step 3: Add the permission to the matrix**

In `src/lib/permissions/matrix.ts`, inside the `{ id: "admin", ... }` category's `permissions` array, after the `admin.users.roles` entry (around line 437), add:

```typescript
{
  id: "admin.integrations.manage",
  label: "Manage integrations",
  description:
    "View and configure third-party integrations (Discord bot, etc.)",
  access: {
    unauthenticated: false,
    guest: false,
    member: false,
    technician: false,
    admin: true,
  },
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/test/unit/permissions-matrix.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions/matrix.ts src/test/unit/permissions-matrix.test.ts
git commit -m "feat(permissions): add admin.integrations.manage permission (PP-mud)"
```

---

### Task 2: Add `discordIntegrationConfig` table to Drizzle schema

**Files:**

- Modify: `src/server/db/schema.ts` (append at bottom, before the final exports if any)
- Modify: `drizzle.config.ts` (extend `tablesFilter`)

- [ ] **Step 1: Add the table definition to `src/server/db/schema.ts`**

At the bottom of the file, append:

```typescript
/**
 * Discord Integration Config (singleton)
 *
 * Stores admin-managed configuration for the Discord bot integration.
 * Exactly one row (id = 'singleton'), enforced by a CHECK constraint in SQL.
 *
 * The bot token is NOT stored in this table — `botTokenVaultId` points to a
 * Supabase Vault secret. Use `getDiscordConfig()` server accessor to read
 * the decrypted token via the `get_discord_config()` SECURITY DEFINER RPC.
 *
 * RLS: admin role only (see 0028_discord_admin_config.sql).
 *
 * Spec: docs/superpowers/specs/2026-04-19-discord-integration-design.md (§ PR 3)
 */
export const discordIntegrationConfig = pgTable(
  "discord_integration_config",
  {
    id: text("id").primaryKey().default("singleton"),
    enabled: boolean("enabled").notNull().default(false),
    guildId: text("guild_id"),
    inviteLink: text("invite_link"),
    // UUID reference to vault.secrets.id — no FK (Drizzle cannot cross-schema)
    botTokenVaultId: uuid("bot_token_vault_id"),
    botHealthStatus: text("bot_health_status", {
      enum: ["unknown", "healthy", "degraded"],
    })
      .notNull()
      .default("unknown"),
    lastBotCheckAt: timestamp("last_bot_check_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // UUID reference to auth.users.id — no FK (Drizzle cannot cross-schema)
    updatedBy: uuid("updated_by"),
  },
  (_t) => ({
    singletonCheck: check(
      "discord_integration_config_singleton",
      sql`id = 'singleton'`
    ),
    healthStatusCheck: check(
      "discord_integration_config_health_check",
      sql`bot_health_status IN ('unknown', 'healthy', 'degraded')`
    ),
  })
);
```

- [ ] **Step 2: Extend `tablesFilter` in `drizzle.config.ts`**

In `drizzle.config.ts`, update the `tablesFilter` array to include the new table name:

```typescript
tablesFilter: [
  "user_profiles",
  "machines",
  "issues",
  "issue_comments",
  "issue_images",
  "issue_watchers",
  "notifications",
  "notification_preferences",
  "invited_users",
  "machine_watchers",
  "discord_integration_config",
],
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: 0 errors related to `discordIntegrationConfig`.

- [ ] **Step 4: Commit schema additions (without migration yet)**

```bash
git add src/server/db/schema.ts drizzle.config.ts
git commit -m "feat(db): add discordIntegrationConfig schema definition (PP-mud)"
```

---

### Task 3: Generate the Drizzle migration

**Files:**

- Create: `drizzle/0028_<name>.sql` (name auto-generated by drizzle-kit)
- Auto-create: `drizzle/meta/0028_snapshot.json`
- Auto-update: `drizzle/meta/_journal.json`

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected output: drizzle-kit creates `drizzle/0028_<random>.sql` containing a `CREATE TABLE discord_integration_config` statement and the two CHECK constraints. It also writes `drizzle/meta/0028_snapshot.json` and appends to `_journal.json`.

- [ ] **Step 2: Rename the migration file for clarity**

Rename the generated file (via `git mv`) to `drizzle/0028_discord_admin_config.sql`. If drizzle-kit's naming differs, update `_journal.json`'s `tag` field for entry index 28 to match, OR leave as-generated — drizzle-kit reads `_journal.json`, not the filename, so either works. Safer: leave the auto-generated name and do NOT rename.

Actual command to confirm the generated state (skip rename):

Run: `ls drizzle/0028*.sql && head -20 drizzle/0028*.sql`
Expected: one file exists; contents start with `CREATE TABLE ... discord_integration_config`.

- [ ] **Step 3: Verify snapshot produced and `_journal.json` updated**

Run: `ls drizzle/meta/0028_snapshot.json && grep -c '"idx": 28' drizzle/meta/_journal.json`
Expected: file exists; grep returns `1`.

- [ ] **Step 4: Commit the auto-generated migration**

```bash
git add drizzle/0028_*.sql drizzle/meta/0028_snapshot.json drizzle/meta/_journal.json
git commit -m "feat(db): generate 0028 discord_integration_config migration (PP-mud)"
```

---

### Task 4: Augment the migration with RLS, singleton seed, and SECURITY DEFINER function

**Files:**

- Modify: `drizzle/0028_*.sql` (append — everything after the auto-generated `CREATE TABLE`)

- [ ] **Step 1: Append the extra DDL to the migration file**

Open `drizzle/0028_*.sql` and append after the drizzle-generated statements:

```sql
--> statement-breakpoint

-- Seed the singleton row so the app always has something to read
INSERT INTO "discord_integration_config" (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING;

--> statement-breakpoint

-- Enable Row Level Security
ALTER TABLE "discord_integration_config" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

-- Admin-only SELECT
DROP POLICY IF EXISTS "Discord config viewable by admins" ON "discord_integration_config";
CREATE POLICY "Discord config viewable by admins"
ON "discord_integration_config" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

--> statement-breakpoint

-- Admin-only UPDATE (the singleton row is pre-seeded, so INSERT is never needed from app code)
DROP POLICY IF EXISTS "Discord config updatable by admins" ON "discord_integration_config";
CREATE POLICY "Discord config updatable by admins"
ON "discord_integration_config" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

--> statement-breakpoint

-- SECURITY DEFINER RPC that returns the config row joined with the decrypted bot token.
-- Callable only by service_role; app code reaches it via createAdminClient().
-- Returns NULL for bot_token if no vault secret is linked yet.
CREATE OR REPLACE FUNCTION public.get_discord_config()
RETURNS TABLE (
  enabled boolean,
  guild_id text,
  invite_link text,
  bot_token text,
  bot_health_status text,
  last_bot_check_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.enabled,
    c.guild_id,
    c.invite_link,
    v.decrypted_secret::text AS bot_token,
    c.bot_health_status,
    c.last_bot_check_at,
    c.updated_at
  FROM discord_integration_config c
  LEFT JOIN vault.decrypted_secrets v ON v.id = c.bot_token_vault_id
  WHERE c.id = 'singleton';
END;
$$;

REVOKE ALL ON FUNCTION public.get_discord_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_discord_config() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role;

COMMENT ON FUNCTION public.get_discord_config() IS
  'Returns Discord integration config with decrypted bot token from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm db:migrate`
Expected: migration `0028_*` applies cleanly; final output includes "Applied migrations".

- [ ] **Step 3: Verify the singleton row exists and RLS is on**

Run:

```bash
psql "$POSTGRES_URL_NON_POOLING" -c "SELECT id, enabled FROM discord_integration_config;"
psql "$POSTGRES_URL_NON_POOLING" -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'discord_integration_config';"
psql "$POSTGRES_URL_NON_POOLING" -c "SELECT proname FROM pg_proc WHERE proname = 'get_discord_config';"
```

Expected:

- Row: `singleton | f`
- `relrowsecurity`: `t`
- `proname`: `get_discord_config`

- [ ] **Step 4: Verify the RPC returns a row as service_role**

Run:

```bash
psql "$POSTGRES_URL_NON_POOLING" -c "SET ROLE service_role; SELECT * FROM public.get_discord_config();"
```

Expected: one row with `enabled = false` and all other columns NULL (or `unknown` for `bot_health_status`).

- [ ] **Step 5: Verify authenticated role is denied**

Run:

```bash
psql "$POSTGRES_URL_NON_POOLING" -c "SET ROLE authenticated; SELECT * FROM public.get_discord_config();"
```

Expected: `ERROR: permission denied for function get_discord_config`.

- [ ] **Step 6: Commit the augmented migration**

```bash
git add drizzle/0028_*.sql
git commit -m "feat(db): add RLS + get_discord_config() RPC for discord_integration_config (PP-mud)"
```

---

### Task 5: Write the `getDiscordConfig()` server accessor

**Files:**

- Create: `src/lib/discord/config.ts`
- Create: `src/test/unit/lib/discord/config.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `src/test/unit/lib/discord/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createAdminClient so we don't hit a real Supabase instance
const rpcMock = vi.fn();
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

import { getDiscordConfig } from "~/lib/discord/config";

describe("getDiscordConfig", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns null when RPC yields no rows", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns null when enabled is false", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: false,
          guild_id: null,
          invite_link: null,
          bot_token: null,
          bot_health_status: "unknown",
          last_bot_check_at: null,
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns null when enabled but bot_token is missing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: true,
          guild_id: "123",
          invite_link: null,
          bot_token: null,
          bot_health_status: "unknown",
          last_bot_check_at: null,
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns a typed DiscordConfig when enabled and token set", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: true,
          guild_id: "123",
          invite_link: "https://discord.gg/abc",
          bot_token: "secret-token",
          bot_health_status: "healthy",
          last_bot_check_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    const config = await getDiscordConfig();
    expect(config).not.toBeNull();
    expect(config?.enabled).toBe(true);
    expect(config?.guildId).toBe("123");
    expect(config?.botToken).toBe("secret-token");
  });

  it("throws when the RPC returns an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc failed" },
    });
    await expect(getDiscordConfig()).rejects.toThrow(/rpc failed/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/test/unit/lib/discord/config.test.ts`
Expected: FAIL — `~/lib/discord/config` does not exist.

- [ ] **Step 3: Create the accessor**

Create `src/lib/discord/config.ts`:

```typescript
import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Discord integration configuration, as loaded by `getDiscordConfig()`.
 *
 * Returned only when the integration is enabled AND a bot token is set.
 * Otherwise callers receive `null` and should treat the integration as
 * unavailable (skip channel registration, disable admin UI sections, etc.).
 */
export interface DiscordConfig {
  enabled: true;
  guildId: string | null;
  inviteLink: string | null;
  botToken: string;
  botHealthStatus: "unknown" | "healthy" | "degraded";
  lastBotCheckAt: Date | null;
  updatedAt: Date;
}

/**
 * Fetches Discord integration config, including the decrypted bot token
 * from Supabase Vault.
 *
 * Returns null when:
 * - No config row exists (shouldn't happen — migration seeds one)
 * - `enabled` is false
 * - Bot token is not yet set
 *
 * SECURITY: This accessor MUST be called only from server code. It uses
 * the service-role Supabase client and exposes secret material. The
 * "server-only" import above guards against accidental client imports.
 */
export async function getDiscordConfig(): Promise<DiscordConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_discord_config");

  if (error) {
    throw new Error(`Failed to load Discord config: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    enabled: boolean;
    guild_id: string | null;
    invite_link: string | null;
    bot_token: string | null;
    bot_health_status: "unknown" | "healthy" | "degraded";
    last_bot_check_at: string | null;
    updated_at: string;
  }>;

  const row = rows[0];
  if (!row || !row.enabled || !row.bot_token) {
    return null;
  }

  return {
    enabled: true,
    guildId: row.guild_id,
    inviteLink: row.invite_link,
    botToken: row.bot_token,
    botHealthStatus: row.bot_health_status,
    lastBotCheckAt: row.last_bot_check_at
      ? new Date(row.last_bot_check_at)
      : null,
    updatedAt: new Date(row.updated_at),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/test/unit/lib/discord/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/discord/config.ts src/test/unit/lib/discord/config.test.ts
git commit -m "feat(discord): add getDiscordConfig server accessor (PP-mud)"
```

---

### Task 6: Write integration test for RLS + RPC behavior

**Files:**

- Create: `src/test/integration/supabase/discord-config-rls.test.ts`

- [ ] **Step 1: Write the RLS integration test**

Create `src/test/integration/supabase/discord-config-rls.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for Discord RLS tests.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

describe("Discord integration config RLS", () => {
  let adminUser: { id: string; email: string };
  let memberUser: { id: string; email: string };
  let adminAuthedClient: SupabaseClient;
  let memberAuthedClient: SupabaseClient;

  beforeAll(async () => {
    const adminEmail = `discord-rls-admin-${Date.now()}@test.com`;
    const { data: adminData } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: { first_name: "Admin", last_name: "Test", role: "admin" },
    });
    if (!adminData.user) throw new Error("admin user not created");
    adminUser = { id: adminData.user.id, email: adminEmail };
    await adminClient
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", adminUser.id);

    const memberEmail = `discord-rls-member-${Date.now()}@test.com`;
    const { data: memberData } = await adminClient.auth.admin.createUser({
      email: memberEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: {
        first_name: "Member",
        last_name: "Test",
        role: "member",
      },
    });
    if (!memberData.user) throw new Error("member user not created");
    memberUser = { id: memberData.user.id, email: memberEmail };

    adminAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await adminAuthedClient.auth.signInWithPassword({
      email: adminEmail,
      password: "TestPassword123",
    });

    memberAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await memberAuthedClient.auth.signInWithPassword({
      email: memberEmail,
      password: "TestPassword123",
    });
  });

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(adminUser.id);
    await adminClient.auth.admin.deleteUser(memberUser.id);
  });

  it("anonymous client cannot read the config", async () => {
    const { data } = await anonClient
      .from("discord_integration_config")
      .select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("member client cannot read the config", async () => {
    const { data } = await memberAuthedClient
      .from("discord_integration_config")
      .select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("admin client can read the config (sees singleton row)", async () => {
    const { data, error } = await adminAuthedClient
      .from("discord_integration_config")
      .select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe("singleton");
  });

  it("member client cannot UPDATE the config", async () => {
    const { error } = await memberAuthedClient
      .from("discord_integration_config")
      .update({ enabled: true })
      .eq("id", "singleton");
    // RLS returns no error but affects 0 rows; re-read to prove no mutation
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("discord_integration_config")
      .select("enabled")
      .eq("id", "singleton")
      .single();
    expect(data?.enabled).toBe(false);
  });

  it("admin client can UPDATE the config", async () => {
    const { error } = await adminAuthedClient
      .from("discord_integration_config")
      .update({ guild_id: "test-guild-123" })
      .eq("id", "singleton");
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("discord_integration_config")
      .select("guild_id")
      .eq("id", "singleton")
      .single();
    expect(data?.guild_id).toBe("test-guild-123");
    // cleanup
    await adminClient
      .from("discord_integration_config")
      .update({ guild_id: null })
      .eq("id", "singleton");
  });

  it("authenticated role cannot EXECUTE get_discord_config()", async () => {
    const { error } = await memberAuthedClient.rpc("get_discord_config");
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission|not.*found/i);
  });

  it("service role can EXECUTE get_discord_config() and gets a row", async () => {
    const { data, error } = await adminClient.rpc("get_discord_config");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the RLS integration test**

Run: `pnpm vitest run src/test/integration/supabase/discord-config-rls.test.ts`
Expected: PASS (7 tests). Requires local Supabase running (`pnpm dev:status`).

- [ ] **Step 3: Commit**

```bash
git add src/test/integration/supabase/discord-config-rls.test.ts
git commit -m "test(discord): RLS + RPC integration tests for discord_integration_config (PP-mud)"
```

---

### Task 7: Create Zod schemas for server actions

**Files:**

- Create: `src/app/(app)/admin/integrations/discord/schema.ts`

- [ ] **Step 1: Write the schema file**

Create `src/app/(app)/admin/integrations/discord/schema.ts`:

```typescript
import { z } from "zod";

/**
 * Update config fields — everything except the bot token itself.
 *
 * `guildId` and `inviteLink` may be empty strings (cleared). We coerce
 * empty strings to null on the server side before writing.
 */
export const updateDiscordConfigSchema = z.object({
  enabled: z.boolean(),
  guildId: z
    .string()
    .trim()
    .max(64)
    .regex(/^\d*$/, "Guild ID must be numeric")
    .optional()
    .default(""),
  inviteLink: z
    .string()
    .trim()
    .max(512)
    .refine(
      (v) =>
        v === "" ||
        /^https:\/\/discord\.gg\/.+/.test(v) ||
        /^https:\/\/discord\.com\/invite\/.+/.test(v),
      "Must be a Discord invite URL or empty"
    )
    .optional()
    .default(""),
});

export type UpdateDiscordConfigInput = z.infer<
  typeof updateDiscordConfigSchema
>;

/**
 * Rotate the bot token. Separate action because it touches Vault.
 */
export const rotateBotTokenSchema = z.object({
  // Discord bot tokens are 59-72 chars, alnum + dots/underscores/hyphens.
  // We accept a broad range because Discord has quietly changed the format
  // before. Empty string is rejected — use a different flow to clear.
  newToken: z
    .string()
    .trim()
    .min(50, "Token looks too short")
    .max(128, "Token looks too long")
    .regex(/^[A-Za-z0-9._-]+$/, "Token contains invalid characters"),
});

export type RotateBotTokenInput = z.infer<typeof rotateBotTokenSchema>;
```

- [ ] **Step 2: Run TS check**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/integrations/discord/schema.ts
git commit -m "feat(discord): add Zod schemas for admin config actions (PP-mud)"
```

---

### Task 8: Implement server actions

**Files:**

- Create: `src/app/(app)/admin/integrations/discord/actions.ts`

- [ ] **Step 1: Write the actions file**

Create `src/app/(app)/admin/integrations/discord/actions.ts`:

```typescript
"use server";

import { createClient } from "~/lib/supabase/server";
import { createAdminClient } from "~/lib/supabase/admin";
import { db } from "~/server/db";
import { discordIntegrationConfig, userProfiles } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { updateDiscordConfigSchema, rotateBotTokenSchema } from "./schema";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getDiscordConfig } from "~/lib/discord/config";

async function verifyIntegrationsAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    throw new Error(
      "Forbidden: You do not have permission to manage integrations"
    );
  }
  return { userId: user.id };
}

export async function updateDiscordConfig(formData: FormData): Promise<void> {
  const { userId } = await verifyIntegrationsAdmin();

  try {
    const raw = {
      enabled: formData.get("enabled") === "true",
      guildId: (formData.get("guildId") ?? "") as string,
      inviteLink: (formData.get("inviteLink") ?? "") as string,
    };
    const validated = updateDiscordConfigSchema.parse(raw);

    await db
      .update(discordIntegrationConfig)
      .set({
        enabled: validated.enabled,
        guildId: validated.guildId === "" ? null : validated.guildId,
        inviteLink: validated.inviteLink === "" ? null : validated.inviteLink,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(discordIntegrationConfig.id, "singleton"));

    revalidatePath("/admin/integrations/discord");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden"))
    ) {
      throw error;
    }
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }
    log.error(
      {
        action: "updateDiscordConfig",
        userId,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to update Discord config"
    );
    throw new Error("Failed to update Discord config", { cause: error });
  }
}

export async function rotateBotToken(formData: FormData): Promise<void> {
  const { userId } = await verifyIntegrationsAdmin();

  // DO NOT log the token value. Log only whether it was present.
  const rawToken = (formData.get("newToken") ?? "") as string;
  try {
    const { newToken } = rotateBotTokenSchema.parse({ newToken: rawToken });

    const supabase = createAdminClient();

    const existing = await db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: { botTokenVaultId: true },
    });

    if (existing?.botTokenVaultId) {
      // Rotate in place (preserves vault.secrets row, audit history)
      const { error } = await supabase.rpc("vault" as never, {
        // Fallback: direct SQL through admin client
      });
      // Using direct SQL via drizzle raw — vault is a separate schema,
      // so we call vault.update_secret() through db.execute().
      await db.execute(
        sql`SELECT vault.update_secret(${existing.botTokenVaultId}::uuid, ${newToken}, 'discord_bot_token', 'Discord bot token (rotated)')`
      );
    } else {
      // First-time set: create a new vault secret and link it
      const rows = (await db.execute(
        sql`SELECT vault.create_secret(${newToken}, 'discord_bot_token', 'Discord bot token') AS id`
      )) as unknown as Array<{ id: string }>;
      const newVaultId = rows[0]?.id;
      if (!newVaultId) {
        throw new Error("Vault create_secret returned no id");
      }
      await db
        .update(discordIntegrationConfig)
        .set({
          botTokenVaultId: newVaultId,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(discordIntegrationConfig.id, "singleton"));
    }

    revalidatePath("/admin/integrations/discord");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden"))
    ) {
      throw error;
    }
    if (error instanceof Error && error.constructor.name === "ZodError") {
      throw error;
    }
    log.error(
      {
        action: "rotateBotToken",
        userId,
        // Only log that the token was present; never the value
        hasToken: rawToken.length > 0,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to rotate Discord bot token"
    );
    throw new Error("Failed to rotate Discord bot token", { cause: error });
  }
}

export type SendTestDmResult =
  | { ok: true; botUsername: string }
  | {
      ok: false;
      reason: "not_configured" | "invalid_token" | "transient";
      status?: number;
    };

export async function sendTestDm(): Promise<SendTestDmResult> {
  await verifyIntegrationsAdmin();

  const config = await getDiscordConfig();
  if (!config) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${config.botToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { username: string };
      return { ok: true, botUsername: body.username };
    }
    if (res.status === 401) {
      return { ok: false, reason: "invalid_token" };
    }
    return { ok: false, reason: "transient", status: res.status };
  } catch (error) {
    log.error(
      {
        action: "sendTestDm",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Discord test DM verification failed"
    );
    return { ok: false, reason: "transient" };
  }
}
```

- [ ] **Step 2: Run TS and lint checks**

Run: `pnpm tsc --noEmit && pnpm lint src/app/\(app\)/admin/integrations/discord`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/integrations/discord/actions.ts
git commit -m "feat(discord): admin config + token rotate + test DM server actions (PP-mud)"
```

---

### Task 9: Build the admin page (Server Component)

**Files:**

- Create: `src/app/(app)/admin/integrations/layout.tsx`
- Create: `src/app/(app)/admin/integrations/discord/page.tsx`

- [ ] **Step 1: Create the shell layout**

Create `src/app/(app)/admin/integrations/layout.tsx`:

```typescript
import type React from "react";

/**
 * Placeholder layout for the admin integrations section.
 *
 * Admin auth is enforced by the parent `/admin` layout. This layout exists
 * so future sibling integration pages (e.g. /admin/integrations/slack) have
 * a shared wrapper to grow into.
 */
export default function AdminIntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create the Discord page**

Create `src/app/(app)/admin/integrations/discord/page.tsx`:

```typescript
import type React from "react";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DiscordConfigForm } from "./discord-config-form";
import { TestDmButton } from "./test-dm-button";
import { formatDate } from "~/lib/dates";

export default async function AdminDiscordIntegrationPage(): Promise<React.JSX.Element> {
  const config = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });

  const hasToken = !!config?.botTokenVaultId;
  const healthStatus = config?.botHealthStatus ?? "unknown";

  return (
    <PageContainer size="standard">
      <PageHeader title="Discord Integration" />

      <div className="flex flex-col gap-6">
        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Feature:</span>
              {config?.enabled ? (
                <Badge className="bg-success/15 text-success border-success/40">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Bot health:</span>
              <Badge variant="outline">{healthStatus}</Badge>
              {config?.lastBotCheckAt && (
                <span className="text-xs text-muted-foreground">
                  last checked {formatDate(config.lastBotCheckAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Bot token:</span>
              {hasToken ? (
                <Badge className="bg-success/15 text-success border-success/40">Set</Badge>
              ) : (
                <Badge variant="outline" className="border-warning/40 text-warning">
                  Missing
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscordConfigForm
              enabled={config?.enabled ?? false}
              guildId={config?.guildId ?? ""}
              inviteLink={config?.inviteLink ?? ""}
              hasToken={hasToken}
            />
          </CardContent>
        </Card>

        {/* Test */}
        <Card>
          <CardHeader>
            <CardTitle>Test connection</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Verifies that the bot token is valid by calling Discord&apos;s
              <code className="mx-1">/users/@me</code> endpoint. Does not send
              an actual DM yet — real DM delivery ships in the next PR.
            </p>
            <TestDmButton disabled={!config?.enabled || !hasToken} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 3: Verify TS compiles (components referenced don't exist yet — accept errors for the two missing imports, proceed to Task 10 before running tests)**

Run: `pnpm tsc --noEmit` — expect errors ONLY for `./discord-config-form` and `./test-dm-button`. These are created in the next two tasks.

- [ ] **Step 4: Commit the page and layout**

```bash
git add src/app/\(app\)/admin/integrations/layout.tsx src/app/\(app\)/admin/integrations/discord/page.tsx
git commit -m "feat(discord): admin integration page scaffold (PP-mud)"
```

---

### Task 10: Build the configuration form (Client Component)

**Files:**

- Create: `src/app/(app)/admin/integrations/discord/bot-token-field.tsx`
- Create: `src/app/(app)/admin/integrations/discord/discord-config-form.tsx`

- [ ] **Step 1: Create the bot-token-field**

Create `src/app/(app)/admin/integrations/discord/bot-token-field.tsx`:

```typescript
"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { rotateBotToken } from "./actions";

export function BotTokenField({
  hasToken,
}: {
  hasToken: boolean;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = React.useState(!hasToken);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="newToken">Bot token</Label>
      {isEditing ? (
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            setSuccess(false);
            try {
              await rotateBotToken(formData);
              setSuccess(true);
              setIsEditing(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to save token");
            } finally {
              setPending(false);
            }
          }}
          className="flex flex-col gap-2"
        >
          <Input
            id="newToken"
            name="newToken"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="MTxxxxxxxxxx..."
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {hasToken ? "Replace token" : "Save token"}
            </Button>
            {hasToken && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-success">Token saved.</p>}
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value="••••••••••••"
            readOnly
            aria-label="Bot token set"
            className="max-w-[200px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Replace
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the config form**

Create `src/app/(app)/admin/integrations/discord/discord-config-form.tsx`:

```typescript
"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { updateDiscordConfig } from "./actions";
import { BotTokenField } from "./bot-token-field";

export function DiscordConfigForm({
  enabled,
  guildId,
  inviteLink,
  hasToken,
}: {
  enabled: boolean;
  guildId: string;
  inviteLink: string;
  hasToken: boolean;
}): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localEnabled, setLocalEnabled] = React.useState(enabled);

  return (
    <div className="flex flex-col gap-6">
      <BotTokenField hasToken={hasToken} />

      <form
        action={async (formData) => {
          formData.set("enabled", localEnabled ? "true" : "false");
          setPending(true);
          setError(null);
          try {
            await updateDiscordConfig(formData);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save config");
          } finally {
            setPending(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <Switch
            id="enabled"
            checked={localEnabled}
            onCheckedChange={setLocalEnabled}
            disabled={!hasToken}
          />
          <Label htmlFor="enabled">Integration enabled</Label>
        </div>
        {!hasToken && (
          <p className="text-xs text-muted-foreground">
            Set a bot token above before enabling.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="guildId">Guild ID (APC Discord server)</Label>
          <Input
            id="guildId"
            name="guildId"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            defaultValue={guildId}
            placeholder="123456789012345678"
            maxLength={64}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="inviteLink">Invite link</Label>
          <Input
            id="inviteLink"
            name="inviteLink"
            type="url"
            defaultValue={inviteLink}
            placeholder="https://discord.gg/..."
            maxLength={512}
          />
          <p className="text-xs text-muted-foreground">
            Shown to users when DMs fail because they aren&apos;t in the server.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving..." : "Save changes"}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Run TS check**

Run: `pnpm tsc --noEmit`
Expected: 0 errors related to these files (the `page.tsx` imports now resolve).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/admin/integrations/discord/bot-token-field.tsx src/app/\(app\)/admin/integrations/discord/discord-config-form.tsx
git commit -m "feat(discord): admin config form + bot token field (PP-mud)"
```

---

### Task 11: Build the test-DM button (Client Component)

**Files:**

- Create: `src/app/(app)/admin/integrations/discord/test-dm-button.tsx`

- [ ] **Step 1: Create the test DM button**

Create `src/app/(app)/admin/integrations/discord/test-dm-button.tsx`:

```typescript
"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { sendTestDm, type SendTestDmResult } from "./actions";

export function TestDmButton({
  disabled,
}: {
  disabled: boolean;
}): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<SendTestDmResult | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          setResult(null);
          try {
            const r = await sendTestDm();
            setResult(r);
          } catch (e) {
            setResult({ ok: false, reason: "transient" });
          } finally {
            setPending(false);
          }
        }}
        className="self-start"
        data-testid="discord-test-dm-button"
      >
        {pending ? "Testing..." : "Verify bot token"}
      </Button>

      {result?.ok && (
        <p className="text-sm text-success">
          Token valid — bot logged in as{" "}
          <code className="font-mono">{result.botUsername}</code>.
        </p>
      )}
      {result && !result.ok && result.reason === "not_configured" && (
        <p className="text-sm text-muted-foreground">
          Enable the integration and set a bot token first.
        </p>
      )}
      {result && !result.ok && result.reason === "invalid_token" && (
        <p className="text-sm text-destructive">
          Invalid token. Rotate it above and try again.
        </p>
      )}
      {result && !result.ok && result.reason === "transient" && (
        <p className="text-sm text-warning">
          Temporary failure
          {result.status ? ` (HTTP ${result.status})` : ""}. Try again in a moment.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full preflight check**

Run: `pnpm run check`
Expected: PASS (types, lint, format, unit tests, audit).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/admin/integrations/discord/test-dm-button.tsx
git commit -m "feat(discord): admin test-DM verification button (PP-mud)"
```

---

### Task 12: Add "Integrations" link to admin user menu

**Files:**

- Modify: `src/components/layout/user-menu-client.tsx:88-104`

- [ ] **Step 1: Add the new dropdown item**

In `src/components/layout/user-menu-client.tsx`, find the existing admin-only block (around lines 88-103) that renders the "Admin Panel" item linking to `/admin/users`. Immediately below it (before the closing `</>` of the `role === "admin"` fragment), add:

```typescript
<DropdownMenuItem asChild>
  <a
    href="/admin/integrations/discord"
    className="flex items-center cursor-pointer"
    data-testid="user-menu-admin-integrations"
  >
    <Shield className="mr-2 size-4" />
    <span>Integrations</span>
  </a>
</DropdownMenuItem>
```

(Reuses the `Shield` icon already imported at the top of the file.)

- [ ] **Step 2: Run check**

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/user-menu-client.tsx
git commit -m "feat(nav): add admin integrations link to user menu (PP-mud)"
```

---

### Task 13: E2E smoke test

**Files:**

- Create: `e2e/smoke/admin-discord-integration.spec.ts`

- [ ] **Step 1: Write the smoke spec**

Create `e2e/smoke/admin-discord-integration.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { adminAuthFile } from "../fixtures/auth-files";

test.use({ storageState: adminAuthFile });

test.describe("Admin Discord integration page", () => {
  test("loads and renders the three sections", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Configuration" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Test connection" })
    ).toBeVisible();
  });

  test("test-DM button is disabled when integration is off", async ({
    page,
  }) => {
    await page.goto("/admin/integrations/discord");
    const btn = page.getByTestId("discord-test-dm-button");
    await expect(btn).toBeDisabled();
  });

  test("navigates here from the user menu", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-admin-integrations").click();
    await expect(page).toHaveURL(/\/admin\/integrations\/discord$/);
  });

  test("non-admin is forbidden", async ({ browser }) => {
    const ctx = await browser.newContext(); // no auth
    const page = await ctx.newPage();
    await page.goto("/admin/integrations/discord");
    // Unauthenticated hits login redirect; member would hit Forbidden — either
    // way we're NOT seeing the Discord page heading.
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toHaveCount(0);
    await ctx.close();
  });
});
```

- [ ] **Step 2: Verify `adminAuthFile` fixture path**

Run: `ls e2e/fixtures/auth-files.ts 2>/dev/null || grep -r "adminAuthFile" e2e/fixtures/ e2e/auth.setup.ts`
If the export name or location differs, update the import line accordingly. Do NOT create a new fixture — reuse existing admin storage state.

- [ ] **Step 3: Run the smoke spec**

Run: `pnpm exec playwright test e2e/smoke/admin-discord-integration.spec.ts --project=chromium`
Expected: 4 passing tests. If the non-admin test fails because middleware redirects unauthenticated users, adjust the final assertion to check for the login page URL instead.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/admin-discord-integration.spec.ts
git commit -m "test(discord): E2E smoke for admin integration page (PP-mud)"
```

---

### Task 14: Run preflight and close out

**Files:** none (verification task)

- [ ] **Step 1: Preflight**

Run: `pnpm run preflight`
Expected: PASS — types, lint, format, unit tests, YAML/action/ruff/shellcheck, build, integration tests all green.

- [ ] **Step 2: Re-verify RLS from a fresh local Supabase reset**

Run: `pnpm db:reset && pnpm vitest run src/test/integration/supabase/discord-config-rls.test.ts`
Expected: migration applies from scratch; RLS test suite passes against a fresh DB. This guards against migration order bugs that only appear when seeds run after 0028.

- [ ] **Step 3: Mark bead complete and push**

Run: `bd update PP-mud --status closed --message "Admin Discord config subpage landed per spec (PR 3)."`

Push:

```bash
git pull --rebase
git push -u origin plan/pr-3-discord-admin-config
git status
```

Expected: "up to date with origin/plan/pr-3-discord-admin-config".

- [ ] **Step 4: Open PR** (optional for plan file; do this when executing the plan, not when landing this plan document)

When the actual implementation branch lands:

```bash
gh pr create --title "feat(discord): admin integration config subpage (PP-mud)" --base main
```

---

## Self-review checklist (for the plan author)

- [x] Every spec PR-3 requirement maps to a task (see coverage table below).
- [x] No "TODO", no "handle edge cases" without showing how.
- [x] Type `DiscordConfig` shape matches between accessor (Task 5), server action consumer (Task 8), and page (Task 9).
- [x] RLS policy syntax mirrors `drizzle/0008_email_privacy_rls.sql`.
- [x] `admin.integrations.manage` is used in every server action.
- [x] All file paths are absolute within the repo.
- [x] `tablesFilter` update is called out.

### Spec coverage map

| Spec requirement                                                                  | Covered by task                                                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| New `discord_integration_config` table with listed columns                        | Task 2, Task 3, Task 4                                                                       |
| Supabase Vault for bot token (not plaintext column)                               | Task 4 (create/update via `vault.*`), Task 8 (rotate action)                                 |
| RLS: admin SELECT/UPDATE only; no anon/authenticated reads                        | Task 4 (policies), Task 6 (test)                                                             |
| `SECURITY DEFINER` function, service-role only                                    | Task 4 (`get_discord_config()` + GRANT), Task 6 (test)                                       |
| Admin subpage at `/admin/integrations/discord` with Status / Configuration / Test | Task 9                                                                                       |
| Toggle enable/disable                                                             | Task 10 (`DiscordConfigForm`, `Switch`)                                                      |
| Guild ID input                                                                    | Task 10                                                                                      |
| Bot token write-only with `●●●●` placeholder                                      | Task 10 (`BotTokenField`)                                                                    |
| Save action                                                                       | Task 8 (`updateDiscordConfig`), Task 10 (form wire-up)                                       |
| "Send test DM to me" button stub                                                  | Task 8 (`sendTestDm` action), Task 11 (button)                                               |
| `getDiscordConfig()` server accessor                                              | Task 5                                                                                       |
| No OAuth config here (decision #21)                                               | Plan states this explicitly; no env-var or OAuth touch                                       |
| New permission vs existing admin pattern                                          | Task 1 (`admin.integrations.manage`)                                                         |
| PGlite integration tests                                                          | Task 6 (RLS + RPC) — runs against local Supabase, not PGlite, because Vault is Supabase-only |
| E2E smoke for admin page                                                          | Task 13                                                                                      |
| Test DM stub = validates token, no real DM                                        | Task 8 spec + Task 11                                                                        |
| Secrets hygiene (no token in logs)                                                | Task 8 logs `hasToken: rawToken.length > 0`; accessor marks `botToken` clearly               |
| Risks documented                                                                  | See "Risks & mitigations" section above                                                      |

### Known ambiguities a reviewer should double-check

1. **`vault.*` function calls from Drizzle `db.execute(sql\`...\`)`.** We use direct SQL through the pooled connection. Confirm the runtime DB role (the role that owns the pooled Supabase connection) has EXECUTE privilege on `vault.create_secret` / `vault.update_secret`. On hosted Supabase, only `postgres` can by default. If the app role can't, we need to wrap the vault calls in another SECURITY DEFINER function and call that via the service-role client. This is a 30-minute swap if it bites — note on the PR.
2. **Drizzle `meta/_journal.json` migration index.** Plan assumes the next index is 28. If another migration lands in main before PR 3, rebase + regenerate is required (see AGENTS.md § Migration Conflict Resolution).
3. **shadcn/ui component availability.** Confirmed present in `src/components/ui/`: `switch.tsx`, `label.tsx`, `card.tsx`, `button.tsx`, `input.tsx`, `badge.tsx`. No additional installs needed.
4. **Anon/member RLS denial on UPDATE.** PostgREST returns HTTP 200 with no error when an UPDATE affects 0 rows under RLS — the Task 6 test asserts via re-read rather than expecting an error. If RLS is tightened later to throw explicitly, adjust that test.
