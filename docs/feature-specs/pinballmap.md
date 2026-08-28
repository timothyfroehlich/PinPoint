# Pinball Map Integration — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Pinball Map
integration: what the system does and what users can do. No implementation
detail — design records and code carry that. It describes the intended final
state only; what the code does or used to do lives solely in the Known
divergences table. Each requirement is numbered for citation. When code and
spec disagree, either the code is wrong or this document gets amended — never
silently neither.

**Related records.** `docs/pbm-listing-redesign-refresher.md`,
`docs/feature-specs/admin-integrations.md`.

---

## 1. Concepts

Six independent facts. No one of them ever implies another.

- **Match** — which Pinball Map catalog title this machine is, if any. A
  human judgment, per machine.
- **Uncataloged game** — a game Pinball Map's catalog does not carry: a
  homebrew, a flipperless game, or a title too old or obscure for their
  catalog. Declared by a person, mutually exclusive with a match. Carries
  its own hand-entered model identity (§2.4) — the "manual model". Not
  listable.
- **Listing intent** — whether this machine should appear on the location's
  public Pinball Map lineup. An operator decision, per machine, owned by
  PinPoint, expressed as a tri-state: **On the lineup / Off the lineup /
  Don't sync** (the third position is sync participation, below).
- **Lineup** — what Pinball Map currently shows for the location: which
  titles, and each entry's condition comments. An observed external fact,
  per title — Pinball Map shows at most one entry per title per location.
- **Coverage** — a lineup entry is _covered_ when at least one same-title
  cabinet has intent On. There is no claiming and no single holder: every
  intent-On cabinet relates to the entry equally, and comments fan out to
  all of them (§7.1). Which cabinets cover a title is decided entirely by
  their intent toggles. _(Replaced the former "holding/claiming" concept,
  2026-08-15.)_
- **Availability** — where the machine physically is (on the floor, on loan,
  removed, …). Never drives listing intent or the lineup automatically.

**Sync participation** is the intent tri-state's third position: a machine
set to Don't sync is exempt from alerts, reconciliation, and comment import — but its observed status stays visible, because
the location-level refresh keeps recording the lineup while Pinball Map is
configured.
Uncataloged and unmatched machines never participate.

**Tracked location** is which Pinball Map location PinPoint watches — a numeric
Pinball Map location id, zero or one PinPoint-wide. A stored location means
**configured**; no stored location means **Not configured** (§10.5). Everything
Pinball Map observes (the lineup, the stored snapshot, comment imports) is
scoped to the configured location, so replacing it invalidates that observed
state (§10).

The control's states (§4) are comparisons across these: _in sync_ means
intent agrees with the lineup; _out of sync_ means they disagree.

## 2. Catalog matching

- **2.1** A machine may be matched to a Pinball Map catalog title, declared
  uncataloged, or left unmatched. Matched and uncataloged are mutually
  exclusive.
- **2.2** Matching is done by a person (or an explicit tool call) — never
  guessed by the system.
