# Machine Detail — Service Tab Rework (Maintainer Workbench) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Bead:** `PP-5sgt.3` (epic `PP-5sgt`). **Depends on `PP-5sgt.1`** (enriched header). **Folds in `PP-0kta`, `PP-7mjy`, `PP-dnk8`.**
**Spec:** `…/specs/2026-06-19-machine-detail-info-service-redesign/design.md` §4–§5. **Visual source of truth:** `…/mockups/service-desktop.html`, `service-mobile.html`.

> **Amendments since original plan (2026-07-11, after `PP-5sgt.1` + `.2` merged):**
>
> - **Settings tab (`PP-43q3`) has shipped** (#1388, closed 2026-07-05). The design's "assume Settings ships" basis is now resolved TRUE; the tab strip is `Info / Settings / Service / Timeline` as drawn. No design change.
> - **Relocate owner-private config off the Info tab (`.2` handoff).** The Info tab still renders a temporary "Machine tools" block (`(tabs)/page.tsx`) holding the **QR dialog** (`QrCodeDialog`) and **`MachineTextFields`** (Description + **Owner's Requirements**). As part of this bead: move **Owner's Requirements** into the Service right-rail Machine box (Task 5) and **QR** into the Service QR card (Task 6), then **delete the Info-tab Machine-tools block** (Task 6). **Description stays on the Info tab** (player-facing, per design §3) — only the owner-private field moves.
> - **Owner's Requirements home decided (Tim, 2026-07-11):** Service right rail (Machine box), **not** the Settings tab — keeps `PP-5sgt.3` self-contained, no cross-tab scope. Gated by `machines.view.ownerRequirements` as today.

**Goal:** Rebuild the Service (maintenance) tab as the maintainer's workbench — Open Issues (default) with a ⋯ menu (Open/All toggle, View all, Export), an Activity feed mirroring the real machine timeline with "+ Add note", and a machine-ops rail (derived status, 5-state presence select, single Watch toggle) + a printable QR card.

**Architecture:** Server component page (`maintenance/page.tsx`) for data; the ⋯ menu and the presence select are small client leaves (shadcn `DropdownMenu` / select). Issue rows reuse `IssueCard`/`IssueBadgeGrid`. The Activity feed reuses the existing `TimelineRow` family (`MachineTimelineCommentRow`/`IssueRow`/`SystemRow`) capped to a recent peek. "+ Add note" reuses `MachineTimelineComposer` — **factor its server action to be reusable for `PP-slrd.2`**.

**Tech Stack:** Next.js Server Components + small client leaves, Tailwind v4 tokens, shadcn `DropdownMenu`. Tests: integration (PGlite + direct action) for any new query/filter; RTL for the ⋯ menu toggle + presence select logic; Playwright for the tab flow; `pnpm run smoke`.

## Global Constraints

- Server Components default; only the ⋯ menu, presence select, watch button, and add-note composer are client leaves (CORE-ARCH-001).
- Permissions via the matrix (`checkPermission`) — `machines.watch`, export, presence-edit gating unchanged (CORE-ARCH-008).
- No side effects inside DB transactions (CORE-ARCH-011) — note adds / presence changes deliver effects after commit.
- Status is **read-only/derived** (`deriveMachineStatus`); presence is the only manual machine control (5 states from `presence.ts`).
- Issue field/badge order: Status · Priority · Severity · Frequency (design-bible). Machine name omitted from rows.
- `assertNoHorizontalOverflow()` at 375px + 1024px; mobile badge strip must not wrap past 2 badges.

---

### Task 1: Open Issues card + ⋯ menu (Open/All toggle, View all, Export)

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/maintenance/page.tsx`
- Modify/replace: `src/app/(app)/m/[initials]/issues-expando.tsx` (becomes the Open-Issues card)
- Create: a small client component for the ⋯ menu (e.g. `src/components/machines/MachineIssuesMenu.tsx`)
- Reuse: `src/components/issues/IssueCard.tsx`, `ExportButton.tsx`
- Test: `src/test/unit/components/MachineIssuesMenu.test.tsx`

**Interfaces:**

- Consumes: open issues (default) and all-status issues for this machine. The page already loads open-only via `_data.ts`; for the "All" view either load all-status here or have "All" link to the global Issues list. **Decision (design §4):** the in-card toggle swaps Open↔All in place; "View all" is a separate link to the global Issues list filtered to this machine, **all statuses**.
- Produces: `MachineIssuesMenu` (client) with: Open/All segmented toggle (drives the in-card list), "View all in Issues list →" link (all statuses), "Export all issues (CSV)" (reuses `ExportButton` action). No inline filter bar / search / sort.

- [ ] **Step 1: Write failing RTL test** for `MachineIssuesMenu`: renders ⋯ trigger; opening shows Open/All toggle (Open active by default), a View-all link with the correct href (machine-scoped, all statuses), and an Export item.
- [ ] **Step 2: Run vitest** — FAIL.
- [ ] **Step 3: Implement** the menu (shadcn `DropdownMenu`; Export via `onSelect`, not a nested form — see pinpoint-ui dropdown rule) and the Open-Issues card header ("Open Issues (N)" + ⋯). Wire the Open/All toggle to switch the rendered list.
- [ ] **Step 4: vitest + `pnpm run check`** — PASS/green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-service): Open Issues card + ⋯ menu (Open/All, View all, Export) (PP-5sgt.3, supersedes PP-0kta)"`

### Task 2: Issue rows — richer, machine-name omitted, mobile badge cap (PP-dnk8)

**Files:**

- Modify: `issues-expando.tsx` (row rendering) and/or `IssueCard` usage
- Test: extend the issues-card RTL/smoke coverage

**Interfaces:**

- Produces: rows showing severity dot + ID + title + age, then Status·Severity·Priority badges + reporter + assignee; **machine name omitted**; at mobile width the badge strip caps to Status+Severity (no wrap to a second row).

- [ ] **Step 1: Write failing test** asserting a rendered machine-issue row does NOT contain the machine name, and that at a narrow container the badge set is limited to Status+Severity.
- [ ] **Step 2: vitest** — FAIL.
- [ ] **Step 3: Implement** the row via `IssueCard` (`compact`, `badgeLayout="strip"`) with machine name suppressed; apply the mobile badge cap (container-query or width-based class per design-bible responsive rules).
- [ ] **Step 4: vitest + `pnpm run check`** — PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-service): slim issue rows, drop machine name, cap mobile badges (PP-5sgt.3, folds PP-dnk8)"`

### Task 3: Activity feed (PP-7mjy) — reuse real timeline rows + View full timeline

**Files:**

- Modify: `maintenance/page.tsx`
- Reuse: `src/components/machines/timeline/TimelineRow.tsx` (+ Comment/Issue/System rows), `src/lib/timeline/*`

**Interfaces:**

- Consumes: a recent slice of this machine's `timeline_events` (all kinds: comment/note + issue + lifecycle).
- Produces: an "Activity" card rendering the real `TimelineRow` components, capped to a recent peek, with a "View full timeline →" link to the Timeline tab. Includes ALL event kinds (PP-7mjy resolved).

- [ ] **Step 1: Write a failing integration/E2E check** that the Service tab Activity card renders at least one note row, one issue-event row, and one lifecycle row from seeded timeline data, plus the "View full timeline" link to `/m/GZ/timeline`.
- [ ] **Step 2: Run the spec** — FAIL.
- [ ] **Step 3: Implement** by fetching the recent timeline slice (reuse the timeline data loader; cap to N) and mapping through `TimelineRow`. Match the mockup's row density.
- [ ] **Step 4: Run spec + `pnpm run check`** — PASS/green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-service): Activity feed reusing real timeline rows (PP-5sgt.3, implements PP-7mjy)"`

