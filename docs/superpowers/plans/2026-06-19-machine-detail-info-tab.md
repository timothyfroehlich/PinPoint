# Machine Detail — Info Tab Rework (Player Landing) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Bead:** `PP-5sgt.2` (epic `PP-5sgt`). **Depends on `PP-5sgt.1`** (enriched header).
**Spec:** `…/specs/2026-06-19-machine-detail-info-service-redesign/design.md` §3. **Visual source of truth:** `…/mockups/info-desktop.html`, `info-mobile.html`.

**Goal:** Rebuild the Info tab body as the QR-scanning player's landing — Description (above hero, no label) → Hero (status + presence + big Report button + known-issues peek) → reference cluster (Tags / Owner / PinballMap) → slim recent-activity peek.

**Architecture:** Server component page (`(tabs)/page.tsx`) consuming `getMachineForLayout`. Desktop = `grid md:grid-cols-[minmax(0,1fr)_320px]` (main + rail); mobile = single column, rail cards fold inline after the hero. The Report button is a `<Link>` to the existing report route. Tags and PinballMap are **placeholder frames** (static markup) until Collections / `PP-o355.3` land.

**Tech Stack:** Next.js Server Components, Tailwind v4 tokens, shadcn `Card`. Tests: Playwright targeted spec for the Info route + the report-button link; RTL only if any client logic appears (none expected). `pnpm run smoke` for render.

## Global Constraints

- Server Components default; the Report action is a `<Link>`/`<form>` to the report page — no client handler (CORE-ARCH-001/002).
- Semantic tokens only (CORE-UI-001). Status/severity colors come from `STATUS_CONFIG`/`SEVERITY_CONFIG`, never freestyle.
- Email privacy (CORE-SEC-007): the Owner card shows a name, never an email.
- Two-layer responsive: `md:` grid pivot for main+rail; rail folds inline on mobile. No JS viewport detection.
- `assertNoHorizontalOverflow()` at 375px + 1024px.
- Reading order is identical on both breakpoints: Description → Hero → Tags → Owner → PinballMap → Recent activity.

---

### Task 1: Description card above the hero (no label)

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx`
- Reuse: `src/app/(app)/m/[initials]/machine-text-fields.tsx` / `inline-editable-field.tsx` (description field already exists)

**Interfaces:**

- Consumes: machine `description` (jsonb ProseMirror) from `getMachineForLayout`.
- Produces: a plain prose `Card` at the **top** of the main column with **no "Description" heading** — the prose stands alone. Empty/non-editor → existing `inline-editable-field` empty-hiding behavior applies.

- [ ] **Step 1:** Move the description rendering to the top of the main column; drop the "Description" label/heading. Match `info-desktop.html` (plain `.desc` card).
- [ ] **Step 2:** `pnpm run check` — green.
- [ ] **Step 3: Commit.** `git commit -am "feat(machine-info): description card above hero, no label (PP-5sgt.2)"`

### Task 2: Hero zone — status + presence + Report button + known-issues peek

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx`
- Test: `e2e/<area>/machine-info.spec.ts` (create or extend a machine-detail spec)

**Interfaces:**

- Consumes: `deriveMachineStatus(machine.issues)`, presence value, open `machine.issues` (already open-only from `_data.ts`), and the report route path.
- Produces: a hero block — machine status (color from status config), presence pill, a large primary **Report a problem →** `<Link>` to the report page, and a 2–3 item known-issues peek (severity dot + ID + title + status) with a **View all on Service →** link to the maintenance tab.

- [ ] **Step 1: Write a failing E2E test.** Load `/m/GZ`; assert the hero shows the status text, a "Report a problem" link, and that clicking it navigates to the report route; assert the known-issues peek lists the seeded open issue IDs and the "View all on Service" link points at `/m/GZ/maintenance`.
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/<area>/machine-info.spec.ts --project=chromium` — expect FAIL.
- [ ] **Step 3: Implement** the hero per design.md §3.2 + mockup: status + presence row, the prominent Report `<Link>`, and the known-issues peek (reuse the issue status/severity config for colors). Order: hero sits directly below the Description card.
- [ ] **Step 4: Run the spec** — expect PASS; then `pnpm run check`.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-info): player hero — status, presence, Report button, known-issues peek (PP-5sgt.2)"`

### Task 3: Reference cluster — Owner card + Tags placeholder + PinballMap placeholder

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx`

**Interfaces:**

- Consumes: `machine.owner` (name + added date), nothing for Tags/PBM yet.
- Produces: three cards — **Owner** (avatar + name + "Added <date>", replacing the old details grid); **Tags** static placeholder reserving the slot with the public-vs-private visual model (solid = admin/public, dashed+lock = private) and an `+ add tag` affordance; **PinballMap** compact placeholder row (`◆ PinballMap · ● Listed · ⚠` + a **public** "View on PinballMap" link). Tags fills via Collections; PBM via `PP-o355.3`.

- [ ] **Step 1:** Build the Owner card (name only — no email, CORE-SEC-007). Match mockup.
- [ ] **Step 2:** Build the Tags placeholder card (static) — public/private visual model per mockup; mark it visually as a reserved/future slot.
- [ ] **Step 3:** Build the PinballMap compact placeholder row with the public view link. Keep minimal — full PBM card is `PP-o355.3`'s job.
- [ ] **Step 4:** `pnpm run check` — green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-info): Owner card + Tags/PinballMap placeholder frames (PP-5sgt.2)"`

### Task 4: Recent-activity peek + responsive layout + overflow

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/page.tsx`
- Reuse: `src/components/machines/timeline/MachineRecentActivity.tsx` (slim it to ~3 rows if needed)
- Modify: `e2e/smoke/responsive-overflow.spec.ts`

**Interfaces:**

- Produces: a slim recent-activity peek (≈3 rows + View all) in the main column; the desktop main+rail grid (`md:grid-cols-[minmax(0,1fr)_320px]`) with the rail folding inline on mobile in the order Tags → Owner → PinballMap.

- [ ] **Step 1:** Place the recent-activity peek at the bottom of the main column (trim to ~3 rows per mockup).
- [ ] **Step 2:** Apply the desktop grid + mobile single-column fold; confirm reading order matches §3 on both.
- [ ] **Step 3:** Ensure `/m/[initials]` overflow coverage at 375px + 1024px.
- [ ] **Step 4:** `pnpm run smoke` + overflow spec — green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-info): slim recent-activity peek + responsive main/rail (PP-5sgt.2)"`

---

## Self-Review

- **Spec coverage (§3):** Description-above-hero-no-label (T1), hero with Report + peek (T2), Owner/Tags/PBM cluster (T3), recent-activity peek + responsive (T4). ✓
- **Frame-first:** Tags + PinballMap are static placeholders; nothing blocks on Collections or `PP-o355.3`. ✓
- **Privacy:** Owner card name-only (T3). **QR target:** Report button routes to the existing report page (dedup happens there) — not built here.
- **Dependency:** requires `PP-5sgt.1` header merged.

## Execution Handoff

Subagent-driven-development recommended. Can run in parallel with `PP-5sgt.3` once `PP-5sgt.1` is merged.
