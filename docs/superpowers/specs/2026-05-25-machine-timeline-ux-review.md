# Machine Timeline — UX Review

**Date:** 2026-05-25
**Feature:** PP-0x98 machine timeline (PR #1380), plus the about-to-be-built
identity-resolution redesign (PP-tv9l)
**Lens:** UX from the perspective of tech-savvy and non-tech-savvy pinball
technicians.
**North star:** capture maintenance work with _less overhead than filing a full
issue_ (direct user request).
**Status:** Reviewed with Tim 2026-05-25 — decisions locked below; the analysis
that follows is the supporting record.

---

## Decisions & build plan (locked 2026-05-25)

**Canonical framing — three-tier capture.** This is the mental model for the
whole feature:

- **Tier 1 — Quick note.** Plain-text feel, stored as Tiptap. The default. No
  required classification (tag defaults to `note`), toolbar hidden, submit on
  `Cmd`/`Ctrl`+`Enter`.
- **Tier 2 — Full note.** A format toggle reveals the rich-text toolbar.
  Two-way toggle; content is the same Tiptap doc in either mode, so switching is
  lossless.
- **Tier 3 — Issue.** The heavyweight path. Photos and structured fields live
  here, not on notes.

**Mobile.** Composer surfaces open in a bottom sheet on mobile (reachable
without scrolling, keyboard-adjusted, Post always visible). Named as a general
rule in design-bible §17; rolled out to all mobile editors (except
length-limited fields like titles) in a follow-up bead.

**Building now (PP-0x98 children):** composer redesign (`.1`), New Note header
button + mobile sheet (`.2`), recent-activity-on-overview last 5 (`.3`), real
avatars (`.5`).

**Deferred, consciously:**

- **Photos** — tier 3 (issues) covers this. Revisit only on user request; usage
  is currently low.
- **`(edited)` marker** (`.4`) — needs a schema migration (`timeline_events`
  has no edited/updated timestamp). Filed, `agy-ready`, but not a pure-UI change.
- **Text search** (`.6`) — filed for later.
- **Note → issue conversion + `#NN` refs** (`.7`) — V2; the notes↔issues bridge.
- **Generalize quick→full to all mobile editors** (`.8`) — after this prototype.

**Dropped (not filed):**

- **Empty-state CTA** — first event for a machine is always "machine added", so
  there is no true empty state.
- **Discoverability badge on the tab** — the overview recent-activity section is
  the discoverability surface; broader rethink waits on the mooted player-page
  vs. tech-page split.

---

## Verdict

The feature **does** deliver the core promise relative to issues: a note has no
title, no severity/frequency/status, no assignment. The read experience is
genuinely good — two-tier date grouping, compact system events vs. heavier
comments, and auto-emitted lifecycle/issue events give owners the "who changed
what" audit essentially for free. The bones are right and match how GitHub/Linear
timelines read.

The risk is **not correctness** — it's that a few choices quietly raise the
"add a note" floor back toward issue-level overhead, and the most expected
maintenance affordance (photos) plus the adoption hooks are absent. Tighten the
composer, add adoption nudges, and consciously roadmap the V2 items, and the
bases are covered.

---

## 1. The overhead audit (highest priority — this is the north star)

To post "cleaned the playfield" today:

> click **New entry** → type in a rich-text editor → open the **tag dropdown** →
> pick one of **8 tags** → click **Post**

Four clicks, a required classification decision, no keyboard submit, on a
document-style editor. Three frictions stand out:

### 1a. The required tag is the biggest tension with the goal

The composer **blocks Post until the user picks one of 8 tags** — by deliberate
design ("force classification, don't default everything to maintenance"). That's
a defensible data-hygiene stance, but it's exactly the friction that makes a
volunteer not bother.

- **Lighter framing:** default to `note` (the catch-all) or `maintenance` (the
  common case); one tap to change. Keeps clean classification for people who care
  and removes the wall for people who just want to jot.
- **This is a product judgment — Tim's call.** Recommendation: lean toward a
  default. Highest-leverage change for adoption, nearly free.

### 1b. Same heavy Tiptap editor as issues

Reusing the editor is DRY, but a 3-line writing surface with a
Bold/Italic/H2/H3/list/link toolbar _signals "write a document"_ — the opposite
of "quick note," especially for the non-tech-savvy tech.

- **Mitigation:** de-emphasize the chrome (collapse the toolbar until focused,
  shorter default height) so it reads as a jot, not an essay.

### 1c. No Cmd/Ctrl+Enter to submit

Every chat/composer the tech-savvy persona uses has it. Cheap, expected.

---

## 2. Things you'd expect in a maintenance log that aren't here

Ranked by how central they are to this feature's reason for existing.

### 2a. Photos / attachments — the #1 gap

Every maintenance-log product (UpKeep, Fiix, MaintainX) is photo-first because
techs document with pictures: the cracked ramp, the part number on a coil,
before/after. The editor has no image support and the action does no upload.

- Likely a real V2, but it's the most predictable "where's the photo button?"
  reaction. Should be an **explicit, prioritized roadmap item** — not an
  accidental omission.

### 2b. No text search

Tag filter helps, but "when did we last rebuild the flippers?" over months of
history means scrolling. Expected in any log. Fine to defer, but name it.

### 2c. No note↔issue bridge

Conceptually central given the framing ("notes vs issues"). A tech who jots
"left flipper feels weak" may need to escalate to an issue, or reference an
existing one. Today they're fully siloed — no `#42` reference, no
"convert note → issue," and issue _comments_ don't surface here (only issue
lifecycle events do).

