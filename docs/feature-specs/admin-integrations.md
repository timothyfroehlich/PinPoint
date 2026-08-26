# Admin Integrations — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Admin Integrations
page: the one admin surface that configures PinPoint's connections to
third-party services, one section per integration. It describes the intended
final state only; what the code does or used to do lives solely in the Known
divergences table. Each requirement is numbered for citation. When code and
spec disagree, either the code is wrong or this document gets amended — never
silently neither.

**Related records.** `docs/feature-specs/pinballmap.md` (the Pinball Map
integration's own behavior — the listing control, the refresh throttle, the
snapshot model; this page configures that integration but does not restate it),
`docs/feature-specs/discord.md` (the Discord card's behavior).

---

## 1. Concepts

- **Integration** — a third-party service PinPoint connects to. Two exist:
  **Discord** (bot notifications) and **Pinball Map** (public-lineup sync).
  Each integration owns exactly one section on the page.
- **Section** — one integration's configuration surface on the page. A section
  is self-contained: it reads and writes only its own integration's settings,
  and it saves independently of every other section (§2).
- **Location** — which Pinball Map location PinPoint tracks, named by a numeric
  Pinball Map location id. Zero or one location, PinPoint-wide. A stored
  location means configured; no stored location means Not configured (§5).
  Everything Pinball Map observes — the lineup, the stored snapshot, comment
  imports — is scoped to the configured location, so replacing it invalidates
  that observed state (§6).

## 2. The page

- **2.1** A single admin page lists every integration as a section, one section
  per integration, on one route. There is no per-integration page.
- **2.2** The page is admin-only: it requires the manage-integrations
  capability (§7), an admin-tier grant. A member, technician, or guest never
  reaches it.
- **2.3** Each section saves and resets on its own. Editing and saving one
  section never touches another's fields, dirty state, or stored settings. A
  section with unsaved edits warns before the page is abandoned.
- **2.4** Sections render in a fixed order with the same visual frame, so a new
  integration is added as another section without restructuring the page.

## 3. The Discord section

- **3.1** The Discord section implements the credential-entry card defined by
  the Discord spec §2–§3. It has no enable toggle; the required configuration's
  presence and validation determine its state.
- **3.2** The section links to the Discord help page, as the standalone page
  does today.

## 4. The Pinball Map section

- **4.1** The section shows, and lets an admin edit, the Pinball Map
  integration's PinPoint-wide settings: the location id (§5–§6) and —
  read-only — the integration's sync health (4.2). It has no separate enable
  toggle.
- **4.2** Sync health shows the last successful sync time, the last sync
  _attempt_ time, the last sync outcome (ok / error) with the error text when
  it failed, and the number of machines in the stored lineup snapshot. It is a
  status readout, not an editable field. With no configured location it instead
  shows **Not configured**; retained health is not presented as current.
- **4.3** The section offers a **Sync now** action that refreshes the stored
  lineup snapshot on demand while configured. It draws from the same global
  refresh allowance as the machine listing control's Refresh and location
  validation (pinballmap spec 3.2) — all three share one budget — and disables
  with a countdown when the allowance is spent. While Not configured, the
  action is unavailable and the section states that a location must be saved
  first.
- **4.4** While configured, the section links out to the location's Pinball Map
  page, using the location-specific link-back (pinballmap spec 9.1) rather than
  a hand-written URL. It renders no location link while Not configured.
- **4.5** The section is Pinball Map's _configuration_ surface only. It does not
  show per-machine listing state, the listing control, or fleet-wide Pinball
  Map views — those live on the machine edit page (pinballmap spec §4) and the
  admin fleet dashboard.
- **4.6** Per-operator outbound write credentials (the account Pinball Map
  attributes edits to) are **not** configured here — they are per-user and
  belong to a person's own settings, not an admin surface. This section
  configures only PinPoint-wide Pinball Map state.

## 5. Pinball Map configuration state

- **5.1** _Retired 2026-08-23._ The distinct enable toggle was replaced by
  configuration presence (§5.4). Number kept so older citations do not dangle.
- **5.2** _Retired 2026-08-23._ Enabling no longer exists as a separate action;
  successfully setting a location supplies the first valid snapshot (§6.2).
  Number kept so older citations do not dangle.
- **5.3** _Retired 2026-08-23._ Disabling through a separate flag was replaced
  by clearing the location (§5.6). Number kept so older citations do not
  dangle.
- **5.4** Pinball Map is configured when a location id is stored and **Not
  configured** when it is absent. There is no distinct enable flag.
- **5.5** While Not configured, PinPoint makes no location-tracking Pinball Map
  API calls and does not render or reconcile retained observed state as current.
  Admin and machine surfaces show Not configured. The separately configured
  region-alert feature is unaffected and follows its own spec.
- **5.6** Clearing the location requires confirmation that automatic and manual
  refreshes will stop. It retains the last snapshot and sync health, every
  machine's catalog match and listing intent, imported comments, and
  location-stamped abandoned-entry records; disabling is reversible and does
  not manufacture an external change.
- **5.7** Setting a location while Not configured follows the validation and
  commit sequence in §6.2. Setting the previously tracked location resumes
  tracking without treating its entries as having disappeared; setting a
  different location applies the location-change consequences in §6.

## 6. Changing the tracked location

Replacing the tracked location is a rare, near-never operation — PinPoint
tracks at most one venue and it does not move. §6 makes replacement safe and
honest rather than building a workflow around it.

- **6.1** The location id is an optional editable field. Setting it configures
  Pinball Map; clearing it makes the integration Not configured (§5).
- **6.2** Saving a non-empty location id runs as an ordered sequence, **not one
  transaction** — the validation is a Pinball Map fetch and an external effect
  never runs inside a DB transaction (CORE-ARCH-011):
  - **Validate first.** PinPoint fetches the new location from Pinball Map
    before changing any stored state, using the shared allowance in §6.5. A
    successful fetch is what makes the id valid; a failed or throttled attempt —
    unknown id, network or auth error, or no token currently available — aborts
    the whole change with nothing wiped and the previous configuration
    unchanged. A location with zero machines is valid (a legitimately empty
    venue) and proceeds.
  - **Then commit the switch.** In one transaction: store the new id, replace
    the stored lineup snapshot with the freshly fetched one, and set the
    sync-health fields (4.2) to reflect that fetch. The old location's observed
    state is gone only because it has been replaced, never left half-cleared.
  - Previously imported condition comments are marked as belonging to a
    previous listing, **permanently**, only when the newly validated location
    differs from the previously tracked one. Initial configuration and resuming
    the same location do not mark comments. A location change is not a Pinball
    Map removal, so the 7-day restoration window (pinballmap spec 7.2, 7.3)
    does not apply and the comments are never unmarked. This is a no-op until
    comment import exists.
- **6.3** Replacing one configured location with another **keeps** every
  machine's catalog match and every machine's listing intent. A match is a
  catalog-title identity, not a location fact; intent is a deliberate operator
  decision. Neither is discarded by moving locations.
- **6.4** An abandoned-listing record belongs to the Pinball Map location it was
  recorded at, and it is **kept** across a location change so the old location's
  orphans can still be cleaned up (§6 opening). A kept record for a location
  PinPoint no longer tracks is **never reconciled against the current lineup** —
  not by the change's own refresh and not by any later sync. Its lmx is absent
  from a different location's lineup by definition, and the reconcile pass reads
  that absence as "the operator removed it" (pinballmap spec 2.5), which would
  silently delete every old record and report a cleanup nobody performed
  (CORE-ARCH-012). Requires stamping each record with its location; see the
  divergence table.
- **6.9** Removing an abandoned entry whose location PinPoint no longer tracks
  fires the **stored lmx only** and never re-resolves the machine's title against
  any lineup. An lmx is globally unique on Pinball Map, so the direct remove
  takes down the correct old-location entry; a Pinball Map `not_found` is treated
  as already-gone and the record is dropped. The re-mint recovery that a
  same-location removal uses (pinballmap spec — re-resolve the title against the
  live lineup when the handle looks stale) is **suppressed** for these records:
  pointed at the new location, it would find and delete a live entry belonging to
  an unrelated machine there. This is the destructive path §6.9 exists to close.
- **6.5** The manual-refresh allowance (pinballmap spec 3.2) is traffic-shaping
  toward Pinball Map, not observed location state; a location change does not
  reset it. The validating fetch in 6.2 is human-triggered and spends from that
  same allowance; when none is available, the save leaves the previous
  configuration unchanged and shows the retry countdown.
- **6.6** The switch is atomic with respect to any in-flight sync. A concurrent
  hourly cron or manual Sync now — which reads the location id, fetches, then
  writes the snapshot back under the id it read — must not overwrite the new id
  or store an old-location snapshot under it. A configuration save is the
  authoritative writer for the duration of the change.
- **6.7** _Retired 2026-08-23._ The disabled re-point path was removed:
  clearing the location follows §5, and setting one always validates and
  commits through §6.2. Number kept so older citations do not dangle.
- **6.8** Replacing one configured location with another confirms first, naming
  the consequences in plain terms: the snapshot is replaced by a fresh read of
  the new location, every intent-On machine whose title is not on the new lineup
  will show as Missing (pinballmap spec 4.2) until an operator pushes it there,
  and any intent-Off machine whose title is _already_ on the new lineup will
  show as Lingering (pinballmap spec 4.2). The confirmation is styled to match
  the weight of the action.

## 7. Permissions

- **7.1** Configuring any integration on this page requires the
  manage-integrations capability — an admin-tier grant. The same capability
  gates the whole page (2.2) and every section's save.
- **7.2** This is deliberately a single admin capability, not a per-integration
  one: the page is admin-only, and Pinball Map's finer-grained per-machine
  grants (linking, pushing, refreshing — pinballmap spec §8) gate the machine
  surfaces, not this configuration surface.

---

## Known divergences (code vs spec)

| Spec                                               | Code today                                                                                                                                 | Resolution                                                  |
| :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| §2 one combined page                               | One Discord-only page at `/admin/integrations/discord`; no combined page                                                                   | PP-o355.51.5 and PP-o355.51.6                               |
| §2.3 per-section save                              | Only the Discord form exists, with its own save                                                                                            | PP-o355.51.5 and PP-o355.51.6                               |
| §3.1 Discord credential-entry card                 | The standalone card has per-field validation                                                                                               | PP-o355.51.5                                                |
| §4 Pinball Map section                             | No Pinball Map section anywhere in admin                                                                                                   | PP-o355.51.6                                                |
| §6.2 / §6.5 validate-then-switch through allowance | No location-save path exists                                                                                                               | PP-o355.51.6                                                |
| §6.6 concurrency guard                             | `syncLocationSnapshot` upserts the id it read, no optimistic guard on the singleton                                                        | PP-o355.51.6                                                |
| §6.4 location-scoped abandoned rows                | `pinballmap_abandoned_listings` has no location column; `clearResolvedAbandonments` reconciles every row against whatever lineup is synced | PP-o355.51.6                                                |
| §6.9 suppress cross-location re-mint recovery      | `removeMachineFromPinballMapAction`'s `not_found` path (`classifyRemoveNotFound`) always re-resolves the title against the current lineup  | PP-o355.51.6                                                |
| §6.2 comment re-marking                            | No comment import exists                                                                                                                   | PP-o355.4 (import); permanent mark-on-location-change after |
| §4.2 sync health readout                           | Fields exist on `pinballmap_state`; nothing renders them in admin                                                                          | PP-o355.51.6                                                |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not
logged here.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | Replaced the distinct Pinball Map enable flag with configuration presence: a stored location means configured and clearing it means Not configured. Defined reversible dormant-state retention, shared throttling for location validation, and validate-then-commit behavior for initial configuration, resumption, and location replacement. Clarified that this state governs location tracking, not the separately configured region-alert feature. Updated the Discord section to follow its approved credential-entry spec.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-17 | Created. Combined Admin Integrations page (§2), Discord section preserved (§3), Pinball Map section with enable toggle / editable location / sync health / sync now / link-out (§4–§5), location-change behavior keeping matches and intents (§6), single admin capability (§7). Then, after a §6 review: §2.2 stated admin-only explicitly; §5.1 clarified seeds still set the initial enabled value; §6 rewritten to validate-before-wipe, forbid wrapping the fetch in a transaction (CORE-ARCH-011), keep the abandoned-listing rows (6.4), leave the refresh allowance untouched (6.5), guard against a concurrent sync (6.6), defer the refresh when disabled (6.7), and name both Missing and Lingering in the confirmation (6.8). Then closed a destructive bug the review surfaced: keeping the old rows exposed the entry-removal re-mint recovery, which re-resolves a title against the _current_ lineup and would delete a live entry at the new location — so abandoned records are now location-stamped, reconciled only same-location (6.4), and removed by stored lmx with re-mint recovery suppressed cross-location (6.9). |