### Task 4: "+ Add note" composer — reusable for PP-slrd.2

**Files:**

- Reuse/modify: `src/components/machines/timeline/MachineTimelineComposer.tsx` + its server action
- Modify: `maintenance/page.tsx`

**Interfaces:**

- Produces: a "+ Add note" affordance in the Activity card header opening the composer (adds a `note`-tagged comment to the machine timeline). **The composer + server action must be factored so `PP-slrd.2` (collection timeline) can reuse them** — accept machine id as a parameter, no per-page hardcoding; deliver the after-commit effects via `after()` (CORE-ARCH-011).

- [ ] **Step 1: Write failing test** that adding a note from the Service tab inserts a comment-type timeline row that then appears in the Activity feed.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**, reusing the existing composer; refactor the server action signature to be machine-id-parameterized + reusable; ensure permission check + after-commit effect.
- [ ] **Step 4: Run test + `pnpm run check`** — PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-service): + Add note via reusable composer action (PP-5sgt.3, enables PP-slrd.2)"`

### Task 5: Machine-ops rail — derived status, presence select, single Watch toggle

**Files:**

- Modify: `maintenance/page.tsx`
- Reuse: `src/components/machines/WatchMachineButton.tsx`; presence labels from `src/lib/machines/presence.ts`
- Create: a presence-select client leaf if one doesn't exist
- Test: RTL for the presence select + integration for the presence-change action

**Interfaces:**

