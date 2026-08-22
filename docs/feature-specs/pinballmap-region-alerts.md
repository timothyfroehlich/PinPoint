# Pinball Map Region Alerts — Feature Spec

**Status: approved.**

Requirements for the region-alert feature: PinPoint watches a Pinball Map region
and posts newly-appeared machines to a Discord channel. Describes the intended
final state; current code lives in the Known divergences table.

The Discord bot token this uses is owned by `docs/feature-specs/discord.md`;
this spec consumes it and does not redefine it. Configuration lives in the
Pinball Map section of the Admin Integrations page.

Related: `docs/feature-specs/pinballmap.md` (the location-sync integration),
`docs/feature-specs/discord.md` (the bot token), `docs/feature-specs/admin-integrations.md`.

---

## 1. The feature

- **1.1** On a schedule, PinPoint reads the machines listed across a whole
  Pinball Map **region** (not just the tracked location), and posts machines it
  has not seen before to a configured Discord channel.
- **1.2** This is distinct from location sync (`pinballmap.md`): that watches the
  one venue PinPoint tracks; this watches the whole region to announce new
  arrivals anywhere in it.
- **1.3** Posting uses the Discord bot token (`discord.md`). With no working bot
  token, region alerts cannot post regardless of their own config.

## 2. Configuration (Pinball Map section)

- **2.1** Fields:
  - **Region** — which Pinball Map region to watch, one at a time, chosen from a
    list of regions read from Pinball Map (not free text).
  - **Alert channel** — the Discord channel id the alerts post to.
- **2.2** No enable flag. Region alerts are on when a region and an alert channel
  are configured and the Discord bot token is present. To turn them off, clear
  the alert channel.
- **2.3** Saving checks the alert channel against Discord — reachable, and the
  bot's permissions look sufficient to post — and stores the result as the
  channel status (§3). The check is best-effort: only a real post fully confirms
  the bot can post (§2.4, §3.3). The save always persists the entered config,
  even when the check fails (CORE-ARCH-012).
- **2.4** A **Send test message** action posts a test line to the alert channel.
  A real post is the only definitive proof the bot can post, so this both lets an
  admin confirm the setup and updates the channel status (§3.3).
- **2.5** Changing the region starts the new region from a clean slate: its
  seen-set is bootstrapped so the switch does not announce the new region's whole
  existing state as "new" (§4.4).

## 3. Channel status

- **3.1** Channel status is stored and shown on the card on load. It survives
  reload.
- **3.2** States:
  - **Posting** — the channel is reachable and the bot looks able to post there;
    a successful alert post confirms it (§3.3), with the last-post time.
  - **Can't post** — the bot cannot post: either it lacks permission in the
    channel, or the channel is not found or not visible to it. (Discord does not
    always distinguish "deleted" from "hidden," so those share this state.)
  - **Couldn't check** — Discord was unreachable (rate limit or outage); the
    config may be fine.
  - **Needs Discord** — the bot token is missing or invalid (`discord.md`); fix
    Discord first.
  - **Not configured** — no region or no alert channel.
- **3.3** Real traffic updates the status: a successful alert post confirms
  Posting; a post that fails moves it to Can't post, Couldn't check, or Needs
  Discord per the failure. A definitive "can post" is only ever proven by a
  post succeeding.

## 4. Alerting behavior

- **4.1** Alerts run on a fixed hourly schedule (a server cron). The cadence is
  not admin-configurable, and there is no on-demand run — the test message (§2.4)
  is the only manual post.
- **4.2** Only two kinds of change are announced: a machine **added** to a
  location in the region, and a machine **removed** from one. No other Pinball
  Map activity is announced — not condition comments, high scores, new locations,
  or photos.
- **4.3** Each change is announced once: recorded when first seen and marked
  announced only after the post succeeds; a failed post is retried on the next
  run, not lost.
- **4.4** The first run for a region records current state as already-seen
  without announcing, so enabling alerts (or switching region, §2.5) does not
  dump the region's existing activity into the channel.
- **4.5** A bad or partial upstream read does not produce alerts: an empty,
  implausibly large, or truncated region payload is discarded rather than
  announced.
- **4.6** Each alert names the added or removed machine and its venue, links to
  the venue's Pinball Map page (the location-specific link-back, CORE-PBM-001),
  and carries the required Pinball Map attribution (CC BY-SA 4.0, CORE-PBM-001).
- **4.7** No outbound Discord call runs inside a database transaction
  (CORE-ARCH-011).

## 5. Permissions

- **5.1** Configuring region alerts requires the manage-integrations capability
  (admin-integrations spec §7).
- **5.2** The region seen-set is server-only state, not readable by clients.

---

## Known divergences (code vs spec)

| Spec                                         | Code today                                                                                                                                                                                 | Resolution                                                                                                                  |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| §2.1 region chosen from a list               | Region is the hardcoded `PBM_AUSTIN_REGION` constant                                                                                                                                       | Add a regions-list read from Pinball Map; make it a stored field                                                            |
| §2.1 alert channel in config                 | Channel is the `DISCORD_PBM_ALERT_CHANNEL_ID` env var (`getRegionAlertChannelId`)                                                                                                          | Move to DB; configure in the admin card                                                                                     |
| §2.2 no enable flag                          | Gated on `pinballmap_state.enabled` (the cron route checks it)                                                                                                                             | Drop the flag; channel presence + bot token are the gate                                                                    |
| §2.3 channel validated + status              | Channel is used blind; no validation, no stored status                                                                                                                                     | Validate on save; store channel status                                                                                      |
| §2.4 Send test message                       | No test action; the channel is only exercised by the hourly cron                                                                                                                           | Add a Send test message button                                                                                              |
| §3 stored status                             | No status surfaced anywhere in admin                                                                                                                                                       | Build the status readout                                                                                                    |
| §4.1 fixed hourly schedule                   | Hardcoded Vercel cron at `23 * * * *`                                                                                                                                                      | Keep; spec documents the fixed cadence                                                                                      |
| §4.2 added AND removed, typed filter         | Code diffs the full region machine list (`fetchRegionLmxes`) — additions only, removals never announced                                                                                    | Read the region activity feed filtered to machine add/remove (`submission_type[]=new_lmx&submission_type[]=remove_machine`) |
| §4.2 activity-feed assumptions               | Vendored docs scope `submission_type` to the index/location/list_within_range endpoints, not explicitly the region feed; and it is unconfirmed the feed carries venue/machine names inline | Verify at build time that the region feed accepts the filter, and whether the venue-naming second call is still needed      |
| §4.3–4.5 dedup / bootstrap / bad-read guards | Built in `region-alerts.ts` for the list-diff approach (`pinballmap_region_seen_machines`)                                                                                                 | Keep the intent; rework the dedup store for the activity-feed model                                                         |
| §4.6 message content + attribution           | `region-alert-message.ts` builds the post (masked venue links + CC BY-SA attribution) from the list-diff data                                                                              | Keep the attribution + location link-back; rebuild the message from the activity-feed model                                 |

---

## Changelog

| Date       | Change   |
| :--------- | :------- |
| 2026-08-22 | Created. |
