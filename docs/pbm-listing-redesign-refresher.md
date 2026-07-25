# Pinball Map listing + machine edit page — morning refresher

_Written 2026-07-22 night, after three sessions of design work. Read this after compacting._

---

## 1. The thing that changed under us

**PR #1683 merged on 2026-07-21** — the as-built read-side listing control (Connect / Verify / Reconnect, "Not listed" badges, location-page links). Bead **PP-o355.12 is closed** ("Shipped in #1683").

That control is the one we spent these sessions redesigning. So:

- This work is now a **redesign of shipped code**, not a pre-merge rework.
- It needs **its own bead(s)** and a **new branch off current main**.
- The old worktree (`.claude/worktrees/pbm-list-unlist`, branch `feat/pbm-list-unlist-read-PP-o355.12`) is stale — fine for reading artifacts, wrong place to build.

---

## 2. What's wrong with what shipped

Three things, and they're conceptual rather than cosmetic:

1. **Vocabulary collision.** The codebase already uses "link" to mean _catalog match_ (`machines.pinballmap.link`, `PinballMapLinkField`, `status.ts`'s `unlinked`). #1683's UI reused "link/connect" to mean _lmx capture_ — an internal handle users should never think about.
2. **Discover-by-click.** The UI made you press "Connect" to find out what state you were in, when `derivePbmMachineStatus(machine, snapshot)` can derive it server-side from the stored snapshot with no API call.
3. **It lied.** "Not listed" was shown for APC's entire fleet, which _is_ on Pinball Map — we just hadn't captured the handle.

---

## 3. Core principles (settled)

**Derive, don't discover.** Render from `derivePbmMachineStatus(machine, storedSnapshot)` at page load, showing "as of «last sync»". Freshness comes from the hourly sync plus Sync Now (tech/admin). The Verify action is deleted.

**Match is the human judgment; linking is bookkeeping.** Deciding _which game this is_ takes a person. Once that exists, attaching to Pinball Map's lineup entry merely mirrors reality — so linking is **automatic**, and only genuine decisions get UI. This was the insight that unlocked everything else.

**Availability never drives listing.** (The rule behind a previously reverted commit.) Nothing automatic ever lists or unlists based on presence.

---

## 4. Vocabulary (settled)

| Term                   | Means                                                                   | Notes                                                   |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| **Match**              | Which Pinball Map catalog title this machine is                         | Row label is "**Pinball Map title**"                    |
| **Not on Pinball Map** | Catalog can't cover it — homebrews, flipperless (Bordertown, Hyperball) | Chosen **inside the picker's search results**, as built |
| **Listed**             | On APC's lineup                                                         | The state, not a verb                                   |
| **Availability**       | `presenceStatus`                                                        | Independent of the other two                            |
| **lmx**                | Pinball Map's `location_machine_xref` id                                | **Never appears in the UI**                             |

Brand is "**Pinball Map**", two words (PR #1701 fixed this repo-wide).

Retired from the UI: "Connect", "Verify", "Reconnect", "broken link", "Matched to…".

---

## 5. The state machine

Six derived states. **Never stored as a status column** — always computed from (catalog match, `listed`, `lmx`, snapshot).

| State              | Condition                               | What the user sees / does                                       |
| ------------------ | --------------------------------------- | --------------------------------------------------------------- |
| **UNMATCHED**      | `machineId=null, excluded=false`        | "Pinball Map title — _not set_" · **Set title…**                |
| **NOT_ON_PBM**     | `machineId=null, excluded=true`         | Title row shows the reason · **Reopen matching**                |
| **NOT_LISTED**     | matched, `listed=false`, title absent   | "Not on APC's lineup" · **Add to Pinball Map…** (admin)         |
| **LISTED**         | matched, `listed=true`, lmx current     | "Listed on APC's lineup" · **Remove from Pinball Map…** (admin) |
| **MISSING_ON_PBM** | `listed=true`, title absent from lineup | Amber. **Accept** (local) or **Re-add…** (admin)                |
| **UNSYNCED**       | no snapshot yet                         | "Listed (not yet verified against Pinball Map)"                 |

### Key transitions

- **Auto-link (one-way, system):** matched + not listed + title on the lineup → link automatically, at sync time _and_ at title-save time. Writes a timeline receipt. **The whole fleet self-links on the first sync after this ships.** Nothing automatic ever unlists.
- **lmx drift self-heal:** title present under a different lmx → update silently + timeline receipt. Pinball Map soft-deletes lmxes and resurrects the same id within **7 days**, so innocent churn produces no drift at all; real drift means the title was gone 7+ days. **Verified against their source — see §6a.**
- **Accept** (in MISSING_ON_PBM): clears `listed` + `lmx` locally, sends **nothing** to Pinball Map → lands in NOT_LISTED.
- **MISSING_ON_PBM self-resolves** if someone re-adds on Pinball Map within the 7-day window — same lmx returns.

### Invariants

- `listed=true` requires a catalog match (DB CHECK) → any path to "Not on Pinball Map" must unlist first.
- `lmx ≠ null` implies `listed=true` + a match (DB CHECKs).
- Matched **or** excluded, never both (DB CHECK).
- At most one _listed_ machine per catalog title (partial unique index).
- **Changing the title always clears `listed` and `lmx` first** — otherwise "Remove" would act on the wrong Pinball Map entry. Confirm warns that the Pinball Map entry itself is _not_ removed.
- Machine `name` (free text) is independent of the catalog title; changing the title never renames the machine.

---

## 6. Availability × listing matrix (your call, 2026-07-22)

|                   | Listed      | Not listed |
| ----------------- | ----------- | ---------- |
| `on_the_floor`    | valid       | valid      |
| `off_the_floor`   | **advise**  | valid      |
| `on_loan`         | **advise**  | valid      |
| `pending_arrival` | **invalid** | valid      |
| `removed`         | **invalid** | valid      |

- **valid** — silent.
- **advise** — inline nudge with the fixing action beside it.
- **invalid** — **hard flag**: allowed to exist (we never auto-fix, per §3), but rendered as an error and counted in the control room (PP-o355.7).
- "Listed" includes MISSING_ON_PBM (an error variant of Listed). UNMATCHED / NOT_ON_PBM aren't in the matrix — no listing to hold.

---

## 6a. Verified against Pinball Map's source (2026-07-23)

Checked in Tim's local clone at `~/Code/pbm` (HEAD `1d58859`, 2026-07-18). These are no longer assumptions.

**The 7-day resurrection window is real.** `app/controllers/api/v1/location_machine_xrefs_controller.rb:77`, POST create:

```ruby
lmx = LocationMachineXref.unscoped
  .where(["location_id = ? and machine_id = ?", location_id, machine_id])
  .where.not(deleted_at: nil)
  .where(deleted_at: 7.days.ago..Time.current)
  .order(updated_at: :desc).first
if lmx
  lmx.deleted_at = nil   # same row, same id
```

DELETE (line 134) only sets `deleted_at`; the model has `default_scope { where(deleted_at: nil) }`. The same logic exists in the non-API web controller (line 20), so the window holds regardless of how the change was made.

**Consequences we can now rely on:**

- **200 vs 201 discriminates resurrect from new mint.** Resurrecting returns `200`; a brand-new lmx returns `201`. Available if we ever want it — **but we are deliberately not surfacing this** (Tim, 2026-07-23). It's a distinction without a user-visible consequence.
- **A dangling lmx reads as gone, not stale.** `show` uses `find()` under the default scope → `RecordNotFound` → "Failed to find machine". MISSING_ON_PBM can't be fooled by a zombie record.
- **Soft-deleted rows are never purged** (no such rake task in `lib/tasks/`). A dangling lmx id stays dangling permanently and is never recycled onto a different machine — stronger than the spec assumed. A stale lmx can be wrong; it can never point at _someone else's_ game.
- **Their published rate limits are far looser than our self-imposed one-call/hour.** Per API token: index 120/min, destroy 100/5min, update 50/10min, plus a global 120/min in `base_controller`. POST create isn't specifically limited (falls under the global). **Auto-link writes at title-save time carry no rate-limit risk.** We keep the one-sync-call/hour politeness rule anyway (CORE-PBM-001).

Dating caveat: `git log -S` attributes both the window and the rate limits to `b2cbc05` (2026-06-18), but that's "most recent commit that changed the occurrence count", not a true introduction date. Read it as "stable since at least mid-June."

---

## 7. Duplicate titles: guard on **ties**, not duplicates

The guard exists because we can't tell which machine Pinball Map's single entry belongs to. Anything that disambiguates dissolves it.

1. Take all machines sharing the catalog title edition.
2. Drop any whose availability makes Listed **invalid** (`pending_arrival`, `removed`).
3. Of the rest, take the lowest `MACHINE_PRESENCE_RANK` (0 = on the floor … 4 = removed).
4. **Exactly one at that rank** → it holds the listing. No guard; auto-link and auto-heal run.
5. **Two or more tied** → guard fires on the tied machines: automatic syncing pauses for that title, listing actions hidden, alert names the conflict.

**Where the alert surfaces (Tim, 2026-07-23): both places.** An inline banner on each tied machine's own settings page — that's where someone with the power to fix it is standing, and where the hidden Add/Remove actions need explaining — _and_ a row in the control room (PP-o355.7), so a tie can't hide just because nobody happens to open that machine.

Two Labyrinths, one on the floor and one off → no guard. Both on the floor → guard. Resolve by changing one machine's title or marking one "Not on Pinball Map". (Moving one to a different availability also works; we don't advertise it — invites bad data.)

Backstop: the partial unique index already forbids two _listed_ machines sharing a title.

---

## 8. The machine edit page

**The modal becomes a page.** Evidence: the form is **593 lines** with **74** Dialog/AlertDialog/Popover references, and two open beads are symptoms of the strain — **PP-o355.13** (modal closes on click; portalled popover treated as outside-click) and **PP-o355.14** (unsaved-changes guard as a first-class Dialog feature). Both should fall out of this change.

The structural reason, not just size: **a page lets sections have different save models.** Fields belong to Save/Cancel; Pinball Map operations act on a third-party service, can fail, and need to report — which a modal that dismisses on save cannot do.

### Layout

```
Edit «Machine Name»
├─ Details            fields save together
│    Initials         read-only ("can't be changed" — it's a disabled Input today)
│    Name             editable
│    Description      rich text
│    Availability     select
│    [Cancel] [Save details]        ← save bar lives IN this section
│
├─ Pinball Map ↗      (section title is the location link)
│    "last synced today 9:14 AM · Sync now"     ← right-aligned in header
│    "Everything here applies immediately — it isn't part of Save."
│    Pinball Map title — «title» — Stern, 2021 · Change…
│         └─ Change… opens the picker inline with its OWN [Save title]
│    «listing status line + its one action»
│
└─ Danger zone        applies immediately
     Transfer ownership · Change owner…
     Delete machine · Delete machine…
```

### Decisions inside that

- **Listing is a button, not a toggle.** A toggle implies instant/cheap/reversible, but 3 of 4 flips change a public listing and needed a confirm — the confirm fought the idiom. Buttons ("Remove from Pinball Map…") are honest about weight, and the status text carries the state.
- **The title row saves itself**, so nothing in the Pinball Map section rides the Details save.
- **Ownership sits in the Danger zone** — watch this in use; transfers are routine at APC, so a red border may add friction to something ordinary.

---

## 9. Deferred (beads already filed)

- **PP-3bbr** — Model field with a "Use Pinball Map's data" checkbox, so unmatched games (homebrews, flipperless) can have real manufacturer/year. Real work, not UI: today those fields are copied from the catalog and "never trusted from the client". Needs validation + a precedence rule for when a hand-entered model is later matched.
- **PP-5sgt.5** — show model identity + **backbox image** on machine detail (child of the machine-detail epic, which reserves frames for exactly this). Image source/licensing (OPDB likely, since we store `opdbId`) needs settling first.

---

## 10. Still open (small — answerable while building)

1. Do Add / Remove open a **confirm dialog** on top of the "…" button label, or is the label plus "visible to everyone" enough?
2. Does machine detail keep a **lightweight inline rename**, or does every edit route to the page?
3. `on_loan` + Listed — currently "advise". Wasted trip for a player vs. friction of re-listing on return.

---

## 11. Next steps

1. File two beads: **(a)** Pinball Map listing redesign against merged #1683, **(b)** edit modal → page conversion. Probably page first — the listing control's final shape assumes it lives on a page.
2. New branch off **current** `origin/main` (not the stale worktree branch).
3. Implementation notes: rebuild the control from `derivePbmMachineStatus`; `linkPinballmapEntryAction` becomes the auto-link path (sync + title-save); add the local Accept/unlink flag-flip; delete the verify action; `reconcileAfterSync` gains the tie check + timeline receipt.

---

## 12. Housekeeping

- **Artifacts** live in `.claude/worktrees/pbm-list-unlist/.superpowers/brainstorm/*/content/` — canonical ones are `pbm-state-machine-v2.html`, `edit-page-v10.html`, `availability-matrix-v2.html`, `dupe-rank.html`. Restart the viewer with:
  ```
  ~/.claude/plugins/cache/claude-plugins-official/superpowers/6.1.1/skills/brainstorming/scripts/start-server.sh \
    --project-dir /Users/froeht/Code/PinPoint/.claude/worktrees/pbm-list-unlist --idle-timeout-minutes 1440
  ```
  It reuses port 63524, so an open tab reconnects itself. (It auto-exits after idle — that's why it kept dying overnight at the old 4-hour default.)
- **Heads-up from a peer session (PP-nw4k):** `origin/main`'s `pnpm-lock.yaml` has duplicate `@types/node@26.1.1` keys. pnpm rejects it, warns "Ignoring broken lockfile", and re-resolves from scratch — silently downgrading `@supabase/supabase-js`, tiptap and `@sentry/nextjs`, undoing the Dependabot bumps. Suspected cause of E2E `auth.setup` failures in fresh worktrees. **Don't commit lockfile churn you didn't cause.** Worth resolving before starting build work here.
