# Machine Detail — Info & Service Tab Redesign

**Date:** 2026-06-19
**Branch:** `worktree-machine-home-redo`
**Status:** Design approved (brainstorm complete) — not yet implemented
**Related beads:** `PP-0kta` (issues filter bar — **reframed** by this design), `PP-43q3` (Settings tab — assumed shipping)
**Mockups:** `./mockups/{info,service}-{desktop,mobile}.html` (open in a browser; the translite + QR images load live from OPDB / api.qrserver.com)

---

## 1. Summary

The machine detail page (`/m/[initials]`) is a **Tabbed Detail Page** (design-bible §5): a persistent identity header + URL-driven tab strip (Info / Settings / Service / Timeline) over shared `cache()`-wrapped data (`_data.ts:getMachineForLayout`). This redesign reworks the **Info** and **Service** tab bodies (and enriches the shared header). Timeline and Settings tabs are out of scope.

The driving problems: the old Info tab wasted vertical space (a thick "recent activity" block, a redundant details grid), and the Info ↔ Service split had no clear owner-vs-player framing. PinballMap metadata (manufacturer / year / edition / backbox art) and machine **Tags** (a future Collections feature) also needed a home.

**Sequencing principle — the home redesign ships first.** This redesign does **not** block on PinballMap, Settings, or Collections. It ships standalone and **leaves reserved frames** that those efforts fill in as they land: the mfr/year/edition sub-line, the translite block, and the PinballMap card are all rendered as graceful empty/placeholder states that populate when PBM data exists; the Settings tab simply appears in the strip when `PP-43q3` ships; the Tags card is a static placeholder until Collections exists. Nothing here waits on anything else — later work fills gaps, it doesn't gate this.

**The reframe — audience-first:**

- **Info tab = the QR-scanning player's landing.** Someone standing at the machine scans a QR sticker and lands here. Their job: confirm the game, see if it's healthy, and report a problem. So Info leads with identity + a big **Report a problem** button.
- **Service tab = the maintainer's workbench.** Techs/owners triaging issues, reading maintenance history, adjusting presence, printing the QR sticker, exporting.

Every layout decision below follows from that split.

---

## 2. Shared header (both tabs, all breakpoints)

The persistent header is **enriched** beyond today's `MachineDetailHeader` (which renders only a small mono initials pill + name):

- **Identity cluster:** green `GZ` initials chip + bold machine name + a **`Stern · 2021 · Premium`** sub-line (manufacturer · year · edition). This sub-line is the canonical home for the PinballMap/OPDB metadata we ingest — it answers "where does mfr/year/edition render." **Frame-first:** it renders only the fields that exist, so until PBM (`PP-o355.2`) populates them it's simply empty/omitted — the chip + name still stand on their own.
- **Backbox translite (desktop only):** a full-height image block on the **right**, spanning the header **and** the tab strip, flush to the strip's bottom border and the card's right edge. Sourced from the machine's OPDB image via its PinballMap link.
  - **Fixed 300px-wide box, image absolutely positioned with `object-fit:cover`.** This is load-bearing: an earlier height-driven version (`height:100%; width:auto`) had no hard width cap and fell back to the image's natural ~1099px width, blowing out the page. A fixed box can't do that.
  - **Graceful fallback:** machines with no OPDB image (not matched on PinballMap) show the header without the block — the chip + identity stand alone.
  - **Not on mobile.** A translite is a large, busy, ~2-foot-wide image; at thumbnail size it's illegible mush, and a side block stole width from the name/meta/tabs (all truncated). The only mobile-respecting treatment would be tap-to-expand to a full-screen lightbox — **deferred**, not in this design.
- **Tab strip:** `Info / Settings / Service [badge] / Timeline`. The Service badge is the open-issue count tinted by machine status color (amber for needs-service). Identity-only header otherwise — no status text, no actions, per the Tabbed Detail archetype.

> **Note on Settings:** real production currently ships `Info / Service / Timeline`. The mockups include **Settings** on the "assume it ships" basis (`PP-43q3`). If Settings slips, drop that tab; nothing else in this design depends on it.

---

## 3. Info tab — the player's landing

### Reading order (both breakpoints)

`Description → Hero → (reference cluster) → Recent activity`

