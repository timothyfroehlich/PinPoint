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
PP-o355.8 (this page), PP-o355.37 (admin enable surface — folded into §5 here),
PP-o355.35 (an earlier proposal to delete the Pinball Map enable flag — §5
supersedes it by keeping the flag and giving it a toggle instead).

---

## 1. Concepts

- **Integration** — a third-party service PinPoint connects to. Two exist:
  **Discord** (bot notifications) and **Pinball Map** (public-lineup sync).
  Each integration owns exactly one section on the page.
- **Section** — one integration's configuration surface on the page. A section
  is self-contained: it reads and writes only its own integration's settings,
  and it saves independently of every other section (§2).
- **Location** — which Pinball Map location PinPoint tracks, named by a numeric
  Pinball Map location id. One location, PinPoint-wide. Everything Pinball Map
  observes — the lineup, the stored snapshot, comment imports — is scoped to
  this location, so changing it invalidates all of that observed state (§6).

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

- **3.1** The Discord section preserves the existing Discord integration
  behavior unchanged: bot token entry and validation, server id entry and
  validation, invite link, and the enable toggle, each with the same fields,
  validation, and copy they have today.
- **3.2** The section links to the Discord help page, as the standalone page
  does today.

## 4. The Pinball Map section

- **4.1** The section shows, and lets an admin edit, the Pinball Map
  integration's PinPoint-wide settings: the enable toggle (§5), the location id
  (§6), and — read-only — the integration's sync health (4.2).
- **4.2** Sync health shows the last successful sync time, the last sync
  _attempt_ time, the last sync outcome (ok / error) with the error text when
  it failed, and the number of machines in the stored lineup snapshot. It is a
  status readout, not an editable field.
- **4.3** The section offers a **Sync now** action that refreshes the stored
  lineup snapshot on demand. It draws from the same global refresh allowance as
  the machine listing control's Refresh (pinballmap spec 3.2) — the two share
  one budget — and disables with a countdown when the allowance is spent.
- **4.4** The section links out to the location's Pinball Map page, using the
  location-specific link-back (pinballmap spec 9.1) rather than a hand-written
  URL.
- **4.5** The section is Pinball Map's _configuration_ surface only. It does not
  show per-machine listing state, the listing control, or fleet-wide Pinball
  Map views — those live on the machine edit page (pinballmap spec §4) and the
  admin fleet dashboard (PP-o355.7).
- **4.6** Per-operator outbound write credentials (the account Pinball Map
  attributes edits to) are **not** configured here — they are per-user and
  belong to a person's own settings, not an admin surface (PP-o355.5 /
  PP-o355.6). This section configures only PinPoint-wide Pinball Map state.

## 5. Enabling and disabling Pinball Map

- **5.1** The enable toggle turns the Pinball Map integration on or off,
  PinPoint-wide. It is the app's surface for changing the enabled state, which
  until now had none. Seeds still set the initial value for local and test
  environments; the toggle is what an admin uses in a running deployment.
- **5.2** Enabling the integration performs an immediate lineup refresh as part
  of enabling, so the machine listing control leaves its disabled Waiting state
  (pinballmap spec 3.5) without anyone pressing Refresh.
- **5.3** Disabling the integration stops the automatic hourly sync. It does not
  clear the stored snapshot, the location id, any machine's match, or any
  machine's listing intent — disabling is reversible and loses no configured
  state.

## 6. Changing the tracked location

Changing the tracked location is a rare, near-never operation — PinPoint tracks
one venue and it does not move. §6 makes it safe and honest rather than
building a workflow around it.

- **6.1** The location id is an editable field. Changing it re-points PinPoint
  at a different Pinball Map location.
