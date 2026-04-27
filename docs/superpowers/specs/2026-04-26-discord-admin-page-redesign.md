# Discord admin page redesign

**Date**: 2026-04-26
**Owner**: Tim Froehlich
**Beads**: PP-2n5 (closes parts of PP-cos), unblocks PP-eps
**Status**: Spec — pending review

## Goal

Redesign `/admin/integrations/discord` so the page reflects what the integration actually is: a single configurable feature (the DM bot) with one source of truth (the database). Eliminate the visual and conceptual debt accumulated while supporting the env-var dev convenience. Fold in the relevant scope from PP-cos so we don't redesign this page twice.

## Background

PR4 (Discord DM channel — PP-2n5) added an env-override path in `src/lib/discord/config.ts` so new worktrees could inherit Discord credentials from `.env.local` without an admin re-paste. The runtime now reads env first; if env is set, the DB row is ignored entirely. The admin page reads from the DB and lets admins edit the DB. That mismatch — runtime says env wins, GUI says DB matters — is the source of the page's awkwardness: env-override banners, per-field "from env" badges, five-state activation copy, all paying tax on a parallel-state UI.

PP-cos (admin enable/disable toggles for Discord login + bot) was originally scoped as adding two toggles. On reflection, Discord login is managed entirely by Supabase Auth: the `Connect Discord` button on the Connected Accounts row already gates on `DISCORD_CLIENT_ID` env presence (which is itself Supabase's own enable signal), and the Supabase Auth dashboard is the right place to disable the provider during an OAuth incident. PinPoint owns the bot toggle only; the existing `enabled` column on `discord_integration_config` already serves that purpose.

## Decisions

### D1. Pattern: DB wins; env is a seed-time input only

The runtime reads `discord_integration_config` from the database, period. There is no env-override path at runtime. Env vars are consumed by the seed/setup pipeline only — when a fresh worktree is initialized, the seed step copies env values into the DB row (creating a Vault secret for the bot token). After the row exists, env values are ignored.

**Why**: The use case the env-override was solving — "let new worktrees pick up credentials without manual paste" — is a bootstrap problem, not a runtime override problem. Treating env as a seed input gives us the convenience without the dual-source UI ambiguity.

### D2. Page scope: bot configuration only

The page covers only the bot configuration. Discord login is not represented on this page. If admins land here looking for the login switch, they'll find a brief help link pointing to the Supabase Auth dashboard.

**Why**: Login is fully Supabase-managed. The `Connect Discord` button gates on `DISCORD_CLIENT_ID` env presence (Supabase's own enable signal). There is no PinPoint-side admin control to surface.

### D3. Page archetype: Settings (single column, max-w-3xl, no Card chrome around the form)

The page uses the Settings archetype: `PageContainer size="narrow"`, single column, sections separated by `Separator`, py-6 padding. No status banner. No grid layout. No cards-in-a-grid.

**Why**: It's a one-time setup form an admin visits ~once. Settings rhythm matches `/settings/notifications` (the user-facing sibling) and reads as a vertical narrative top-to-bottom.

### D4. Form structure: one form, three field groups, Save at the bottom

The form has three field groups separated by `Separator`:

1. **Bot token** — token input + inline Validate button + validation status
2. **Discord server** — Server ID (required) + Invite link (optional), each with inline Validate where applicable
3. **Activation** — single switch with `Enabled` / `Disabled` label

The form has a single bottom footer with **Save changes** (primary) and **Reset** (secondary outline) buttons.

**Why**: One commit (Save) keeps semantics simple. Field groups reflect conceptual scopes (identity, location, on/off). Bottom Save matches PinPoint's existing form rhythm.

### D5. Bot token UX: empty input means "no change"

The bot token field is always a password input. Empty means "no change to saved token." Filled means "rotate to this value on Save."

A `Saved` badge appears next to the label when the DB has a token. The placeholder text reinforces this ("Paste new token to replace" if saved, "Paste a token..." if not).

There is no separate Replace button. There is no edit-mode toggle. Save is the only commit.

**Why**: This is the standard rotation pattern across Stripe, GitHub, Cloudflare, etc. Avoids pre-filled masked dots that look editable but aren't, and removes the dual-Save problem (one inside the field, one at the bottom).

### D6. Validation: inline Validate buttons + Save re-validates

Both the bot token and Server ID fields have inline `Validate` buttons next to the input. Each runs a server action that probes Discord without writing anything:

- **Validate token** → `GET https://discord.com/api/v10/users/@me` with `Authorization: Bot {token}`. Uses the typed value if present, else the saved Vault token.
- **Validate Server ID** → `GET /guilds/{server_id}/members/@me` with the bot token. Uses typed token if present, else saved Vault token.

The Save button re-runs both validations server-side regardless of inline state. **Both must pass for Save to commit.** If either fails, no DB writes; the form renders inline error messages on the offending field(s).

**Why**: Inline Validate gives admins fast iterate-and-test feedback without committing or triggering a Vault write. Server-side re-validation at Save guarantees nothing bad lands at commit time even if the admin skips Validate or modifies values after validating.

### D7. Server ID validation is hard-required at Save

If Server ID validation fails (e.g., bot is not a member of that server), Save is rejected. The form renders the failure message; the admin must invite the bot, paste the correct ID, or otherwise fix the situation before saving.

**Why**: Saving an unverifiable server ID stores a config that won't work. Better to surface the gap before commit. Workflow: invite the bot first (using the Discord Developer Portal's OAuth2 URL Generator), then save the ID.

### D8. Validation status states

Each validatable field tracks one of five visual states:

| State       | Trigger                                         | Visual                                            |
| ----------- | ----------------------------------------------- | ------------------------------------------------- |
| Unvalidated | Initial load with no prior validation           | No status text                                    |
| Validating  | Validate clicked, awaiting Discord              | Button shows "Validating…", input dimmed          |
| Valid       | Discord returned 200                            | `text-success`, leading checkmark, result message |
| Invalid     | Discord returned a non-2xx                      | `text-destructive`, leading ×, specific reason    |
| Stale       | User typed in input after a previous validation | Status text clears immediately                    |

Stale clearing is on every input change. No warning hint, no "value changed — re-validate" intermediate state — just clean removal of the previous status.

### D9. Validate-Server-when-no-token: button disabled

If neither the form nor the DB has a bot token, the Server ID's `Validate` button is disabled with a `title` tooltip explaining "Set a bot token first." The error is conveyed visually (disabled button, tooltip), not via a click that always returns the same can't-do-this error.

**Why**: Disabled button is the cleaner UX; clicking a button to be told "you can't do this" is friction.

### D10. Reset behavior: full revert

Reset reverts every form field — including the activation toggle — to last-saved DB values. Validation status is cleared on every field. No server call.

**Why**: Reset that only reverts text fields but leaves the toggle alone is surprising. Full revert matches the user expectation of "undo my unsaved edits."

### D11. Toggle copy: just the state word

The activation toggle row contains a switch + a single state word: `Enabled` or `Disabled`, flipping with the switch state. No verbose explanatory copy.

The switch is disabled when no bot token is saved AND no token is in the form. (Once a token exists somewhere — either committed in DB or pasted in the form — the switch becomes interactive, since Save will commit the token + the toggle together.)

**Why**: The page already says what the integration does. The switch row only needs to convey the binary state. Verbose state-aware paragraphs were noise.

### D12. `enabled` column: keep the name, do not rename

The existing `enabled` column on `discord_integration_config` continues to gate the bot. With Discord login fully Supabase-managed, the column never gates anything else, so the name is unambiguous in context.

**Why**: A migration to rename `enabled` → `bot_enabled` is pure clarity for future readers and costs touch points across schema, RPC, types, and tests. The cost outweighs the benefit while the column has only one semantic. Revisit if a future feature adds a sibling toggle.

### D13. Help link in PageHeader actions

The page retains a `Help` link in the PageHeader actions slot, pointing to `/help/discord`. The help page covers the bot setup (token from Developer Portal, server invitation, etc.) and a brief mention of where Discord login is configured (Supabase Auth).

## Architecture

### Components

- **`page.tsx`** (Server Component) — Reads DB, renders `PageHeader` + a single `DiscordConfigForm` instance with the saved values as props. No env detection. No conditional Alerts.
- **`discord-config-form.tsx`** (Client Component) — Owns local form state for all fields + validation status per field. Houses both Validate actions and the Save action. No nested forms; one `<form action={save}>` with the inline Validate buttons being `type="button"` triggers that call separate server actions.
- **`bot-token-field.tsx`** — Deleted. Folded into `discord-config-form.tsx` (no longer has its own form/action).
- **`test-dm-button.tsx`** — Deleted. The standalone admin Verify button is removed entirely; the user-facing `Send test DM` in Connected Accounts remains as the end-to-end check.

### Server actions

In `src/app/(app)/admin/integrations/discord/actions.ts`:

- **`validateBotToken(formData)`** _(new)_ — Takes optional `newToken` from FormData. If present, validates that. If absent, reads saved Vault token and validates it. Returns `{ ok: true, botUsername } | { ok: false, reason: 'invalid_token' | 'transient' | 'not_configured', status?: number }`. No DB writes.
- **`validateServerId(formData)`** _(new)_ — Takes `serverId` (required) and optional `newToken` from FormData. Resolves token from `newToken` or saved Vault. Probes `/guilds/{serverId}/members/@me`. Returns `{ ok: true } | { ok: false, reason: 'not_member' | 'invalid_token' | 'transient', status?: number }`. No DB writes.
- **`saveDiscordConfig(formData)`** _(replaces `updateDiscordConfig` + `rotateBotToken`)_ — Takes all fields. Re-runs both validations server-side. Hard requirement: server validation must pass. If a new token was provided, validates it; if it passes, writes to Vault. Updates DB row with all fields atomically. Returns `{ ok: true, botUsername? } | { ok: false, errors: { field: string, message: string }[] }`.
- **`rotateBotToken`** — Deleted. Subsumed by `saveDiscordConfig`.
- **`sendTestDm`** — Deleted (along with its UI button).

### Validation logic

Token check (used by `validateBotToken` and `saveDiscordConfig`):

```ts
const res = await fetch("https://discord.com/api/v10/users/@me", {
  headers: { Authorization: `Bot ${token}` },
});
if (res.ok) return { ok: true, botUsername: (await res.json()).username };
if (res.status === 401) return { ok: false, reason: "invalid_token" };
return { ok: false, reason: "transient", status: res.status };
```

Server membership check (used by `validateServerId` and `saveDiscordConfig`):

```ts
const res = await fetch(
  `https://discord.com/api/v10/guilds/${serverId}/members/@me`,
  { headers: { Authorization: `Bot ${token}` } }
);
if (res.ok) return { ok: true };
if (res.status === 404 || res.status === 403)
  return { ok: false, reason: "not_member" };