- **2.3** Changing or clearing a machine's matched title resets its listing
  intent to Off (a Don't-sync setting is kept), with a confirmation that
  says the old Pinball Map entry itself is not removed.
- **2.4** An uncataloged machine can carry a hand-entered model identity
  (title, manufacturer, year) — the manual model. Title defaults to the
  machine's name.
- **2.5** Cleaning up the old entry after a re-match is deliberately a
  separate action, never a side effect of changing the match. The orphaned
  entry may stay on the lineup as long as the operator wants. While any
  cabinet is still matched to the old title, the entry is that title's
  ordinary business and surfaces through those cabinets' own states (§4).
  When none is, PinPoint remembers which machine walked away and surfaces
  the entry on that machine's page, with the same removal action and
  matching copy. Listing the machine under its new title is likewise the
  standard flow — two actions, taken independently.

## 3. Reading from Pinball Map

- **3.1** While configured, PinPoint reads the location's lineup on a schedule
  (hourly) and stores what it saw, including each entry's condition comments.
  While Not configured, PinPoint makes no location-tracking Pinball Map API
  calls. The separately configured region-alert feature is independent and
  follows its own spec.
- **3.2** A person can refresh at any time from the control's header while the
  integration is configured. Refreshes and location-validation reads draw from
  one shared burst allowance (a few back-to-back, then one every few minutes)
  so the sustained rate stays inside the committed hourly cap. The allowance
  is global, not per-user. The header always shows when the lineup was last
  refreshed, and the button disables with a countdown when the allowance is
  spent.
- **3.3** PinPoint never writes to Pinball Map on its own. Every outbound
  write is an explicit human action.
- **3.4** The UI renders from stored data. Opening a page never triggers a
  call to Pinball Map, and no control requires a click to discover its own
  state.
- **3.5** While configured but before a valid snapshot exists, the control is
  in the **Waiting** state and renders disabled — no interactive element acts
  against unknown data. Successfully setting the location supplies a valid
  snapshot; otherwise the hourly refresh and the header's manual Refresh are
  the paths out. Waiting may persist while attempts fail, and the header stays
  live with an error marker and Refresh as the escape hatch.

## 4. The listing control

- **4.1** The control is two rows under one header, and **renders at the
  same fixed height in every state** — states swap content, never geometry.
  - **Intent row**: the tri-state toggle (On the lineup / Off the lineup /
    Don't sync). Changing it writes only to PinPoint, needs no
    confirmation, and is instantly reversible.
  - **Status row**: the observed lineup fact as a short sentence, with
    reconciliation actions on the right.
  - **Header**: "Pinball Map — {location name}", the name taken from their
    location entry and linked to the location's Pinball Map page (this link
    doubles as the 9.1 attribution link-back); last-refresh time and a
    Refresh button (3.2); an **Out of sync** alert when intent and lineup
    disagree. Before the first refresh the location name is unknown and the
    title is bare.
- **4.2** State names (canonical):
  - **No model / Uncataloged** — disabled box, status says why.
  - **Not configured** — no tracked location; disabled box, no Refresh or
    location link, and no retained snapshot rendered as current.
  - **Waiting** — no valid refresh yet (3.5); disabled box, header error
    marker.
  - **Sync off** — Don't sync selected; observed status still shown, no
    alerts.
  - **On / Off** — intent matches the lineup; quiet, no buttons.
  - **Blocked** — the toggle's On position disabled by availability (6.2),
    reason stated beside it.
  - **Alert** — intent On but availability invalid (6.2): the warning icon
    replaces the status icon, with an alert beside the toggle. Allowed,
    never auto-fixed. _(Named "Flag" until 2026-08-16.)_
  - **Flag** — intent On with an advise-tier availability (on loan / off
    the floor): the in-sync presentation plus a quiet note suggesting
    removal from the lineup for absences longer than a week (6.5).
  - **Missing** — intent On, entry absent. Out of sync.
  - **Lingering** — intent Off (on every same-title cabinet), entry
    present. Out of sync. One state regardless of cabinet count.
  - **Shared / Covered** — same-title coverage states (4.7).
- **4.3** In an out-of-sync state with operator credentials, the status row
  offers a push action that makes the lineup match the intent, labeled with
  Pinball Map's own verbs (**Add machine to Pinball Map / Remove machine
  from Pinball Map**). Removing does not require the entry to be covered —
  an abandoned entry can be removed.
- **4.4** Without credentials, the status row states what to change and
  links directly to the location's Pinball Map page ("…then Refresh to
  update"). It never shows a control that cannot perform its action.
- **4.5** Pushes confirm before acting, naming the game and the public
  consequence. The remove direction is styled destructive.
- **4.6** The remove confirmation shows the entry's comment count and states
  the consequence accurately: recoverable only by re-adding the game within
  Pinball Map's 7-day window (7.2), permanently lost after. If the stored
  lineup is over 5 minutes old, a fresh refresh runs and confirmation is
  blocked until the current count shows; if it fails, the last-known count
  and its age are shown and the person may proceed or cancel.