- **6.2** Saving a changed location id runs as an ordered sequence, **not one
  transaction** — the refresh is a Pinball Map fetch and an external effect
  never runs inside a DB transaction (CORE-ARCH-011):
  - **Validate first.** PinPoint fetches the new location from Pinball Map
    before changing any stored state. A successful fetch is what makes the id
    valid; a failed fetch — unknown id, network or auth error — aborts the
    whole change with nothing wiped and the old location still tracked. A
    location with zero machines is valid (a legitimately empty venue) and
    proceeds.
  - **Then commit the switch.** In one transaction: store the new id, replace
    the stored lineup snapshot with the freshly fetched one, and set the
    sync-health fields (4.2) to reflect that fetch. The old location's observed
    state is gone only because it has been replaced, never left half-cleared.
  - Previously imported condition comments are marked as belonging to a
    previous listing, **permanently**. A location change is not a Pinball Map
    removal, so the 7-day restoration window (pinballmap spec 7.2, 7.3) does
    not apply and the comments are never unmarked. This is a no-op until comment
    import exists (PP-o355.4).
- **6.3** Changing the location id **keeps** every machine's catalog match and
  every machine's listing intent. A match is a catalog-title identity, not a
  location fact; intent is a deliberate operator decision. Neither is discarded
  by moving locations.
- **6.4** An abandoned-listing record belongs to the Pinball Map location it was
  recorded at, and it is **kept** across a location change so the old location's
  orphans can still be cleaned up (§6 opening). A kept record for a location
  PinPoint no longer tracks is **never reconciled against the current lineup** —
  not by the change's own refresh and not by any later sync. Its lmx is absent
  from a different location's lineup by definition, and the reconcile pass reads
  that absence as "the operator removed it" (pinballmap spec 2.5), which would
  silently delete every old record and report a cleanup nobody performed
  (CORE-ARCH-012). Requires stamping each record with its location; see the
  divergence table. The stamp comes from the snapshot the lmx was read from, not
  from the row's `location_id` — after a disabled re-point (6.7), the two
  describe different venues, and stamping from the id would label an old-venue
  lmx with the new location, breaking the cross-location guard in 6.9.
- **6.4a** A kept cross-location record stays visible on the machine's pages and
  links to the record's own venue. The same-title hiding filter (pinballmap spec
  2.5) applies only to records from the tracked location.
- **6.9** Removing an abandoned entry whose location PinPoint no longer tracks
  fires the **stored lmx only** and never re-resolves the machine's title against
  any lineup. An lmx is globally unique on Pinball Map, so the direct remove
  takes down the correct old-location entry; a Pinball Map `not_found` is treated
  as already-gone and the record is dropped. The re-mint recovery that a
  same-location removal uses (pinballmap spec — re-resolve the title against the
  live lineup when the handle looks stale) is **suppressed** for these records:
  pointed at the new location, it would find and delete a live entry belonging to
  an unrelated machine there. This is the destructive path §6.9 exists to close.
- **6.5** The refresh allowance (pinballmap spec 3.2) is a single rate limit
  shared by all Pinball Map fetches — manual refreshes, cron syncs, enable
  refreshes, and location-change validation. A location change does not reset
  it.
- **6.6** The switch is atomic with respect to any in-flight sync. A concurrent
  hourly cron or manual Sync now — which reads the location id, fetches, then
  writes the snapshot back under the id it read — must not overwrite the new id
  or store an old-location snapshot under it. The save is the authoritative
  writer for the duration of the change.
- **6.7** Changing the location while disabled changes the id but does not
  fetch. The stored snapshot and sync health (`last_synced_at`, status, error)
  are cleared — a snapshot from the old venue is not valid for the new one. The
  next enable's refresh (5.2) fills them in.
- **6.8** Saving a changed location id confirms first, naming the consequences
  in plain terms: the snapshot is replaced by a fresh read of the new location,
  every intent-On machine whose title is not on the new lineup will show as
  Missing (pinballmap spec 4.2) until an operator pushes it there, and any
  intent-Off machine whose title is _already_ on the new lineup will show as
  Lingering (pinballmap spec 4.2). The confirmation is styled to match the
  weight of the action.

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

