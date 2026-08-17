# Pinball Map Integration — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint's Pinball Map
integration: what the system does and what users can do. No implementation
detail — design records and code carry that. It describes the intended final
state only; what the code does or used to do lives solely in the Known
divergences table. Each requirement is numbered for citation. When code and
spec disagree, either the code is wrong or this document gets amended — never
silently neither.

**Related records.** `docs/pbm-listing-redesign-refresher.md`, PP-o355 (epic),
PP-3bbr (uncataloged games / manual model), PP-o355.36 (timeline comments
after removal).

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
the location-level refresh keeps recording the lineup regardless.
Uncataloged and unmatched machines never participate.

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

- **3.1** PinPoint reads the location's lineup on a schedule (hourly) and
  stores what it saw, including each entry's condition comments.
- **3.2** A person can refresh at any time from the control's header;
  refreshes draw from a small shared burst allowance (a few back-to-back,
  then one every few minutes) so the sustained rate stays inside the
  committed hourly cap. The allowance is global, not per-user. The header
  always shows when the lineup was last refreshed, and the button disables
  with a countdown when the allowance is spent.
- **3.3** PinPoint never writes to Pinball Map on its own. Every outbound
  write is an explicit human action.
- **3.4** The UI renders from stored data. Opening a page never triggers a
  call to Pinball Map, and no control requires a click to discover its own
  state.
- **3.5** Until a valid refresh exists, the control renders disabled — no
  interactive element against unknown data. Enabling the integration
  triggers a refresh as part of enabling, so this state is momentary; the
  header stays live with an error marker and the Refresh button as the
  escape hatch.

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
  location-level refresh itself always runs.

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

---

## Known divergences (code vs spec)

| Spec                           | Code today                                                                                                   | Resolution                                               |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| 7.1 comment fan-out            | No comment import exists                                                                                     | PP-o355.4 (reshape to fan-out); PP-o355.36 depends on it |
| 3.5 enable triggers a refresh  | No enable surface exists to trigger from                                                                     | PP-o355.37 (admin enable surface)                        |
| 4.9 read-only viewer           | No surface reaches it — the only page carrying the control is the Manage tab, which gates on `machines.edit` | PP-o355.38                                               |
| 2.4 uncataloged / manual model | Fields exist; the surface for them is not what it should be                                                  | PP-3bbr                                                  |
| 7.3 comment marking on removal | Not implemented                                                                                              | PP-o355.36                                               |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not
logged here.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-16 | Added spec status and this changelog. Removed the `[shipped]`/`[designed]` tags — the divergence table is the only record of what is built, gaining rows for 3.2, 6.5 and 8.3 — and the code-state commentary in Related records. Amended 2.5 (an orphaned entry surfaces on the machine that walked away only when no cabinet still carries the old title), 4.9 (read-only viewers keep the header Refresh) and 8.2 (names the machine-linking capability rather than citing 8.1 bare). |
| 2026-08-15 | Created, recording the two-line intent/status control: coverage replaces holding/claiming (§1), no automatic intent (5.1), Alert and Flag (4.2, 6.5), vocabulary purge (4.8).                                                                                                                                                                                                                                                                                                            |
