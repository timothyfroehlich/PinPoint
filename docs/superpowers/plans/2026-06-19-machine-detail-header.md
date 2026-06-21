# Machine Detail — Enriched Header + Reserved Frames — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Bead:** `PP-5sgt.1` (epic `PP-5sgt`). **Ships FIRST** — `PP-5sgt.2` (Info) and `PP-5sgt.3` (Service) depend on it.
**Spec:** `docs/superpowers/specs/2026-06-19-machine-detail-info-service-redesign/design.md` §2. **Visual source of truth:** `…/mockups/info-desktop.html` (header zone) + `info-mobile.html`.

**Goal:** Replace the minimal `MachineDetailHeader` (mono chip + name) with an enriched, frame-first header: green initials chip + name + a mfr·year·edition sub-line, plus a desktop-only backbox translite block — all rendering graceful empty/fallback states until PinballMap data exists.

**Architecture:** Server component, no new data fetch — consumes the existing `getMachineForLayout` result (`_data.ts`). The header lives inside the tab `layout.tsx` above `MachineTabStrip`. The translite is a desktop-only (`md:`/`lg:`) element; mobile renders identity only.

**Tech Stack:** Next.js App Router (Server Components), Tailwind v4 semantic tokens, shadcn/ui. Tests: Vitest + RTL (component logic), Playwright smoke (`pnpm run smoke`) for render-without-500.

## Global Constraints

- Server Components default; `"use client"` only for interaction leaves (CORE-ARCH-001). The header has no interactivity → stays a server component.
- Semantic tokens only — no raw palette classes / hex (CORE-UI-001 / ESLint `better-tailwindcss/no-restricted-classes`). The green chip uses `text-primary` / `border-primary/…` family, not `green-*`.
- Two-layer responsive (CORE-RESP): viewport `md:`/`lg:` for the translite show/hide; no JS viewport detection.
- ts-strictest: no `any`, no `!`, no unsafe `as` (CORE-TS-007); path alias `~/` (CORE-TS-008).
- Baseline-Widely CSS only (`aspect-ratio`, `object-fit`, container queries OK).
- Every page must pass `assertNoHorizontalOverflow()` at 375px and 1024px.

---

### Task 1: Header data shape — expose mfr/year/edition + image URL to the header

**Files:**

- Modify: `src/app/(app)/m/[initials]/_data.ts` (the `getMachineForLayout` select / `MachineForLayout` type)
- Modify: `src/components/machines/MachineDetailHeader.tsx`

**Interfaces:**

- Produces: `MachineForLayout` includes the fields the header reads — `manufacturer: string | null`, `year: number | null`, `edition: string | null` (or whatever the schema/PBM-catalog columns are named at build time), and `backboxImageUrl: string | null`. **Verify the actual column names** in `src/server/db/schema.ts` (machines + any `pinballmap_catalog` mirror from `PP-o355.2`). If the columns don't exist yet (PBM hasn't landed), select them as `null` literals / leave the type fields optional so the header renders its empty-frame state. The header must compile and render with all four absent.

- [ ] **Step 1: Read the current data layer + schema.** Open `_data.ts` and `schema.ts`; confirm which of {manufacturer, year, edition, backbox image} already exist on `machines`. Note the real names.
- [ ] **Step 2: Add the present fields to the `getMachineForLayout` column selection** (only those that exist; do not invent columns). Keep the `cache()` wrapper intact.
- [ ] **Step 3: Run** `pnpm run check` — expect green (types compile with the widened `MachineForLayout`).
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(machine-header): expose mfr/year/edition + image to layout query (PP-5sgt.1)"`

### Task 2: Enriched identity cluster (chip + name + sub-line) — RTL first

**Files:**

- Modify: `src/components/machines/MachineDetailHeader.tsx`
- Test: `src/test/unit/components/MachineDetailHeader.test.tsx` (create)

**Interfaces:**

- Consumes: `MachineForLayout` from Task 1.
- Produces: a header whose sub-line renders `manufacturer · year · edition` joined by `·`, **omitting absent parts entirely** (no empty separators, no "null"). When all three are absent the sub-line element is not rendered.