if (res.status === 401) return { ok: false, reason: "invalid_token" };
return { ok: false, reason: "transient", status: res.status };
```

### Schema

No schema changes. The existing `discord_integration_config` columns (`enabled`, `guild_id`, `invite_link`, `bot_token_vault_id`) are kept. `bot_health_status` and `last_bot_check_at` columns are kept for PR5 to write to (PP-eps).

### Zod schema

`updateDiscordConfigSchema` is replaced by `saveDiscordConfigSchema`:

```ts
export const saveDiscordConfigSchema = z.object({
  enabled: z.boolean(),
  newToken: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || (v.length >= 50 && v.length <= 128),
      "Token looks the wrong length"
    )
    .refine(
      (v) => v === undefined || v === "" || /^[A-Za-z0-9._-]+$/.test(v),
      "Token contains invalid characters"
    ),
  guildId: z
    .string()
    .trim()
    .min(1, "Server ID is required")
    .max(64)
    .regex(/^\d+$/, "Server ID must be numeric"),
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
```

Empty `newToken` means "no change." Filled means "rotate."

### Env override removal

`src/lib/discord/config.ts:getDiscordConfig()` no longer short-circuits on env. The function reads only the DB row.

A new seed script `supabase/seed-discord.mjs` is added, modeled on `supabase/seed-users.mjs` (loaded via `node --env-file=.env.local`). Behavior: if `DISCORD_BOT_TOKEN` is set in env AND the `discord_integration_config` singleton row has `bot_token_vault_id IS NULL`, the script:

1. Opens a `postgres` connection using `POSTGRES_URL`.
2. Calls `vault.create_secret(env.DISCORD_BOT_TOKEN, 'discord_bot_token', 'Discord bot token (seeded from env)')` and captures the returned UUID.
3. Updates `discord_integration_config` (id='singleton'): sets `bot_token_vault_id` to the new UUID, copies `DISCORD_GUILD_ID` to `guild_id` and `DISCORD_INVITE_LINK` to `invite_link` (only if those columns are currently NULL — the script never overwrites a value an admin has set).
4. Closes the connection.

The script is idempotent (gated on `bot_token_vault_id IS NULL`) and runs as part of the existing seed pipeline. A new package.json script `db:_seed-discord` invokes it, and `db:reset` / fast-reset chains include it after `db:_seed-users`.

Env vars are otherwise unread by application code. After the seed step runs once, env can stay set or be unset — runtime ignores it either way.

### Tests

- **Unit**: `src/test/unit/lib/discord/config.test.ts` simplifies (no env stubbing needed; the DB path is the only path). Drop the four env-override-specific tests; keep the DB-only tests.
- **Unit**: New `validateBotToken` / `validateServerId` action tests with `fetch` mocked. Cover success, 401, 404, 403, transient.
- **Integration**: `src/test/integration/discord-config-actions.test.ts` (new) exercises `saveDiscordConfig` end-to-end through PGlite + mocked Discord. Covers happy path, invalid token rejection, server not-member rejection, no-token-change rotation.
- **E2E**: Existing `e2e/full/discord-dm-preferences.spec.ts` continues to work — its `enableDiscordIntegrationForTest` helper uses raw postgres + `vault.create_secret`, which is the same path the new seed step will use.
- **E2E**: Update `e2e/full/admin-discord-integration.spec.ts` to remove the "Replace" button and "Verify bot token" assertions; add a "Validate" button visibility assertion.

## Out of scope

- **Bot health badge re-add** (PP-eps). The dispatcher learns to write `bot_health_status` in PR5; this redesign does not touch the column.
- **Login admin toggle** (originally part of PP-cos). Not built — Supabase Auth manages it.
- **Database migration to rename `enabled` → `bot_enabled`** (D12). Skipped intentionally.
- **PR5 inline error surfaces** (DM-blocked banners, integration-down alerts). Not on this page.
- **Multi-tenant changes** to the page. Single-install scope only; multi-tenancy deferred.

## Migration notes

- Anyone with `DISCORD_BOT_TOKEN` set in `.env.local` and an existing seeded DB row needs no action — the env value is now ignored at runtime; the DB row is what's read.
- Anyone with `DISCORD_BOT_TOKEN` set in `.env.local` and an empty DB row will, on next `pnpm run db:_seed`, get the env values copied into the DB. They can then unset the env vars or leave them — the runtime ignores them either way.
- Production has no env override (env vars never set there), so production behavior is unchanged.

## Open questions resolved

- **Reset reverts toggle?** Yes (D10).
- **Stale validation visual?** Immediate clear on input change (D8).
- **Server Validate when no token?** Disabled with tooltip (D9).
- **`enabled` rename?** Skip (D12).

## Related issues

- **PP-2n5** — PR 4: Discord DM channel + preferences UI (parent; this redesign lands within it).
- **PP-cos** — Admin enable/disable toggles. Login portion deferred to "managed by Supabase"; bot portion already covered by existing `enabled`. Closed by this work.
- **PP-eps** — PR 5: Discord failure detection + in-app system alerts. Independent; runs after this PR.
