# Tabbed Report Page — Design Spec

**Date:** 2026-07-16
**Status:** Approved — design locked with Tim 2026-07-16. Tracked by **PP-idrb**; implementation plan to follow in `docs/superpowers/plans/`.
**Supersedes exploration:** the `/report/quick` "Quick" header button (unclear label — the trigger for this work), shipped standalone in PR #1667 (PP-sn34) and reorganized here into tabbed IA.

---

## 1. Goal

Replace the confusing second header button ("Quick") with a single **Report Issue**
entry that opens a **tabbed** report page: report **one** issue in detail, or
**several** at once. One page, two views of the same work, no mystery button.

## 2. Motivation

- The top-bar "Quick" button reads as meaningless out of context (Tim: "I'd have no
  idea what that button is supposed to be").
- Two separate destinations (`/report`, `/report/quick`) for "report an issue" is
  redundant IA. Folding them into tabs removes the second button entirely instead of
  relabeling it, and makes the relationship obvious.

## 3. Approach (decided)

- **Header:** collapse the two buttons ("Report Issue" + "Quick") into a **single
  "Report Issue"** button.
- **Report page is tabbed:** boxed tabs, two of them:
  - **"Single issue"** (AlertCircle icon) — the existing detailed report form.
  - **"Multiple"** (ListPlus icon) — the quick grid.
  - Icons on. **Default tab: Single.**
- **Deep-linkable:** `/report` = Single tab, `/report/quick` = Multiple tab. Tabs
  switch **client-side** (state survives the switch) while the **URL updates** so both
  are linkable, back/forward works, and the mobile entry still targets Multiple.

## 4. Shared-state model — "one entry, two views"

The single form is the **detailed view of entry #1**; the grid is the **compact
multi-view** where **row 1 is that same entry**. They share state bidirectionally.

**Synced fields (single form ↔ grid row 1):** machine, title, description, severity,
priority, status, frequency, assignee, watch.

- **Rich-text description on both sides.** The grid's **expanded** row gains the same
  rich editor the single form uses ("click More, you get all of it"). Description is
  therefore fully syncable and **not** a lock trigger.
  - **Empty-editor handling:** route an empty editor to `null` via the existing
    `docIsEmpty()` (`src/lib/tiptap/types.ts`) so we never persist a junk
    "empty paragraph" doc. (The single form already effectively does this by
    submitting `""`; the grid rows must match.)
- **Photos: single (detailed) view only.** Effectively unused in practice (Tim: "no
  one's ever uploaded a photo"), so they simply don't travel to the compact grid — no
  lock, no ceremony. Kept on the single form as-is; just outside the sync.
- **Unified draft persistence.** The grid gains the same `localStorage` draft the
  single form already has (`report_form_state`), so a batch is never lost. One shared
  draft holds the single-view fields + all grid rows.

## 5. The one lock: 2+ rows disables Single

The only situation where a tab is unavailable:

- **Trigger:** the grid has **2+ rows with real content** (content = a machine _or_ a
  title; the auto-maintained trailing blank row does **not** count).
- **Effect:** the **Single issue** tab disables — you can't collapse several issues
  into one.
- **UX (option A — approved):** the Single tab greys out with a small lock cue.
  **Tapping** it (works on touch — no hover needed) does **not** switch; it reveals a
  one-line reason directly under the tabs, with the escape:
  > **"You're logging several issues — remove the extras to go back to a single report."**
- **Un-lock:** dropping back to a single content row re-enables Single immediately.
- There is **no** Single→Multiple lock (photos are out of scope, so nothing on the
  single side is unsyncable enough to warrant one).

## 6. Permissions / anonymous reporters

- **Multiple is gated** by `issues.report.quick` (member/technician+).
- **Anonymous / guest reporters get the single form only — no tabs at all.** (They're
  why the single form carries name/email + CAPTCHA.) The tab chrome renders only for
  users with quick-report permission.
- Anonymous user hitting `/report/quick` directly → redirect to `/report`.

## 7. Fold-ins (while we're in here)

- **Fix the single form's validation error-prefix leak.** `report/validation.ts`
  builds `` `${field}: ${message}` `` → surfaces `machineId: Please select a machine`,
  the exact leak already fixed in the grid's `report/quick/validation.ts`. Drop the
  prefix for consistency.
- **Mobile bottom-bar / "More" sheet** "Quick report" entry → point at `/report/quick`
  (the Multiple tab) so mobile users still jump straight to batch mode. Label stays
  "Quick report" or aligns to "Multiple" — minor, settle during build.

## 8. Architecture (final — as implemented)

The Task 1 spike **confirmed** that a client context rendered in `report/layout.tsx`
survives `/report ↔ /report/quick` navigation without remounting, so the
shared-store-in-layout approach shipped as designed.

- A **shared `report/(tabbed)/layout.tsx`** (Server Component) fetches machines +
  assignees **once** and hosts the `"use client"` **`ReportDraftProvider`** (the single
  source of truth for the shared draft) + the boxed **`ReportTabs`** bar, wrapping both
  child routes. `/report` (Single) and `/report/quick` (Multiple) render as its children.
  The tabs live under a **`(tabbed)` route group** so the layout scopes to exactly those
  two routes — **`/report/success` sits outside the group** and does not inherit the tab
  chrome or the provider. That exclusion is load-bearing: navigating Single → submit →
  `/report/success` unmounts the provider, so its persisted-draft cleanup (localStorage
  clear on the success page) is sufficient — returning to `/report` remounts a fresh
  provider that hydrates the now-empty draft. (Were success inside the group, the
  provider would survive the round-trip and re-show the submitted entry.)
- **`ReportDraftProvider`** owns the persisted `localStorage` draft
  (key `report_draft`, superseding the legacy `report_form_state`, which it migrates on
  first load), hydration, the stale-machine drop (PP-lql), and the `contentRowCount`
  the tab bar reads for the lock. Its `entries[0]` is **entry #1** (synced between the
  Single form and grid row 1); `single` holds the Single-only reporter identity + photos
  (CORE-SEC-007). A `hydrated` flag lets the Single form apply a URL `?machine=` over a
  restored draft without a clobber race.
- **Submitted grid rows LEAVE the shared draft** and become display-only "Created GP-42"
  receipts (grid-local, ephemeral). This keeps `contentRowCount` — which the layout's
  tab bar reads for the §5 lock — counting only unsubmitted rows, so submitting down to
  one row re-enables the Single tab. (This also retired the misleading grid "Undo": the
  issue is already committed, so it could only ever create a duplicate.)
- **Description is ProseMirror end-to-end.** The grid's expanded row uses the same
  `RichTextEditor` as the Single form; `quick/schemas.ts` accepts a ProseMirror doc (a
  shared `proseMirrorDocValueSchema` bridges the loose validator to the strict app type)
  and the grid routes an empty editor to `null` via `docIsEmpty`.
- Machines + assignees are fetched once in the layout (both pages previously fetched
  their own; `quick/page.tsx` now reads them from the store).
- Both the Single form and the grid stay client components, so no Server-Component /
  progressive-enhancement regression. The Single form's server action and the grid's
  actions are reused unchanged apart from the validation-message fold-in and the
  ProseMirror description.

## 9. Out of scope

- Per-row **photo** upload in the grid; removing the photo feature from the single form.
- Any change to the create-issue server actions beyond the validation-message fix.
- Redesigning the single form's or grid's internal field layout (only the description
  gains the shared rich editor on the grid side).

## 10. Risks / watch-items

- **State model is the hard part** — one shared store feeding two differently-shaped
  views (detailed vs compact), kept in sync on entry #1, with the grid's rows[0] being
  that entry. Needs careful design so edits in either view reflect in the other without
  loops.
- **Draft schema migration:** unifying persistence changes the `localStorage` shape;
  handle a legacy `report_form_state` gracefully (the single form already guards
  corrupt drafts — extend that).
- **Idempotency:** entry #1 must carry a single idempotency key across both views so
  submitting from either can't double-create it.
- **Layout-persists-state** assumption should be validated early in the plan (a spike).

## 11. Testing approach

- **RTL:** tab switching preserves fields; row-1 ↔ single sync both directions; 2+ rows
  disables Single + tap reveals the reason + removing rows re-enables; empty rich editor
  → null; anon sees no tabs.
- **Integration (PGlite + direct action):** unchanged action wiring still creates issues
  correctly from both views; idempotency across the shared entry.
- **E2E (smoke + targeted):** `/report` and `/report/quick` both render the tabbed page
  with the right tab active; deep-link + back/forward; permission gating (anon → single
  only / redirect).

## 12. Acceptance criteria

- Header shows a single "Report Issue" button; no separate "Quick" button.
- `/report` opens the tabbed page on **Single**; `/report/quick` opens it on **Multiple**;
  both deep-linkable, back/forward correct.
- Switching tabs never loses typed content; entry #1 stays in sync between the single
  form and grid row 1 (all synced fields, both directions).
- Grid expanded row has the rich-text editor; empty editor persists no description.
- 2+ content rows disables the Single tab with the approved tap-to-explain copy; drops
  back to one row → re-enabled.
- Anonymous users get the single form only (no tabs); `/report/quick` redirects them.
- Single-form validation messages no longer leak the raw field name.
- Unified draft persistence: a batch survives reload.
- `pnpm run check` + relevant preflight green; new RTL/integration/E2E per §11.