- Produces: a Machine card — read-only derived status (with a one-line "derived from open issues" note), a 5-state presence `<select>` (`getMachinePresenceLabel` for labels), the existing single Watch toggle (same control for everyone incl. owners — `PP-71ye` resolved; optionally one line of subtext that watching ≠ ownership), and the **Owner's Requirements** field relocated from the Info tab's `MachineTextFields` (gated by `machines.view.ownerRequirements` / `canEditGeneral` as today, via `updateMachineOwnerRequirements`). A presence change emits a `presence_changed` lifecycle event (shows in Activity).

- [ ] **Step 1: Write failing tests:** (a) status renders read-only (no control to change it); (b) presence select offers all 5 states with correct labels; (c) changing presence calls the presence action and the resulting lifecycle event appears; (d) Owner's Requirements renders in the Machine box for a permitted viewer and is editable via the existing action.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the rail; reuse `WatchMachineButton` unchanged; presence select wired to the existing presence-update action (emits lifecycle event after commit); render Owner's Requirements via `InlineEditableField` + `updateMachineOwnerRequirements`, gated as today (do NOT bring the Description field — it stays on Info).
- [ ] **Step 4: Run tests + `pnpm run check`** — PASS/green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-service): machine-ops rail — derived status, presence select, watch, owner requirements (PP-5sgt.3)"`

### Task 6: QR code card + responsive layout + overflow + preflight

**Files:**

- Modify: `maintenance/page.tsx`
- Create: a QR card (generate/display the machine-page URL QR; print/download) — reuse `QrCodeDialog` / `~/lib/machines/qr.ts` (`generateQrPngDataUrl`) currently mounted on the Info tab.
- Modify: `(tabs)/page.tsx` (Info tab) — **delete the temporary "Machine tools" block** once QR + Owner's Requirements have moved (keep Description on Info, relocated per design §3).
- Modify: `e2e/smoke/responsive-overflow.spec.ts`

**Interfaces:**

- Produces: a QR card encoding the machine page URL (the existing `QrCodeDialog`/`qr.ts` helper relocated from the Info tab body), with Print/Download. Desktop: ops + QR in the right rail. Mobile order: status+presence strip → Watch → Open Issues(⋯) → Activity(+Add note) → QR.
- **Cleanup:** after QR (Task 6) and Owner's Requirements (Task 5) live on Service, remove the Info-tab Machine-tools block (`QrCodeDialog` + `MachineTextFields` mount) so the Info tab no longer carries maintainer/owner-private config. Description stays on Info; drop `MachineTextFields`'s owner-requirements usage there.

- [ ] **Step 1:** Implement the QR card by relocating `QrCodeDialog` + `generateQrPngDataUrl` off the Info tab into the Service rail (encode `/m/[initials]` absolute URL). Print/Download actions.
- [ ] **Step 2:** Delete the Info-tab "Machine tools" block; confirm Description still renders on Info and no owner-private field (Requirements/QR) remains there. Update `machine-info-tab-auth` integration test accordingly.
- [ ] **Step 3:** Apply desktop main+rail grid and the mobile stack order from §4.
- [ ] **Step 4:** Ensure `/m/[initials]/maintenance` overflow coverage at 375px + 1024px; mobile badge strip ≤2 badges.
- [ ] **Step 5:** `pnpm run smoke` + overflow spec — green. Because this touches server actions + queries, run `pnpm run preflight` before opening the PR.
- [ ] **Step 6: Commit.** `git commit -am "feat(machine-service): QR card + responsive layout; retire Info-tab Machine-tools block (PP-5sgt.3)"`

---

## Self-Review

- **Spec coverage (§4–§5):** ⋯ menu replacing filter bar (T1), slim rows + name-omit + mobile cap (T2), authentic Activity feed all-kinds (T3), reusable Add-note (T4), derived status + presence select + single watch (T5), QR + responsive (T6). ✓
- **Folds in:** `PP-0kta` (T1 supersedes), `PP-7mjy` (T3 implements, all kinds), `PP-dnk8` (T2), `PP-71ye` resolved (T5 single toggle). ✓
- **Reuse for `PP-slrd.2`:** composer action parameterized (T4). **No closed-history / stats card** (cut per spec) — confirm neither is reintroduced.
- **Gotchas:** Export via dropdown `onSelect` not a nested form; status read-only (no force); after-commit effects for note/presence (CORE-ARCH-011); preflight before PR (server actions + queries).
- **Dependency:** requires `PP-5sgt.1` merged; can parallelize with `PP-5sgt.2`.

## Execution Handoff

Subagent-driven-development recommended (6 tasks, each independently gated). Run `pnpm run preflight` before the PR — this tab touches server actions, queries, and a possible new dependency (QR lib).
