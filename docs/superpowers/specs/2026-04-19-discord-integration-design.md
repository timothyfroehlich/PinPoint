# Discord Integration + Multi-Provider OAuth Design

**Date**: 2026-04-19
**Status**: Draft (pending user review)
**Epic**: (to be assigned — bead created as part of this spec)

## Problem

PinPoint currently supports email/password authentication only (with magic link for resets). There's no way to sign in via a social provider, and notifications are limited to email + in-app only. Two concrete needs:

1. **Login friction**. Signing up and remembering a password is friction; users in the Austin Pinball Collective (APC) community already have Discord accounts. "Sign in with Discord" would lower the bar for new users.
2. **Notification reach**. Email notifications work, but DMs are where the APC community actually pays attention. Users who link Discord should be able to receive notifications via DM with full per-event control matching the existing email settings.

Additionally, the current notification dispatcher hardcodes email and in-app as parallel channels. Adding Discord as a third channel by pasting a third identical block triggers PinPoint's Rule of Three — it's time to extract a channel dispatcher abstraction first.

Finally: operators should not have to redeploy to rotate a bot token, change which Discord server the bot lives in, or disable the Discord integration during an outage. The bot configuration belongs in an admin-gated UI, not env vars.

## Goals

1. Refactor the notification dispatcher into a pluggable channel abstraction (no behavior change).
2. Add a multi-provider OAuth framework that supports Discord today and Google/GitHub/others later with minimal code additions.
3. Allow existing users to link Discord to their PinPoint account, and new users to sign up via Discord.
4. Preserve account identity across providers (auto-link by email when both providers verify it).
5. Allow admins to configure the Discord bot integration (token, guild, enabled flag) from a UI without env var changes.
6. Deliver notifications to Discord via DM when the user has linked Discord, with per-event preferences mirroring email.
7. Surface DM delivery failures intelligently — distinguish "this specific user isn't reachable" from "the bot is down" — and alert the right audience via in-app notifications.

## Non-goals (v1)

- Discord bot slash commands (`/pinpoint list-my-issues` etc.)
- Posting notifications to shared Discord channels (bot only DMs individuals)
- Creating issues or comments from Discord (one-way delivery only)
- Rich Discord embed messages (plain text with link for v1)
- Batching / coalescing DMs within a short window (explicitly dropped as premature optimization)
- Daily digest notifications (captured as a follow-up bead)
- Per-org Discord integration (v1 assumes single APC server for all users)

## Design

### Architecture at a glance

```
  ┌─────────────────────────────────┐
  │  Event triggers createNotification() │
  └──────────────┬──────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────┐
  │  Pre-dispatch: suppressOwnActions│
  └──────────────┬──────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────┐
  │  Channel registry iteration     │
  │  (function-based dispatcher)    │
  └──┬───────────┬────────────┬─────┘
     │           │            │
     ▼           ▼            ▼
  ┌────┐    ┌─────┐    ┌────────┐
  │Email│    │InApp│    │Discord │
  └────┘    └─────┘    └────┬───┘
                             │
                             ▼
                      ┌────────────┐
                      │ Bot client │
                      │ (DM send)  │
                      └────┬───────┘
                           │
                ┌──────────┴──────────┐
                │ failure detection   │
                │ (per-user/global)   │
                └──────────┬──────────┘
                           │
                           ▼
                ┌────────────────────┐
                │ system_discord_*   │
                │ in-app alerts      │
                └────────────────────┘
```

### PR breakdown (5 PRs, shipped in dependency order)

| PR  | Title                                            | Depends on | Parallel with |
| --- | ------------------------------------------------ | ---------- | ------------- |
| 1   | Notifications channel dispatcher refactor        | —          | 2, 3          |
| 2   | OAuth provider framework + Discord linking       | —          | 1, 3          |
| 3   | Admin Discord integration config subpage         | —          | 1, 2          |
| 4   | Discord DM channel + preferences UI              | 1, 3       | —             |
| 5   | Discord failure detection + in-app system alerts | 4          | —             |

#### PR 1 — Notifications channel dispatcher refactor

Replace the hardcoded email + in-app blocks in `src/lib/notifications.ts` with a registry of `NotificationChannel` plain-object dispatchers. No schema changes, no new env vars, no UI changes. Acceptance: every existing notification test passes unchanged.

Each channel is a plain object (not a class):

```
{
  key: 'email' | 'in_app',
  shouldDeliver: (prefs, eventType) => boolean,
  deliver: (recipient, payload) => Promise<DeliveryResult>,
}
```