- **4.7** Same-title cabinets: every intent-On cabinet shows the entry as
  its own (**Shared**, naming the others); an intent-Off cabinet whose
  siblings cover the entry shows **Covered**, quiet, with the covering
  cabinets linked. Sibling names always link to their machine pages.
- **4.8** User-facing vocabulary: "listing" never appears — the object is an
  "entry", the set is the "lineup" (Pinball Map's word), comments are
  "comments", the read is "Refresh". "Sync" survives only in the
  relationship senses (Don't sync, Out of sync).
- **4.9** A viewer without the machine-linking capability — machine owner,
  technician, or admin (8.1) — sees the header and both rows, never the
  status row's push actions; the toggle renders read-only. The header
  Refresh stays available to them (8.3).

## 5. Automatic behavior

- **5.1** **PinPoint never changes listing intent automatically, in either
  direction.** Every out-of-sync state persists until a person resolves it
  with the toggle or a push. _(2026-08-16: the earlier lone-candidate
  auto-set died here — with intent a genuine operator decision, an
  automatic flip could silently override a deliberate Off.)_
- **5.2** If Pinball Map's internal handle for an entry changes but the
  entry is otherwise the same, PinPoint repairs its record silently — this
  touches bookkeeping, never intent.
- **5.3** Machines set to Don't sync are exempt from repair and imports; the
  location-level refresh itself always runs while the integration is
  configured.

## 6. Availability interplay

- **6.1** Availability never changes listing intent, and intent never
  changes availability.
- **6.2** The two directions into an invalid combination are treated
  differently:
  - **Intent side blocked** — the toggle's On position is disabled while
    availability is pending arrival or removed, with the reason beside it
    ("Current Availability (Removed) disallows adding to the lineup").
  - **Availability side allowed** — changing availability never forces a
    removal. An intent-On machine moved to pending arrival or removed keeps
    its intent; the state is the **Alert** state (4.2): error-styled,
    counted, never auto-fixed.

| Availability    | Intent On | Intent Off |
| :-------------- | :-------- | :--------- |
| On the floor    | valid     | valid      |
| Off the floor   | advise    | valid      |
| On loan         | advise    | valid      |
| Pending arrival | invalid   | valid      |
| Removed         | invalid   | valid      |

- **6.3** An uncovered entry whose every same-title cabinet is ineligible
  renders as Lingering with the toggle blocked — removal (or fixing
  Availability) is the offered resolution.
- **6.4** _Retired 2026-08-16._ The availability-ranked candidate ordering
  existed only to pick a cabinet for the automatic intent-set, which 5.1
  now forbids. Number kept so older citations don't dangle.
- **6.5** Advise-tier combinations (intent On while on loan or off the
  floor) render the **Flag** state: the in-sync presentation plus a quiet
  note advising removal from the lineup when the machine will be away for
  more than a week. Never blocks, never alarms.
- **6.6** External fact (reported directly by Ryan, Pinball Map admin,
  2026-08-16): Pinball Map's admins run a script that finds and removes
  lineup entries carrying a "Coming soon" comment — entries for games that
  are not present get cleaned up on their side. Context for 6.2's block and
  6.5's note.

## 7. Condition comments

- **7.1** Condition comments on a covered entry are imported into the
  timeline of **every intent-On cabinet** of that title, deduplicated, and
  attributed — a shared entry's comments cannot be attributed to one
  cabinet, so all covering cabinets receive them. Machines set to Don't
  sync do not receive imports. In user-facing copy they are simply
  "comments".
- **7.2** External fact (verified against Pinball Map's source, 2026-08-15):
  removing a lineup entry hides it rather than deleting it. Re-adding the
  same game at the same location within **7 days** restores the identical
  entry with all its condition comments. After 7 days the entry can no
  longer be restored and its comment history is permanently inaccessible,
  though never literally deleted. The window is hardcoded on their side and
  may change; re-verify before relying on the number.
- **7.3** Previously imported comments are marked as belonging to a previous
  listing only when the old entry is gone for good. A restoration within
  Pinball Map's window is the same listing resumed — its comments are not
  marked, or are unmarked if the entry comes back.

## 8. Permissions

- **8.1** Setting intent (any toggle position) requires the machine-linking
  capability: machine owner, technician, or admin.
- **8.2** Pushing to Pinball Map requires the machine-linking capability
  (8.1) plus provisioned operator credentials. Pinball Map itself is publicly editable,
  so gating writes tighter than PinPoint's own bookkeeping buys nothing.
  Absent credentials, push buttons are not shown.
- **8.3** Reading status and the header Refresh require only page access
  (refreshes stay throttled regardless of who clicks, 3.2).

## 9. Conduct toward Pinball Map

- **9.1** All access uses their documented API, with attribution and a
  link back to the specific location page wherever their data is rendered.
- **9.2** Automated reads are limited to the hourly sync; human-triggered
  refreshes are throttled. PinPoint backs off when asked.
- **9.3** These are commitments to another community's service, not internal
  preferences. See `docs/NON_NEGOTIABLES.md` (CORE-PBM-001).

## 10. Admin configuration

The Pinball Map section of the Admin Integrations page
(`docs/feature-specs/admin-integrations.md`) configures the integration's
PinPoint-wide state: the tracked location (§1), its sync health, and an
on-demand refresh. It is a configuration surface only — it does not show
per-machine listing state or the listing control (those live on the machine
surfaces, §4), or fleet-wide Pinball Map views (those live on the admin fleet
dashboard). The region-alert channel that shares the section is its own feature
(`docs/feature-specs/pinballmap-region-alerts.md`).

### The section

- **10.1** The section shows, and lets an admin edit, the integration's
  PinPoint-wide settings: the location id (§10.5–§10.8) and — read-only — the
  sync health (§10.2). It has no enable toggle.
- **10.2** Sync health shows the last successful sync time, the last sync
  _attempt_ time, the last outcome (ok / error) with the error text on failure,
  and the machine count in the stored snapshot. A status readout, not an
  editable field. With no configured location it shows **Not configured**;
  retained health is not presented as current.
- **10.3** A **Sync now** action refreshes the stored snapshot on demand while
  configured. It draws from the same global allowance as the machine control's
  Refresh and location validation (§3.2) — all three share one budget — and
  disables with a countdown when the allowance is spent. While Not configured it
  is unavailable and the section states a location must be saved first.
- **10.4** While configured, the section links to the location's Pinball Map
  page using the location-specific link-back (§9.1), never a hand-written URL.
  It renders no location link while Not configured.

### Configuration state

- **10.5** Pinball Map is **configured** when a location id is stored and **Not
  configured** when it is absent. There is no enable flag. The location id is an
  optional editable field — setting it configures the integration, clearing it
  makes it Not configured (§10.7).
- **10.6** While Not configured, PinPoint makes no location-tracking Pinball Map
  API calls and does not render or reconcile retained observed state as current;
  admin and machine surfaces show Not configured (the machine control's Not
  configured state, §4.2 — distinct from Waiting, which is a configured
  integration still lacking a valid snapshot, §3.5). The separately configured
  region-alert feature is unaffected and follows its own spec.
- **10.7** Clearing the location requires confirmation that automatic and manual
  refreshes will stop. It retains the last snapshot and sync health, every
  machine's catalog match and listing intent, imported comments, and
  location-stamped abandoned-entry records; turning the integration off this way
  is reversible and manufactures no external change.
- **10.8** Setting a location while Not configured follows the validate-then-
  commit sequence in §10.9. Setting the previously tracked location resumes
  tracking without treating its entries as having disappeared; setting a
  different location applies the change consequences below.

### Changing the tracked location

Replacing the tracked location is a rare, near-never operation — PinPoint tracks
at most one venue and it does not move. These rules make replacement safe and
honest rather than building a workflow around it.

- **10.9 Validate, then commit.** Saving a non-empty location id runs as an
  ordered sequence, **not one transaction** — the validation is a Pinball Map
  fetch and an external effect never runs inside a DB transaction
  (CORE-ARCH-011):
  - **Validate first.** PinPoint fetches the new location before changing any
    stored state, using the shared allowance (§3.2, §10.13). A successful fetch
    is what makes the id valid; a failed or throttled attempt — unknown id,
    network or auth error, or no token currently available — aborts the whole
    change with nothing wiped and the previous configuration unchanged. A
    location with zero machines is valid (a legitimately empty venue) and
    proceeds.
  - **Then commit the switch.** In one transaction: store the new id, replace
    the stored snapshot with the freshly fetched one, and set the sync-health
    fields (§10.2) to reflect that fetch. The old location's observed state is
    gone only because it has been replaced, never left half-cleared.
  - Previously imported condition comments are marked as belonging to a previous
    listing, **permanently**, only when the newly validated location differs
    from the previously tracked one. Initial configuration and resuming the same
    location do not mark comments. A location change is not a Pinball Map
    removal, so the 7-day restoration window (§7.2, §7.3) does not apply and the
    comments are never unmarked. A no-op until comment import exists.
- **10.10** Replacing one configured location with another **keeps** every
  machine's catalog match and every machine's listing intent. A match is a
  catalog-title identity, not a location fact; intent is a deliberate operator
  decision. Neither is discarded by moving locations.
- **10.11** An abandoned-listing record belongs to the Pinball Map location it
  was recorded at and is **kept** across a location change, so the old
  location's orphans can still be cleaned up. A kept record for a location
  PinPoint no longer tracks is **never reconciled against the current lineup** —
  not by the change's own refresh and not by any later sync. Its lmx is absent
  from a different location's lineup by definition, and the reconcile pass would
  read that absence as "the operator removed it" (§2.5), silently deleting every
  old record and reporting a cleanup nobody performed (CORE-ARCH-012). Each
  record is stamped with its location; only same-location records reconcile.
- **10.12** Removing an abandoned entry whose location PinPoint no longer tracks
  fires the **stored lmx only** and never re-resolves the machine's title
  against any lineup. An lmx is globally unique on Pinball Map, so the direct
  remove takes down the correct old-location entry; a Pinball Map `not_found` is
  treated as already-gone and the record is dropped. The re-mint recovery a
  same-location removal uses — re-resolving the title against the live lineup
  when the stored handle looks stale — is **suppressed** for these records:
  pointed at the new location it would find and delete a live entry belonging to
  an unrelated machine there. This is the destructive path §10.12 exists to
  close.
- **10.13** The shared allowance (§3.2) is traffic-shaping toward Pinball Map,
  not observed location state; a location change does not reset it. The
  validating fetch in §10.9 is human-triggered and spends from that same
  allowance; when none is available, the save leaves the previous configuration
  unchanged and shows the retry countdown.
- **10.14** The switch is atomic with respect to any in-flight sync. A
  concurrent hourly cron or Sync now — which reads the location id, fetches,
  then writes the snapshot back under the id it read — must not overwrite the new
  id or store an old-location snapshot under it. A configuration save is the
  authoritative writer for the duration of the change.
- **10.15** Replacing one configured location with another confirms first,
  naming the consequences in plain terms: the snapshot is replaced by a fresh
  read of the new location; every intent-On machine whose title is not on the
  new lineup shows as **Missing** (§4.2) until an operator pushes it there; any
  intent-Off machine whose title is already on the new lineup shows as
  **Lingering** (§4.2). The confirmation is styled to match the weight of the
  action.

### Permissions

- **10.16** Configuring the Pinball Map integration — the location and every
  action in this section — requires the manage-integrations capability
  (admin-integrations spec §7), the admin-tier grant that gates the page,
  distinct from the per-machine machine-linking capability (§8) that gates the
  machine surfaces.

---

## Known divergences (code vs spec)

| Spec                                                | Code today                                                                                                                                                                                                                                                                                                       | Resolution                                                  |
| :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| 7.1 comment fan-out                                 | No comment import exists                                                                                                                                                                                                                                                                                         | PP-o355.4 (reshape to fan-out); PP-o355.36 depends on it    |
| 4.9 read-only viewer                                | No surface reaches it — the only page carrying the control is the Manage tab, which gates on `machines.edit`                                                                                                                                                                                                     | PP-o355.38                                                  |
| 2.4 uncataloged / manual model                      | Fields exist; the surface for them is not what it should be                                                                                                                                                                                                                                                      | PP-3bbr                                                     |
| 7.3 comment marking on removal                      | Not implemented                                                                                                                                                                                                                                                                                                  | PP-o355.36                                                  |
| §10 admin section (whole surface)                   | No Pinball Map admin section exists — `src/app/(app)/admin/integrations/` has only the standalone Discord route. The section itself and every action in it — the location field, Sync now (§10.3), link-out (§10.4), clearing (§10.7), and the validate/commit + confirmation flow (§10.9, §10.15) — are unbuilt | PP-o355.51.6                                                |
| 10.2 sync-health readout                            | Fields exist on `pinballmap_state`; nothing renders them in admin                                                                                                                                                                                                                                                | PP-o355.51.6                                                |
| 10.9 / 10.13 validate-then-switch through allowance | No location-save path exists                                                                                                                                                                                                                                                                                     | PP-o355.51.6                                                |
| 10.9 comment re-marking on location change          | No comment import exists                                                                                                                                                                                                                                                                                         | PP-o355.4 (import); permanent mark-on-location-change after |
| 10.11 location-scoped abandoned rows                | `pinballmap_abandoned_listings` has no location column; `clearResolvedAbandonments` reconciles every row against whatever lineup is synced                                                                                                                                                                       | PP-o355.51.6                                                |
| 10.12 suppress cross-location re-mint recovery      | `removeMachineFromPinballMapAction`'s `not_found` path (`classifyRemoveNotFound`) always re-resolves the title against the current lineup                                                                                                                                                                        | PP-o355.51.6                                                |
| 10.14 concurrency guard                             | `syncLocationSnapshot` upserts the id it read, no optimistic guard on the singleton                                                                                                                                                                                                                              | PP-o355.51.6                                                |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not
logged here.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-27 | Added §10 (admin configuration): the Pinball Map section's behavior moved here from the Admin Integrations spec when that spec was slimmed to a page shell (PP-o355.51.8) — the section and its sync-health readout / Sync now (was admin §4), the configuration-presence state model (was admin §5), and the location-change safety rules (was admin §6). Added the tracked-location concept (§1). No behavior changed; this is a relocation, and the on/off model is unchanged (configuration presence, not an enable flag). |
| 2026-08-23 | Replaced the distinct integration enable flag with configuration presence: a stored location means configured and no location means Not configured. Defined the dormant-state behavior, made all human-triggered lineup reads share the refresh allowance, and rewrote Waiting so it lasts until a valid snapshot arrives. Clarified that this state governs location tracking, not the separately configured region-alert feature.                                                                                            |
| 2026-08-16 | Added spec status and this changelog. Removed the `[shipped]`/`[designed]` tags — the divergence table is the only record of what is built, gaining rows for 3.2, 6.5 and 8.3 — and the code-state commentary in Related records. Amended 2.5 (an orphaned entry surfaces on the machine that walked away only when no cabinet still carries the old title), 4.9 (read-only viewers keep the header Refresh) and 8.2 (names the machine-linking capability rather than citing 8.1 bare).                                       |
| 2026-08-15 | Created, recording the two-line intent/status control: coverage replaces holding/claiming (§1), no automatic intent (5.1), Alert and Flag (4.2, 6.5), vocabulary purge (4.8).                                                                                                                                                                                                                                                                                                                                                  |