| Spec                                          | Code today                                                                                                                                 | Resolution                                                                                                                                                                                   |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2 one combined page                          | One Discord-only page at `/admin/integrations/discord`; no combined page                                                                   | Build in PP-o355.8; rename route, update nav                                                                                                                                                 |
| §2.3 per-section save                         | Only the Discord form exists, with its own save                                                                                            | Preserve Discord's save; give PBM its own                                                                                                                                                    |
| §4 Pinball Map section                        | No Pinball Map section anywhere in admin                                                                                                   | Build in PP-o355.8                                                                                                                                                                           |
| §5.1 enable toggle                            | `pinballmap_state.enabled` has no UI — set by hand or seed                                                                                 | Build the toggle (folds in PP-o355.37)                                                                                                                                                       |
| §5.2 enable triggers refresh                  | No enable surface exists to trigger from                                                                                                   | PP-o355.37, folded into PP-o355.8                                                                                                                                                            |
| §6.1 editable location id                     | Location is a DB column defaulting to 26454 plus a hardcoded `APC_LOCATION_ID`                                                             | Make editable; retire the constant — thread `state.locationId` through `pinballmapLocationUrl()` at **every** call site (machine pages, not just admin) or attribution breaks (CORE-PBM-001) |
| §6.2 validate-then-switch                     | No path re-reads / replaces the snapshot on an id change                                                                                   | Build in PP-o355.8 (fetch-validate before commit)                                                                                                                                            |
| §6.6 concurrency guard                        | `syncLocationSnapshot` upserts the id it read, no optimistic guard on the singleton                                                        | Add a guard so a mid-change sync can't clobber the new id                                                                                                                                    |
| §6.4 location-scoped abandoned rows           | `pinballmap_abandoned_listings` has no location column; `clearResolvedAbandonments` reconciles every row against whatever lineup is synced | Stamp each row with its location; reconcile only same-location rows                                                                                                                          |
| §6.9 suppress cross-location re-mint recovery | `removeMachineFromPinballMapAction`'s `not_found` path (`classifyRemoveNotFound`) always re-resolves the title against the current lineup  | Skip the re-mint recovery for a record whose location ≠ the tracked one (destructive: removes a live new-location entry)                                                                     |
| §6.2 comment re-marking                       | No comment import exists                                                                                                                   | PP-o355.4 (import); permanent mark-on-location-change after                                                                                                                                  |
| §4.2 sync health readout                      | Fields exist on `pinballmap_state`; nothing renders them in admin                                                                          | Build in PP-o355.8                                                                                                                                                                           |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not
logged here.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-19 | §6.7 reversed — disabled re-point now clears the snapshot and health instead of leaving them (stale data caused downstream readers to act on the wrong venue, including a destructive entry-removal path). Added §6.4 stamp-source rule, §6.4a cross-location visibility, §6.5 single rate limit for all fetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-17 | Created. Combined Admin Integrations page (§2), Discord section preserved (§3), Pinball Map section with enable toggle / editable location / sync health / sync now / link-out (§4–§5), location-change behavior keeping matches and intents (§6), single admin capability (§7). Then, after a §6 review: §2.2 stated admin-only explicitly; §5.1 clarified seeds still set the initial enabled value; §6 rewritten to validate-before-wipe, forbid wrapping the fetch in a transaction (CORE-ARCH-011), keep the abandoned-listing rows (6.4), leave the refresh allowance untouched (6.5), guard against a concurrent sync (6.6), defer the refresh when disabled (6.7), and name both Missing and Lingering in the confirmation (6.8). Then closed a destructive bug the review surfaced: keeping the old rows exposed the entry-removal re-mint recovery, which re-resolves a title against the _current_ lineup and would delete a live entry at the new location — so abandoned records are now location-stamped, reconciled only same-location (6.4), and removed by stored lmx with re-mint recovery suppressed cross-location (6.9). |