1. **Description** — a plain prose card with **no "Description" label** (the prose is self-evidently the description). Sits **above** the hero: game context reads first, then health + action. (This was a deliberate structural call — Description high, above the hero.)
2. **Hero** — the player's whole answer:
   - machine **status** (`● Needs Service`, amber) + **presence** pill (`● On the floor`)
   - a large primary **Report a problem →** button (the QR target's payoff; routes to the report page, where existing-issue dedup happens)
   - a **Known issues** peek (2–3 open issues, severity dot + ID + title + status) with **View all on Service →**
3. **Reference cluster** — **Tags**, **Owner**, **PinballMap** (see below).
4. **Recent activity** — a slim 3-row timeline peek with View all.

### Desktop vs mobile

- **Desktop:** main column `[Description → Hero → Recent activity]` + 300px right rail `[Tags → Owner → PinballMap]`.
- **Mobile:** one column, rail cards fold inline after the hero: `Description → Hero → Tags → Owner → PinballMap → Recent activity`.

### Reference cluster details

- **Tags (future slot — Collections feature):** distinguishes **public/admin tags** (solid green, visible to all) from **private/personal tags** (teal dashed + lock icon — e.g. a TD's private tournament set). Includes an `+ add tag` affordance. Tags are undefined/unbuilt; this reserves the visual slot and the public-vs-private model.
- **Owner:** a single compact owner card (avatar + name + "Added <date>"). Replaces the old redundant details grid — the other fields it duplicated already render elsewhere.
- **PinballMap:** a single compact row (`◆ PinballMap · ● Listed · ⚠ desync` + actions). Deliberately minimal here — **full PBM card polish is owned by the separate PinballMap design effort**, not this one. The **"View on PinballMap" deep link must be public** (visible to anonymous viewers), per `PP-o355.3`.

---

## 4. Service tab — the maintainer's workbench

### Desktop layout

Main column + 300px right rail.

**Main column:**

- **Open Issues card** — defaults to the **Open** view, with a **⋯ menu** (the only control; no inline filter bar / search / sort):
  - **Show: Open / All issues** — an in-place view toggle.
  - **View all in Issues list →** — opens the global issues list filtered to this machine, **all statuses**.
  - **Export all issues (CSV).**
  - Issue rows are richer than the Info peek: severity dot + ID + title + age, then a badge strip (**Status · Severity · Priority**, the design-bible field order) + reporter + assignee.
  - **The machine name is omitted from these rows** — redundant on the machine's own page (`PP-dnk8`). On mobile (~375px) the badge strip must not wrap to a second row; drop to the two highest-priority badges (Status + Severity) before wrapping (`PP-dnk8` open thread).
- **Activity card** — a maintenance-focused timeline feed (see §5 for authenticity), with **+ Add note** (opens the comment composer) and **View full timeline →** (to the Timeline tab).

**Right rail:**

- **Machine box:** **Status** (read-only — _derived_ from open issues, with a one-line explanation), **Presence** (a 5-state select), and a **Watch this machine** button — the **same single toggle for everyone, owners included** (see §7 for the `PP-71ye` resolution). Watch is `isWatching` + `watchMode` (`notify` / `subscribe`); there is no separate "mute" state, so unwatch already means "no notifications."
- **QR code card:** the printable code that links players to this machine's page → the Report button. Print / Download. **This is the "show QR" action relocated off the header.**

### Mobile layout

Single column: **Status + Presence strip → Watch → Open Issues (⋯) → Activity (+ Add note) → QR code.**

- **Watch** sits directly under the status strip — it's the action you'd take after seeing "Needs Service."
- The desktop **Machine box is split** on mobile: contextual status/presence rides up top; the Watch action stays adjacent; QR sinks to the bottom. (Open question if you'd rather keep them in one card.)
- **Export** lives only in the ⋯ menu — it's not a prominent mobile action.
- QR renders as a compact horizontal card (code + caption side by side).

### Key behavioral decisions

- **Status is read-only.** Machine status derives from open issues (`deriveMachineStatus`); a tech **cannot** force it. The only manual machine control is **presence**.
- **Presence has 5 states** (`presence.ts`): On the Floor / Off the Floor / On Loan / Pending Arrival / Removed → a select, not a toggle.
- **No filter bar, no search, no sort** on the tab (the ⋯ Open/All toggle covers the in-context need; rich filtering lives on the full Issues list page).
- **No closed-history section, no stats card** (cut as redundant — closed issues are reachable via "View all").

---

## 5. Activity feed authenticity (grounded in real timeline code)

This Activity feed **is the implementation of `PP-7mjy`** ("pre-filtered service view embedded in the Service tab"). `PP-7mjy` left open whether the feed should be notes-only or also include issue-lifecycle rows — **this design answers: include all event kinds** (notes/comments + issue events + lifecycle), exactly like the full Timeline, just capped to a recent peek with "View full timeline →".

The feed mirrors the existing machine-timeline renderers so the design maps 1:1 to real components (`src/components/machines/timeline/*`, `src/lib/timeline/*`):

- **Notes = comment rows** (`MachineTimelineCommentRow`): avatar + author + an inline **tag pill** (`machine-tags.ts`: Maintenance / Adjustment / Parts / Upgrade / Cleaning / Inspection / Note / Highlight) + the note body. "+ Add note" maps to `MachineTimelineComposer`.
- **Issue events = two-line rows** (`MachineTimelineIssueRow`): line 1 = `GZ-7 opened` (id + verb) + snapshot badges + "— Actor" + time; line 2 = the `GZ-7 Title` link. Verbs use the real phrasing (`opened`, `closed`, `→ In Progress`, `assigned to X`, …).
- **Lifecycle events = single-line rows** (`MachineTimelineSystemRow`): real wording from `format-machine-event.ts` — e.g. "Availability changed from On the floor to Off the floor" (note: _Availability_, not _Presence_).
- **Per-kind icon colors** follow `MACHINE_EVENT_ICONS`: teal = active issue work (open/status/assign), green = resolved (`issue_closed`), muted = metadata edits, primary = `machine_added`.

Once the Settings tab (`PP-43q3`) ships, **settings-set changes will also surface here** as lifecycle rows — `PP-vplq` wires that event emission; the feed already renders lifecycle rows, so no Activity-side change is needed when it lands.

---

## 6. What's NOT changing

| Item                                                                       | Reason                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Tabbed Detail archetype, URL-driven tabs, shared `getMachineForLayout`     | Sound; the redesign reworks tab bodies, not the shell    |
| Timeline tab                                                               | Out of scope — Service shows a _peek_ that links to it   |
| Settings tab internals (`PP-43q3`)                                         | Out of scope — only its presence in the strip is assumed |
| Permission model (`checkPermission`, `machines.watch`, etc.)               | Unchanged; new UI consumes the existing matrix           |
| Export mechanism (`ExportButton`)                                          | Unchanged — only its placement moves into the ⋯ menu     |
| Status derivation (`deriveMachineStatus`), presence values (`presence.ts`) | Unchanged — surfaced, not modified                       |
| Full PinballMap card design                                                | Owned by the separate PinballMap design effort           |

---

## 7. Open questions / deferred (decisions for Tim before/at build)

- **Owner-watch UX (`PP-71ye`) — resolved:** keep **one Watch toggle for everyone, owners included.** Watch is binary (`isWatching` + `watchMode`); there is no separate "mute" state, so a relabel would be a misleading synonym for "off." Watching is independent of ownership — an owner unwatching to quiet a noisy machine is legitimate. Fix the original confusion with one line of clarifying subtext, not a special owner path. `PP-71ye` rescopes to "clarifying copy" (or closes as works-as-intended).
- **Mobile Machine-box split:** status/presence up top vs. Watch/QR at bottom — keep split or regroup into one card?
- **Translite on mobile:** deferred tap-to-expand lightbox (thumbnail in the PBM card) if we ever want the art on phones.
- **Tags / Collections:** entirely undefined feature — this design only reserves the slot and the public-vs-private model.
- **Settings tab:** contingent on `PP-43q3` shipping.

---

## 8. Existing beads — roll-ins, dependencies, separate

Audited the open bead set against this design. Disposition:

**Rolled in / superseded by this redesign:**

- **`PP-0kta`** (tight filter bar for the issues section) — **superseded.** This design intentionally builds **no inline filter bar**: Open issues by default + an **Open/All toggle in the ⋯ menu**, with real multi-field filtering deferred to the global Issues list ("View all"). Close/rescope `PP-0kta` to "⋯ Open/All toggle + View-all link" when this lands. _(Tradeoff to accept: no in-place severity/priority/frequency filter on the tab — that's the price of the simpler surface.)_
- **`PP-7mjy`** (pre-filtered service timeline embedded in the Service tab) — **this is the Activity feed** (§4.1, §5). Its open "notes-only vs. lifecycle rows?" question is answered: include all event kinds.
- **`PP-dnk8`** (slimmer issue cards) — folded into the issue-row spec (§4.1): machine name omitted, mobile badge-wrap rule. Can also ship as a follow-up polish if it slips.

**Fill reserved frames later — these do NOT gate the redesign (it ships first):**

- **`PP-o355.2`** (PBM machine linking + catalog mirror, _in_progress_) — will **populate** the header mfr/year/edition sub-line and the translite image. Until it lands, the sub-line is empty/omitted and the translite frame falls back to the chip-only header. The redesign ships without it.
- **`PP-o355.3`** (PBM snapshot sync + status card) — fills the PBM compact row's data + the **public** "View on PinballMap" link. The redesign ships the PBM card as a placeholder frame; the full PBM card design lives with the PinballMap effort.
- **`PP-43q3`** (Settings tab) — when it ships it simply appears in the tab strip; the redesign neither blocks on it nor needs changes when it lands.
- **`PP-vplq`** (emit timeline events on settings-set changes) — once `PP-43q3` + this land, settings changes appear in the Activity feed automatically (feed already renders lifecycle rows). No Activity-side change needed.

**Reusability note:**

- **`PP-slrd.2`** (collection-timeline note composer) needs the machine note composer + its server action factored as **reusable** so the collection timeline can share it. Build the "+ Add note" composer (§4.1) with that reuse in mind.

**Kept separate (out of scope — flagged so they're not lost):**

- Report-flow edge cases — **`PP-3pny`** (report for a machine not yet in the DB), **`PP-z3qa`** (issue-not-found page lacks a machine back-link), **`PinPoint-pcm4`** (report-form guidance copy), **`PP-8a54`** (idempotent-retry rate-limit). The Info hero's Report button just routes to the existing report page; these own that page's behavior.
- **`PP-cqb`** ("comment and close") and **`PinPoint-5zr`** (sliding issue-detail drawer) — issue-detail surface, not the machine page.
- Collections proper — **`PP-slrd`**, **`PP-07oc`**, **`PP-829c`** (bulk presence) — the Tags slot reserves space; the feature is a separate epic.
- Timeline-tab features — **`PP-0x98.6`** (note full-text search), **`PP-0x98.7`** (note→issue), **`PP-0x98.8`** (mobile editor generalization) — belong to the full Timeline tab.

---

## 9. Implementation slicing (to be turned into beads at planning time)

This is one brainstorm but **not** one PR. **The home redesign ships first and stands alone**; every PBM/Settings/Collections touchpoint is a reserved frame that renders a graceful empty/placeholder state until the owning effort fills it. Candidate slices, each independently shippable (one bead = one PR):

1. **Enriched shared header + frames** — chip styling, mfr/year/edition sub-line (empty until PBM), and the desktop **translite block frame** with chip-only fallback. All ship now; the OPDB image/metadata fills in when `PP-o355.2` lands — no dependency wait.
2. **Info tab rework** — Description-above-hero, hero with Report button + known-issues peek, Owner card, **PBM placeholder card**, **Tags placeholder card**, slim recent activity. PBM card fills via `PP-o355.3`; Tags via Collections.
3. **Service tab rework** — Open Issues card + ⋯ menu, authentic Activity feed + Add note (built reusable for `PP-slrd.2`), Machine ops box (status/presence/Watch), QR card. Folds in `PP-0kta`, `PP-7mjy`, `PP-dnk8`. Owner-watch resolved (§7): single toggle for all.

Sequence: header+frames (1) → Info (2) and Service (3) can parallelize. **Nothing waits on PBM, Settings, or Collections** — those land later and populate the frames left for them.
