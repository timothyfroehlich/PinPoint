# Discord Notifications — Feature Spec

**Status: approved.**

Requirements for PinPoint's Discord bot, which DMs members about issue and
machine activity, and its admin configuration surface. Describes the intended
final state; current code lives in the Known divergences table.

Discord _login_ is a separate system (Supabase OAuth) and is not covered here.
Disabling notifications never affects login.

Related: `docs/feature-specs/admin-integrations.md` (the page this card lives
on), the Pinball Map region-alerts spec (a separate feature that uses this bot
token — §1.2).

---

## 1. The integration

- **1.1** One Discord bot, PinPoint-wide, delivers notifications as direct
  messages to members.
- **1.2** The bot token is the Discord credential, owned by this spec. Other
  features may use it — the Pinball Map region-alerts posts do (separate spec).
  This spec does not define their behavior; each is gated by its own spec.
- **1.3** A member can only be DM'd if they have linked their Discord account,
  which the login side records.

## 2. Configuration (the admin card)

The card uses the credential-entry pattern: fields, a Save that validates and
records, a separate re-check, and a stored status line. It is not a toggle.

- **2.1** Fields:
  - **Bot token** — the secret. Write-only: a configured token shows as "Saved"
    and is replaced by pasting a new one.
  - **Server ID** — required. The Discord server whose members the bot may DM.
  - **Invite link** — optional. Shown to a member who cannot receive DMs (§4.2).
- **2.2** No enable flag. The integration is on when a bot token and a server ID
  are both on file and validated. To turn it off, clear either one.
- **2.3** Saving validates the token against the server and stores the result as
  the connection status (§3). The save always persists the entered config, even
  when validation fails — a failed check records "not working" rather than
  discarding input (CORE-ARCH-012).
- **2.4** A **Test connection** action re-checks the stored config without
  editing it.
- **2.5** The invite link is format-checked inline. It is not part of the
  connection test.
- **2.6** Both the bot token and the server ID are required; clearing either
  turns the integration off. The invite link is optional and does not affect
  on/off.

## 3. Connection status

- **3.1** Connection status is stored and shown on the card on load, not a
  response to a button. It survives reload.
- **3.2** States:
  - **Connected** — token and server verified, with the last-check time.
  - **Not working** — Discord rejected the config; names which half failed (bad
    token, or bot not in the server) and the reason.
  - **Couldn't check** — Discord was unreachable; the config may be fine.
  - **Not configured** — the bot token or the server ID is missing (the off
    state).
    Connected shows a stale qualifier ("verified 3 days ago") when the last check
    is old.
- **3.3** Real traffic updates the status: a 401 on a send marks the connection
  Not working. There is no background health-check poll.

## 4. Sending

- **4.1** A notification is DM'd to the member's linked Discord account. A member
  with no linked account is skipped, not errored.
- **4.2** The invite link is shown where a DM failure is already surfaced to a
  member — the Test DM response (settings §Connected accounts). A persistent
  member-facing surface for background notification failures is out of scope;
  ordinary notification sends are background fan-out and only log a failed DM.
- **4.3** No outbound Discord call runs inside a database transaction
  (CORE-ARCH-011).

## 5. Permissions

- **5.1** Configuring Discord requires the manage-integrations capability
  (admin-integrations spec §7).

---

## Known divergences (code vs spec)

| Spec                            | Code today                                                                        | Resolution                                                                             |
| :------------------------------ | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| §2.2 no enable flag             | `discord_integration_config.enabled` gates sending (`config.ts` 73, 133)          | Drop the column; token presence is the gate                                            |
| §2.3 save validates and records | An enabled save is rejected on a failed probe rather than recording it            | Always persist; write the outcome to status                                            |
| §2.4 one Test connection        | Two per-field Validate buttons; results held in client state, lost on reload      | Collapse to Save-validates + a stored-config Test connection                           |
| §3 stored status                | `bot_health_status` / `last_bot_check_at` columns exist but are never written     | Wire the write path; widen the enum (rejected vs unreachable)                          |
| §3.3 traffic updates status     | `sendDm` 401s classified for the send result but never persisted to config health | On a 401, write Not working                                                            |
| §2.5 invite-link format check   | Invite link saved with no validation                                              | Inline format check                                                                    |
| §4.2 invite link on Test DM     | Invite link is stored but never surfaced                                          | Show it in the Test DM response; a general failed-notification surface is out of scope |

---

## Changelog

| Date       | Change   |
| :--------- | :------- |
| 2026-08-22 | Created. |