- [ ] **Step 1: Write failing RTL tests.** Cover: (a) chip shows initials; (b) name renders; (c) sub-line shows "Stern · 2021 · Premium" when all present; (d) sub-line shows "Stern · 2021" when edition is null (no trailing separator); (e) **no sub-line element at all** when mfr+year+edition all null. Use a small helper that builds a `MachineForLayout` fixture.
- [ ] **Step 2: Run** `pnpm exec vitest run src/test/unit/components/MachineDetailHeader.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.** Build the identity cluster: chip (`bg`/`text-primary` family per design bible §1, matching the mockup's green tile), bold name (`text-2xl`/`text-3xl`, truncate), and a derived sub-line built by `[mfr, year, edition].filter(Boolean).join(" · ")` — render the `<p>` only when the joined string is non-empty. Match the markup/classes to `info-desktop.html` header zone.
- [ ] **Step 4: Run the RTL test** — expect PASS. Then `pnpm run check`.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-header): green chip + name + graceful mfr/year/edition sub-line (PP-5sgt.1)"`

### Task 3: Desktop translite block + chip-only fallback

**Files:**

- Modify: `src/components/machines/MachineDetailHeader.tsx`
- Test: extend `src/test/unit/components/MachineDetailHeader.test.tsx`

**Interfaces:**

- Consumes: `backboxImageUrl: string | null` from Task 1.
- Produces: when `backboxImageUrl` is present, a desktop-only figure with the image; when null, **nothing extra** (chip-only header). Mobile never renders the translite.

- [ ] **Step 1: Write failing tests.** (a) translite `<img>` present (with `alt`) when `backboxImageUrl` set; (b) **no** translite element when null; (c) translite container carries the desktop-only visibility class (`hidden md:block` or equivalent — assert the class).
- [ ] **Step 2: Run vitest** — expect FAIL.
- [ ] **Step 3: Implement** per design.md §2 + mockup: a `hidden md:flex` header row where identity is the left column and the translite is a **fixed-width box (≈300px at the relevant breakpoint) with the image absolutely positioned + `object-fit:cover`** — NOT height-driven width (that overflowed in prototyping; the fixed box is load-bearing). Flush to the card's right edge; spans the header+tab-strip height visually. Add the OPDB/PinballMap attribution caption. Guard the whole figure behind `backboxImageUrl != null`.
- [ ] **Step 4: Run vitest + `pnpm run check`** — expect PASS/green.
- [ ] **Step 5: Commit.** `git commit -am "feat(machine-header): desktop translite block with object-fit cover + chip-only fallback (PP-5sgt.1)"`

### Task 4: Wire into layout + smoke/overflow verification

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/layout.tsx` (already renders `MachineDetailHeader` — confirm no prop changes needed)
- Modify: `e2e/smoke/responsive-overflow.spec.ts` (ensure `/m/[initials]` is covered at 375px + 1024px)

- [ ] **Step 1: Confirm layout wiring** — header still receives `machine`; no structural change beyond the richer component.
- [ ] **Step 2: Verify overflow coverage.** Ensure the machine detail route is in `responsive-overflow.spec.ts`; add it if missing.
- [ ] **Step 3: Run** `pnpm run smoke` (or the targeted machine-detail spec) and the overflow spec — expect green at both widths, translite present on desktop, absent on mobile.
- [ ] **Step 4: Manual check (optional):** seed has Godzilla; load `/m/GZ` in `pnpm run dev` to eyeball against `info-desktop.html`.
- [ ] **Step 5: Commit.** `git commit -am "test(machine-header): overflow + smoke coverage for enriched header (PP-5sgt.1)"`

---

## Self-Review

- **Spec coverage (§2):** chip+name (Task 2), mfr/year/edition sub-line with omit-when-absent (Task 2), desktop translite fixed-width object-fit:cover (Task 3), chip-only fallback (Task 3), no translite on mobile (Task 3), data plumbing (Task 1), overflow (Task 4). ✓
- **Frame-first:** every PBM-sourced field degrades to empty/fallback (Tasks 1–3) so this ships before `PP-o355.2`. ✓
- **Gotcha locked in:** translite is a fixed-width box with absolutely-positioned `object-fit:cover` image — NOT `height:100%;width:auto` (that fell back to the 1099px natural width and blew out the page).
- **Column-name risk:** Task 1 explicitly says verify real schema names and select `null` for any PBM column that doesn't exist yet — no invented columns.

## Execution Handoff

When picked up: subagent-driven-development (fresh subagent per task, review between) is recommended. This plan must merge before `PP-5sgt.2`/`.3` (they depend on the shared header).