- The boundary being deliberately drawn between notes and issues will feel
  arbitrary unless there's at least a path between them. V2-worthy; the seam most
  likely to generate "how do these relate?" confusion.

### 2d. Adoption / discoverability is thin

The Service tab has a count badge; **Timeline has none**, and timeline activity
appears nowhere else (no dashboard surface, no machine-card hint).

- If owners asked to "see who changed what," they need a reason to open the tab.
  A recent-activity indicator (badge/dot) is the cheap version. A feature this
  quiet risks not getting used regardless of how good it is.

### 2e. Empty state is passive

"History will appear here…" with no CTA. For a feature we want techs to adopt, a
gentle "Be the first to log work on this machine" (plus maybe what the tags mean)
converts far better. Cheap, high-leverage for adoption.

---

## 3. Smaller things worth a look

- **Mobile composer is inline, not a Sheet.** Techs are on the floor with phones;
  issue-detail already uses the sticky-composer Sheet pattern from the design
  bible. On-the-floor logging is _the_ use case, so this matters more here than
  on issue detail.
- **Tag taxonomy may confuse the non-savvy persona.** maintenance / adjustment /
  parts / upgrade / cleaning / inspection / note / highlight — the line between
  maintenance/adjustment/parts is fuzzy, and "highlight" is unclear. No
  descriptions/tooltips in the dropdown. If the tag stays _required_, the
  ambiguity compounds the friction; with a default it matters less.
- **Editing exists now but no "(edited)" marker observed.** The spec originally
  said no-edit; an edit path was added. If a posted note can change, "(edited)"
  is the expected trust signal — confirm it's there.
- **Avatars are initials-only** even though profiles have `avatarUrl`. In a
  volunteer org where people know each other's faces, real avatars speed
  "who did this" scanning.

---

## 4. Two-persona read

- **Non-tech-savvy floor volunteer:** wants "I cleaned AFM" in seconds, on a
  phone, maybe with a photo. Current blockers: required tag decision,
  document-style editor, no photo, no mobile sheet, ambiguous tags. This persona
  is where adoption is lost first.
- **Tech-savvy tech:** served better, but wants Cmd+Enter, search, issue linking,
  and parts/cost-ish structure. Usable but a bit under-powered.

---

## 5. Recommendation: covering bases vs. scope creep