Channels live in separate files for containment: `src/lib/notifications/channels/email-channel.ts`, `in-app-channel.ts`. Registry in `registry.ts` returns an ordered list via `getChannels()` (function, not constant, so env-dependent channels can opt out cleanly in later PRs). Dispatcher uses `Promise.allSettled` over the filtered channel list. `suppressOwnActions` stays at the top of `createNotification` (cross-channel concern).

Email formatting (`notification-formatting.ts`) is intentionally **not** moved in this PR — that's tracked as a follow-up bead.

#### PR 2 — OAuth provider framework + Discord linking

Generic multi-provider OAuth abstraction with Discord as the first implementation. Google and others slot in later with ~5 lines each.

**Provider registry** (`src/lib/auth/providers.ts`):

```
{
  key: 'discord',
  displayName: 'Discord',
  icon: <DiscordIcon />,
  scopes: 'identify email',
  isAvailable: () => !!process.env.DISCORD_CLIENT_ID,
}
```

**Supabase config changes** (`supabase/config.toml.template`):

- `[auth.external.discord]` block enabled, scopes `identify email`
- `enable_manual_linking = true` — allows `supabase.auth.linkIdentity()`
- `enable_linked_identities = true` (or Supabase's equivalent auto-link flag — to be verified via context7 Supabase docs before implementation)

**Login/signup forms**: iterate the provider registry, render one OAuth button per available provider. If no providers are configured (all `isAvailable()` return false), the OAuth section doesn't render.

**Connected Accounts settings section** (`/settings` page): new section rendering one row per registered provider. Each row shows linked state (with unlink button) or unlinked state (with link button). Server actions:

- `linkProviderAction(providerKey)` — wraps `supabase.auth.linkIdentity()`
- `unlinkProviderAction(providerKey)` — wraps `supabase.auth.unlinkIdentity()`, refuses if the unlink would leave `auth.identities` count at 0 for the user (i.e., user must retain ≥1 login method of any kind — OAuth identity or password). UI grays out the unlink button with a tooltip when the user has only one identity.

**Auth callback route** (`src/app/(auth)/auth/callback/route.ts`): no substantive changes — existing `exchangeCodeForSession` handles OAuth code exchange identically regardless of provider.

**Zero bot code, zero notification code, zero schema migration.** This PR is pure identity work.

#### PR 3 — Admin Discord integration config subpage

Introduce the mechanism for admin-managed Discord bot configuration. Runtime isn't used yet — this PR establishes the infrastructure.

**New table** `discord_integration_config` (singleton row):

```
id                   uuid PK (singleton)
bot_token_vault_id   text    (reference to Supabase Vault secret)
guild_id             text    (APC server ID)
invite_link          text    ("Join APC" URL shown in warnings)
enabled              boolean DEFAULT false
bot_health_status    enum('unknown','healthy','degraded')
last_bot_check_at    timestamptz
updated_at, updated_by
```

**Supabase Vault** stores the bot token, not the table directly. Access via a `SECURITY DEFINER` SQL function that verifies caller has admin role. Table column stores only the vault reference.

**RLS policies**:

- `SELECT`: admin role only
- `INSERT / UPDATE`: admin role only
- Regular users: no visibility

**Admin subpage** at `/admin/integrations/discord`:

- **Status** section: bot health derived from last check + recent failures, counts of users with DMs currently blocked, last successful DM timestamp.
- **Configuration** section: bot token input (write-only; displays `••••••` when set; "Replace" button to rotate), guild ID, invite link, enabled toggle.
- **Test** section: "Send test DM to me" button — admin self-tests without needing a separate user to verify.

**Runtime reader** `getDiscordConfig()` returns a typed object for later PRs to consume. Returns null if `enabled=false` or no row exists — lets PR 4's channel registration skip gracefully.

#### PR 4 — Discord DM channel + preferences UI

The happy path: users receive Discord DMs, manage per-event preferences, self-verify via test DM.

**Schema additions** to `notification_preferences`:

- `discordEnabled` boolean
- `discordNotifyOnAssigned`, `discordNotifyOnStatusChange`, `discordNotifyOnNewComment`, `discordNotifyOnMentioned`, `discordNotifyOnNewIssue`, `discordNotifyOnMachineOwnershipChanged`
- `discordWatchNewIssuesGlobal`
- `discord_dm_blocked_at` timestamptz (null = not blocked; used by PR 5)

**Schema additions** to `user_profiles`:

- `discord_user_id` text UNIQUE nullable — denormalized mirror from `auth.identities.identity_data.provider_id`, populated in auth callback on Discord login/link, cleared on Discord unlink.

**Discord bot client** (`src/lib/discord/client.ts`):

- `sendDm(discordUserId, content)` — opens DM channel via `POST /users/@me/channels`, sends message. Returns a discriminated result: `{ok: true}` / `{ok: false, reason: 'blocked' | 'rate_limited' | 'transient' | 'not_configured'}`.
- Rate-limit handling: honor Discord's `retry-after` header with a single inline retry, then drop.
- Token read from `getDiscordConfig()`.

**Discord channel** (`src/lib/notifications/channels/discord-channel.ts`): implements the `NotificationChannel` contract from PR 1. Reads `discordEnabled` + `discordNotifyOn*` columns. `shouldDeliver()` also returns false if the user has no `discord_user_id` (unlinked), or if `discord_dm_blocked_at` is set (blocked — suppress until cleared).

**Registry integration**: Discord channel is registered only when `getDiscordConfig().enabled === true`. Otherwise the channel isn't in the list and no Discord UI renders (clean degraded state — see 7.1 decision below).

**Preferences form** (`src/app/(app)/settings/notifications/notification-preferences-form.tsx`): expand from 2-column to 3-column matrix (Email | In-App | Discord). Container queries handle narrow-screen layout — on small containers, sections stack rather than scroll sideways. When user hasn't linked Discord, Discord column is disabled with inline "Link Discord to enable" CTA linking to Connected Accounts.

**Test DM button**: lives in the Connected Accounts Discord row (from PR 2). Clicking it calls the bot client; inline result area shows success/failure with actionable message.

**Footer line in DMs**: every DM includes a final line with a link to `/settings/notifications`. (Discord DMs don't need per-message HMAC unsubscribe tokens — users manage preferences via the app.)

#### PR 5 — Discord failure detection + in-app system alerts

Bring the failure UX up to standard — users learn about DM problems in-app, admins learn about outages.

**New notification types**:

- `system_discord_dm_blocked` — user-fixable (user not in APC, DMs blocked from members)
- `system_discord_integration_down` — admin-fixable (bot kicked, token revoked, Discord outage)

These types bypass the preference matrix (they are system/ops messages, not opt-outable) and only go through the in-app channel.

**Detection logic** inside Discord channel's `deliver()`:

- On 403/404 from `sendDm`:
  - Perform a cached bot self-check (`GET /guilds/{APC_GUILD_ID}/members/@me`, 5-minute TTL).
  - If self-check succeeds: bot is fine, it's a per-user issue. Set `discord_dm_blocked_at` + emit `system_discord_dm_blocked` (deduped: don't re-emit while `discord_dm_blocked_at` is already set).
  - If self-check fails: bot is the problem. Flip `discord_integration_config.bot_health_status = 'degraded'`. Emit `system_discord_integration_down` for each Discord-linked user, rate-limited to once per 24 hours per user.
- On successful DM: clear `discord_dm_blocked_at` (auto-recovery).

**In-app alert UX**:

- Alert icon on the global notifications bell in the nav
- Entry at the top of the notifications dropdown, dismissable
- Click navigates to `/settings/notifications` (the page where Discord status is visible inline)

**Inline warnings on the preferences page** (no page-wide banner):

- Connected Accounts Discord row: `⚠️ DMs not reaching you` with "Retry test" button when `discord_dm_blocked_at` is set
- Discord column header in preferences matrix: `⚠️ Can't deliver` when DMs are blocked
- Dimmed column state when the integration is globally degraded

## Decisions log

Canonical record of choices made during the brainstorm, so future contributors don't re-litigate:

| #   | Decision                                          | Chosen                           | Rationale                                                                                                                                                 |
| --- | ------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Refactor architecture                             | Function-based dispatcher        | Simpler than classes; closures capture transport deps; preserves upgrade path to JSONB                                                                    |
| 2   | Separate files per channel                        | Yes                              | Containment — each file is the only place that knows about its transport                                                                                  |
| 3   | Preference schema (flat vs. JSONB vs. normalized) | Flat (keep current shape)        | Schema change not yet justified; channels own their column mapping                                                                                        |
| 4   | PR slicing                                        | 5 PRs                            | PRs 1/2/3 parallel; 4 depends on 1+3; 5 depends on 4                                                                                                      |
| 5   | New-user account creation via Discord             | Role=guest (default)             | Matches existing signup default                                                                                                                           |
| 6   | Trust Discord's `email_verified`                  | Yes                              | Consistent with auto-link-by-email safety model                                                                                                           |
| 7   | Auto-link by email across providers               | Yes                              | Prevents orphan accounts when existing user signs in via a new provider                                                                                   |
| 8   | Unlink safety                                     | User must retain ≥1 login method | Unlink is refused if it would leave `auth.identities` count at 0 for that user. Prevents account lockout. Applies to any provider (not Discord-specific). |
| 9   | OAuth scopes                                      | `identify email`                 | Minimum; `guilds` scope not needed once membership check moves to bot API                                                                                 |
| 10  | Display Discord username/avatar in UI             | No                               | Backend-only; keeps PinPoint schema clean                                                                                                                 |
| 11  | Message format                                    | Plain text + footer link         | Simple; rich embed is a follow-up                                                                                                                         |
| 12  | Batching                                          | Dropped                          | Premature optimization; no evidence DM spam is a problem                                                                                                  |
| 13  | Daily digest option                               | Deferred to follow-up bead       | Requires scheduled-job infra PinPoint doesn't have yet                                                                                                    |
| 14  | Rate-limit handling                               | Single inline retry on 429       | Honor Discord's `retry-after` once, then drop                                                                                                             |
| 15  | Per-message settings link                         | Every DM                         | Mirrors email footer pattern                                                                                                                              |
| 16  | Discord column when user unlinked                 | Disabled with link CTA           | Preserves toggle values for relink; guides user to recovery                                                                                               |
| 17  | DM-blocked UX                                     | Inline warnings + in-app alert   | No page-wide banner; contextual; auto-recovers when fixed                                                                                                 |
| 18  | Missing bot token                                 | Channel not registered           | If feature can't work, don't advertise it                                                                                                                 |
| 19  | Global bot failure detection                      | Cached self-check (5-min)        | Distinguishes per-user vs. global; avoids user-blaming during outages                                                                                     |
| 20  | User unlinks with Discord toggles on              | Preserve toggle values           | Natural recovery when re-linking                                                                                                                          |
| 21  | Admin Discord config location                     | DB + admin UI (not env)          | Operators rotate tokens / toggle feature without redeploy                                                                                                 |
| 22  | OAuth client ID/secret location                   | Env vars (Path A)                | Set once, rarely rotated; Supabase owns the OAuth layer                                                                                                   |
| 23  | `user_profiles.discord_user_id` mirror            | Keep mirror                      | Cheap denormalization; avoids `auth.identities` join per notification send                                                                                |
| 24  | Google OAuth in PR 2                              | Separate follow-up PR            | Keeps PR 2 scope tight; Google becomes the first real test of the framework's genericity                                                                  |

## Out of scope / follow-up beads

- **Google OAuth** integration (uses the PR 2 framework — trivial addition once PR 2 lands)
- **Consolidate email formatting into `email-channel.ts`** (moves `getEmailSubject` / `getEmailHtml` from `notification-formatting.ts`; cohesion improvement, kept out of PR 1 to preserve behavior-preserving refactor contract)
- **Discord rich embed messages** (replace plain text with Discord's structured message format)
- **Discord daily digest** (opt-in; requires scheduled-job infra — separate design work)
- **Slash commands** (`/pinpoint list-my-issues`, `/pinpoint settings`)
- **Channel posts** (bot posts to shared channels instead of DMs — e.g., team activity feed)
- **Issue creation from Discord** (two-way integration)

## Open questions

1. **Supabase auto-link-by-email flag name**. We chose `enable_linked_identities = true` conceptually (decision #7), but the exact Supabase config flag needs verification via context7 Supabase docs before PR 2 implementation. If the flag doesn't exist or is named differently, this spec needs an amendment. (Not a blocker for spec approval — a pre-implementation verification.)

2. **Vault integration pattern**. We chose Supabase Vault for bot token storage (PR 3). The exact `SECURITY DEFINER` function shape for reading the token is an implementation detail to resolve during PR 3 planning — this spec commits to the pattern, not the exact function signature.

## Verification (end-to-end, once all 5 PRs land)

1. Admin creates Discord app, obtains client ID/secret/bot token
2. Admin sets `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` env vars (one-time)
3. Admin visits `/admin/integrations/discord`, pastes bot token + guild ID + invite link, clicks Enable
4. Admin clicks "Send test DM to me" → receives DM in Discord
5. New user visits `/signup`, clicks "Sign in with Discord" → completes OAuth → lands in app as guest
6. Existing user (email/password) visits `/settings`, clicks Link Discord → completes OAuth → Connected Accounts row shows linked state
7. User visits `/settings/notifications`, toggles Discord column on for "When assigned to an issue", saves
8. Another user assigns an issue to them → they receive a DM in Discord with the issue link
9. User leaves APC server → next DM fails → in-app alert appears, Connected Accounts row shows warning, auto-recovers when they rejoin
10. Admin revokes bot token → next DM fails → `system_discord_integration_down` in-app alerts go out to all Discord-linked users