### Cheap, serves the goal — worth doing in/around this work

(None are new subsystems.)

- Default tag, or reconsider required-ness (§1a)
- Cmd/Ctrl+Enter to submit (§1c)
- Empty-state CTA (§2e)
- Timeline activity badge on the tab (§2d)
- "(edited)" marker (§3)
- Real avatars (§3)
- De-emphasize editor chrome (§1b)

### Genuine V2 — decide consciously rather than by omission

The spec already lists notifications, custom tags, and sub-tabs as conscious
deferrals. Add these so they're _chosen_, not forgotten:

- **Photos / attachments** (highest value — the next thing users will ask for)
- Text search
- Note↔issue linking / convert-to-issue
- Mobile composer Sheet

---

## Comparisons referenced

- **GitHub / Linear issue timelines:** compact system events + heavier comments —
  PinPoint matches this well.
- **CMMS tools (UpKeep, Fiix, MaintainX):** photo-first, work-order templates,
  parts/cost fields. PinPoint's note is far lighter (good, per the goal) but
  lacks photos — the one CMMS staple maintenance users expect.
- **Slack / chat:** quick type + Enter to send, no required categorization.
  PinPoint's required tag + no-Enter-submit is heavier than chat; the "quick jot"
  mental model is closer to chat than to a document.
- **PinPoint's own issue composer:** the note is genuinely lighter (no
  title/severity/etc.) — the promise _is_ delivered relative to issues, but the
  same rich editor + a required tag narrow the gap.

---

# Implementation status & handoff (in-flight — 2026-05-25, prototype mode)

> **State:** prototype built and visually verified in-browser; **NOT committed**;
> **tests not written**; **local `db:reset` currently broken** (see Blocker).
> Lead does the productionization sequentially (not parallel subagents — the
> feature is interwoven across shared files).

## Decisions locked this session

- **Three-tier capture:** quick note (default, one line, no required tag) →
  full note (`Aa` toggle reveals toolbar, two-way, lossless) → issue (tier 3;
  photos live there).
- **New Note + New Issue** live in the **Info tab's "Recent activity" header**,
  not the page header. **"View all"** sits next to the "Recent activity" title.
  New Issue is outline/secondary → `/report?machine=<initials>` (public, not
  gated by compose perm). New Note is primary.
- **One composer, one bottom sheet, two entry points** (Info recent-activity +
  Timeline tab). The Timeline tab was inline; now unified to the sheet.
- **Formatting toggle:** `Aa` on mobile, `Aa Formatting` on desktop (`sm:`),
  tooltip Show/Hide formatting. `Cmd`/`Ctrl`+`Enter` submits.
- **Deferred:** photos (tier 3). **Dropped:** empty-state CTA (machine_added is
  always first), discoverability badge (recent-activity covers it), tag-taxonomy
  cleanup (not pursuing).
- **`edited_at` folded into migration `0036`** (no separate `0037`).
- **Beads:** close `.1/.2/.3/.4/.5` (built in this PR); keep `.6` (text search),
  `.7` (note→issue, V2), `.8` (generalize quick→full). New Issue button: no bead.

## Built (uncommitted on branch `worktree-pp-0x98-timeline`)

- `RichTextEditor.tsx` — `showToolbar`, `autoFocus`, compact min-height fix
  (mutually-exclusive min-heights).
- `MachineTimelineComposer.tsx` — default tag `note`; no required pick;
  `Cmd/Ctrl+Enter`; `Aa` quick→full toggle; one-line in quick mode;
  `onCancel`/`autoFocus` props.
- `MachineNoteComposerSheet.tsx` (NEW) — bottom sheet, centered on desktop.
- `MachineRecentActivity.tsx` (NEW) — last 5 events on Info tab; hosts New Issue
  - New Note + View all; read-only rows; **duplicates `isIssueEvent` narrowing**
    from the timeline page (prototype debt — extract on rule-of-three).
- `MachineTimelineActionsRow.tsx` — rewritten to use the sheet (was inline).
- `MachineTimelineCommentRow.tsx` — real avatars (`AvatarImage` + initials
  fallback); `(edited)` marker via `editedAt`.
- `MachineDetailHeader.tsx` + `(tabs)/layout.tsx` — **reverted** to original
  (New Note moved out of header).
- `(tabs)/page.tsx` — renders `MachineRecentActivity`, computes `canCompose`.
- `(tabs)/timeline/page.tsx` — threads `authorAvatarUrl` + `editedAt` +
  `machineName`.
- `(tabs)/timeline/actions.ts` — `addMachineCommentAction` also revalidates
  `/m/[initials]`; `updateMachineComment` stamps `editedAt`.
- `lib/timeline/machine-events.ts` — select `authorAvatarUrl` + `editedAt`; row
  type updated; `updateMachineComment` sets `editedAt`.
- `server/db/schema.ts` — `timeline_events.editedAt` column.
- `drizzle/0036_chief_lightspeed.sql` (+ snapshot) — folded timeline_events incl.
  `edited_at`; old `0036_clever_vermin` + `0037` removed; journal trimmed to idx 36. `db:generate` reports **no changes** (fold is consistent).
- Docs: design-bible §17 (composer bottom-sheet + quick→full rule); this doc.
- **Not this session:** `MachineTimelineFilter.tsx/.test`, `multi-select.tsx`,
  `TagSelect.tsx` were already uncommitted from prior branch work.

## BLOCKER — fix first after compaction

`pnpm db:reset` fails during migrate at an **early migration (~0028–0030,
Discord RLS)** — _before_ `0036`, so it is **not** the fold. `db:generate` is
clean. Likely pre-existing/environmental (supabase auth-schema state after
`supabase stop && supabase start`, or a non-idempotent RLS migration on replay).
**Local DB is now in a partial state** (dropped + partial migrate) → the dev
server on :3380 and browser verification are **offline until a clean reset**.
May need Tim's input. Do not resume browser checks until the DB is healthy.

## TODO to production-ready (sequential)

1. Fix local `db:reset` (blocker) → healthy, seeded DB (machine `AFM`).
2. Tests:
   - Rewrite `MachineTimelineComposer.test.tsx` (default note, post-with-body,
     `Cmd+Enter`, `Aa` toggle).
   - Rewrite `MachineTimelineActionsRow.test.tsx` (now a sheet trigger).
   - `MachineTimelineCommentRow`: `(edited)` marker + avatar fallback.
   - Integration: `editMachineCommentAction` stamps `editedAt`;
     `getMachineTimeline` returns `editedAt` + `authorAvatarUrl`.
   - E2E (`e2e/full/machine-timeline.spec.ts`): post via sheet, recent-activity
     last-5 + View all, edited marker.
3. Responsive: `Aa Formatting` uses `sm:` (viewport) — CORE-RESP prefers
   container queries for component internals. Reconsider.
4. `pnpm run preflight`; fix lint/format.
5. Commit as **one PR**; exit prototype mode.
6. Sync `origin/main` first via merge (PR #1433 prototype-mode merged).
7. Close beads `.1/.2/.3/.4/.5`; keep `.6/.7/.8`.

## Operational

- Branch `worktree-pp-0x98-timeline`; **PR #1380** (timeline V1) is OPEN — this
  extends it.
- Dev: `pnpm run dev` :3380. Login `/login` → "Login as Test Admin". Machine
  `AFM`.
- **Linked worktree → cannot dispatch `Agent(isolation:"worktree")` from here**
  (#47548). Future `.6`/`.8` subagents dispatch from the **main** worktree.
- **PP-tv9l** (blocks PP-0x98) plans to reshape `0036` in place — coordinate the
  `edited_at` fold with it.
- Separate infra bug filed this session: the **psql guard hook** blocks
  `psql "$POSTGRES_URL"` to localhost when the host arrives via env var.
