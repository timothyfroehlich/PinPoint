# Tabbed Report Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **PinPoint override:** clear the multi-agent scale gate with Tim before dispatching build subagents (`pinpoint-superpowers-bridge` §3); finish via PR + `merge-pr.sh`, never a local merge.

**Goal:** Replace the standalone `/report/quick` "Quick" header button with a single **Report Issue** entry that opens a tabbed page — **Single issue** (the existing detailed form) and **Multiple** (the quick grid) — sharing entry #1's fields between the two views.

**Architecture:** A shared `report/layout.tsx` (Server Component) fetches machines + assignees once and renders a `"use client"` `ReportDraftProvider` + tab bar wrapping the two child routes (`/report` = Single, `/report/quick` = Multiple). The provider is the single source of truth for the **synced entry-#1 fields** and the grid's rows; both views read/write it, so switching tabs (a parent↔child route nav that does **not** remount the shared layout) preserves everything. View-specific state (reporter identity, CAPTCHA, images on Single) stays local to each view. Because the two tabs are never visible simultaneously, no live cross-component sync is needed — the store _is_ the shared state.

**Tech Stack:** Next.js App Router (nested layout + client context), React 19 (`useContext`, `useState`), Zod (unified draft schema), Vitest + RTL, Playwright (E2E). Existing helpers: `docIsEmpty` / `docToPlainText` / `plainTextToDoc` (`~/lib/tiptap/types`), `checkPermission` / `getAccessLevel` (`~/lib/permissions/helpers`).

## Global Constraints

- **CORE-ARCH-001/002:** `report/layout.tsx` and both pages stay Server Components; the provider, tab bar, single form, and grid are the only `"use client"` leaves. No progressive-enhancement regression — the single form keeps its `<form action={submitPublicIssueAction}>`; the grid keeps its server actions. Both are reused **unchanged** except the validation-message fold-in.
- **CORE-ARCH-008 (permissions):** the Multiple tab and all `/report/quick` access go through `checkPermission("issues.report.quick", …)`. Never gate on role strings directly.
- **CORE-SEC-007 (email privacy):** reporter email stays a single-form-only field; it never enters the shared store or the grid.
- **CORE-ARCH-011 / PP-2053 (idempotency):** entry #1 carries **one** idempotency key across both views. Submitting from either view uses that key so a cross-view resubmit can't double-create. Keys for grid rows ≥1 are per-row as today. Rotate entry #1's key only on a successful submit or an explicit Clear (mirroring both existing components).
- **CORE-TS-007:** ts-strictest — no `any`, no `!`, no unsafe `as`. `~/` path aliases only (CORE-TS-008).
- **Test tiers (CORE-TEST-005):** RTL for store/sync/lock logic; integration (PGlite + direct action) only where action wiring changes (it barely does); E2E for the tab journeys + deep-link + permission gating.
- **`localhost` not `127.0.0.1`** in any test URL (CORE-SEC-008). Escape parens in shell paths: `src/app/\(app\)/report/...`.
- **Tabs UI:** boxed style, icons on (`AlertCircle` = Single, `ListPlus` = Multiple), default Single. Follow `pinpoint-design-bible` for the tab archetype; reuse the existing shadcn/ui primitives already in the repo rather than a new dep.

---

## Task 1: Architecture spike — validate layout-persisted client state across `/report ↔ /report/quick`

**Rationale:** The entire design assumes a client context rendered in `report/layout.tsx` survives navigation between `/report` (Single) and `/report/quick` (Multiple) without remounting/resetting. `/report/quick` is nested **under** `/report`, so `/report/layout.tsx` wraps both — this _should_ hold, but it is load-bearing enough to prove before building on it. This task is a **throwaway spike**; its code is reverted before Task 2.

**Files:**

- Create (temp): `src/app/(app)/report/layout.tsx`, `src/app/(app)/report/_spike/spike-store.tsx`
- Reference: `src/app/(app)/report/page.tsx`, `src/app/(app)/report/quick/page.tsx`

- [ ] **Step 1: Write a throwaway client counter store in the layout**

Create `report/layout.tsx` rendering a `"use client"` provider with a `useState` counter and two `Link`s (`/report`, `/report/quick`) plus a live counter readout. Have each child page render a "+1" button wired to the context.

```tsx
// report/layout.tsx (SPIKE — reverted after this task)
import type React from "react";
import { SpikeProvider, SpikeReadout } from "./_spike/spike-store";

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpikeProvider>
      <SpikeReadout />
      {children}
    </SpikeProvider>
  );
}
```

```tsx
// report/_spike/spike-store.tsx (SPIKE)
"use client";
import * as React from "react";
import Link from "next/link";

const Ctx = React.createContext<{ n: number; inc: () => void } | null>(null);
export function SpikeProvider({ children }: { children: React.ReactNode }) {
  const [n, setN] = React.useState(0);
  return (
    <Ctx.Provider value={{ n, inc: () => setN((x) => x + 1) }}>
      {children}
    </Ctx.Provider>
  );
}
export function SpikeReadout() {
  const c = React.useContext(Ctx);
  return (
    <div>
      <b data-testid="spike-count">{c?.n}</b>
      <Link href="/report">Single</Link>
      <Link href="/report/quick">Multiple</Link>
      <button type="button" onClick={() => c?.inc()}>
        +1
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify persistence**

Run `pnpm run dev` (or reuse the running worktree dev server — check `pnpm run dev:status`). As a member+ user: click **+1** three times on `/report`, click the **Multiple** link, confirm `spike-count` still reads `3` (not `0`), click **+1** again → `4`, navigate back to **Single**, confirm `4`. Also hard-reload `/report/quick` directly and confirm the count resets to `0` (deep-link starts fresh — expected).

Expected: count persists across the `Link` navigation, resets only on full reload. **If it resets on navigation**, the shared-store-in-layout approach is invalid — STOP and consult Tim; the documented fallback is a single-route implementation with tab state + `history.replaceState` URL updates (record which was needed in the bead `--notes`).

- [ ] **Step 3: Record the result and revert the spike**

Note the outcome (pass/fail + which approach) in the bead PP-idrb `--notes`. Then delete `report/_spike/` and revert `report/layout.tsx` to nonexistent (`git rm`/`git checkout`), leaving a clean tree for Task 2.

- [ ] **Step 4: Commit the decision record only**

No spike code is committed. Commit is a one-liner amending the plan/bead if the fallback path was chosen. `git commit --allow-empty -m "chore(report): PP-idrb spike — layout state persists across tab nav (record)"` is acceptable as a marker, or fold into Task 2's first commit.

---

## Task 2: Unified draft schema + shared report store (`ReportDraftProvider`)

**Files:**

- Create: `src/app/(app)/report/report-draft-store.tsx` (provider + `useReportDraft` hook + types)
- Create: `src/app/(app)/report/report-draft-schema.ts` (Zod schema + legacy-migration for `localStorage`)
- Test: `src/app/(app)/report/report-draft-store.test.tsx`, `src/app/(app)/report/report-draft-schema.test.ts`

**Interfaces:**

- Produces:
  - `SharedEntry` — the synced fields for one issue: `{ machineId: string; title: string; description: ProseMirrorDoc | null; severity: IssueSeverity; priority: IssuePriority; status: IssueStatus; frequency: IssueFrequency; assignedTo: string; watch: boolean; idempotencyKey: string; }`
  - `SingleOnlyState` — `{ firstName: string; lastName: string; email: string; uploadedImages: ImageMetadata[]; }` (never synced to the grid; CORE-SEC-007).
  - `useReportDraft(): { entries: SharedEntry[]; single: SingleOnlyState; patchEntry(index, next): void; setEntries(fn): void; patchSingle(next): void; resetEntryZero(): void; clearAll(): void; contentRowCount: number; }` where `entries[0]` is entry #1 (the synced one) and `contentRowCount = entries.filter(hasContent).length` drives the lock.
- Consumes: `ImageMetadata` (`~/types/images`), issue enum types (`~/lib/types`), `ProseMirrorDoc` (`~/lib/tiptap/types`).

- [ ] **Step 1: Write the failing schema test**

`report-draft-schema.test.ts`: assert (a) a fresh draft round-trips through `serializeDraft`/`parseDraft`; (b) a **legacy** `report_form_state` payload (the current single-form shape — `machineId,title,description,severity,priority,frequency,watchIssue,firstName,lastName,email,idempotencyKey,uploadedImages`) migrates into `{ entries: [entry0], single }` with `entry0.watch` from `watchIssue` and `status` defaulted to `"new"`; (c) a corrupt/`undefined` payload returns `null` (caller clears storage), never throws.

```ts
it("migrates a legacy report_form_state draft into entry #1 + single-only", () => {
  const legacy = JSON.stringify({
    machineId: MACHINE_UUID,
    title: "Stuck flipper",
    severity: "major",
    priority: "high",
    frequency: "frequent",
    watchIssue: false,
    firstName: "Ada",
    email: "ada@x.com",
    idempotencyKey: KEY,
    uploadedImages: [],
  });
  const draft = parseDraft(legacy);
  expect(draft?.entries[0]).toMatchObject({
    machineId: MACHINE_UUID,
    title: "Stuck flipper",
    watch: false,
    status: "new",
    idempotencyKey: KEY,
  });
  expect(draft?.single).toMatchObject({ firstName: "Ada", email: "ada@x.com" });
});
```

- [ ] **Step 2: Run it — FAIL** (`parseDraft` not defined). `pnpm exec vitest run src/app/\(app\)/report/report-draft-schema.test.ts`.

- [ ] **Step 3: Implement `report-draft-schema.ts`**

Define `reportDraftSchema` (z.object with `version: z.literal(2)`, `entries: z.array(sharedEntrySchema).min(1)`, `single: singleOnlySchema`). `sharedEntrySchema` reuses the enum sets already in `report/quick/schemas.ts` and `report/schemas.ts` (import, don't re-declare — CORE-ARCH-010). `parseDraft(raw: string | null): ReportDraft | null` tries `JSON.parse` then `reportDraftSchema.safeParse`; **on failure, attempts the legacy migration** (`migrateLegacy(parsedJson)`) before giving up with `null`. Carry over the image-metadata hardening from `unified-report-form.tsx:322-334` (only keep rows with all required fields) so a malformed legacy draft can't poison submission. `serializeDraft(draft): string`.

- [ ] **Step 4: Run it — PASS.**

- [ ] **Step 5: Write the failing store test**

`report-draft-store.test.tsx` (RTL): render `<ReportDraftProvider machines={…} assignees={…}><Consumer/></ReportDraftProvider>`; assert `patchEntry(0, {title:"x"})` updates `entries[0].title`; `setEntries(rs => [...rs, blankEntry()])` appends; `contentRowCount` counts only entries with a machine or non-blank title; `clearAll()` resets to a single blank entry + empty single-only + a fresh entry[0] idempotency key; on mount it hydrates from a seeded `localStorage` draft; on change it persists (assert `localStorage.getItem("report_draft")` reflects the patch). Use a fake machine list so a restored `machineId` validates (mirror `unified-report-form.tsx:284` — drop a stale machineId).

- [ ] **Step 6: Run it — FAIL.**

- [ ] **Step 7: Implement `report-draft-store.tsx`**

`ReportDraftProvider` holds `entries` + `single` in `useState`, seeded lazily from `parseDraft(localStorage.getItem("report_draft"))` (guarded for SSR: initialize blank, hydrate in a mount `useEffect` with a `hasRestored` ref exactly like the current form). Persist on change via `useEffect` writing `serializeDraft` — **skip persistence after a successful submit** (a `justSubmitted` flag) to match `unified-report-form.tsx:345`. `blankEntry()` mints `crypto.randomUUID()` for both a React key (store-internal) and `idempotencyKey`. Provide the `useReportDraft` hook that throws if used outside the provider. Persist key is the **new** `"report_draft"`; on first hydrate also read+migrate+delete the legacy `"report_form_state"` if `"report_draft"` is absent.

- [ ] **Step 8: Run it — PASS.** Then `pnpm run check`.

- [ ] **Step 9: Commit.** `git add … && git commit -m "feat(report): unified report draft store + schema w/ legacy migration (PP-idrb)"`

---

## Task 3: `report/layout.tsx` — shared data fetch, provider, tab bar, permission gating

**Files:**

- Create: `src/app/(app)/report/layout.tsx` (Server Component)
- Create: `src/app/(app)/report/report-tabs.tsx` (`"use client"` boxed tab bar)
- Modify: `src/app/(app)/report/page.tsx`, `src/app/(app)/report/quick/page.tsx` (stop fetching machines/assignees themselves; consume from the provider via a client boundary — see Task 4/5)
- Test: `src/app/(app)/report/report-tabs.test.tsx`

**Interfaces:**

- `report/layout.tsx` fetches `machinesList` + `assignees` once (move the queries from the two pages — identical `db.query.machines.findMany` / userProfiles technician+ query), resolves `accessLevel`, and renders `<ReportDraftProvider machines assignees><ReportTabs canQuick={…}/>{children}</ReportDraftProvider>`.
- `ReportTabs` props: `{ canQuick: boolean }`. Reads `usePathname()` to mark the active tab; reads `useReportDraft().contentRowCount` for the lock (Task 6). Renders the Single tab always; the Multiple tab only when `canQuick`.

- [ ] **Step 1: Write the failing tab-bar test**

`report-tabs.test.tsx`: with `canQuick=true` and pathname `/report`, Single tab has `aria-current="page"` / active styling and Multiple does not; both are links (`/report`, `/report/quick`) with the right icons and labels ("Single issue", "Multiple"). With `canQuick=false`, the Multiple tab is absent. (Lock behavior is Task 6.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `report-tabs.tsx`** as boxed tabs using existing UI primitives + `next/link`, `usePathname`, `AlertCircle`/`ListPlus`. Real `<a>`/`<button>` (CORE-A11Y-004), `aria-current` on the active tab.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Implement `report/layout.tsx`** — move the machine/assignee/accessLevel fetch here (delete from the pages in Tasks 4/5). Keep `export const dynamic = "force-dynamic"` semantics that the pages currently rely on (set on the layout or keep on pages). Provider wraps `{children}`.

- [ ] **Step 6:** `pnpm run check` + `pnpm run smoke` (renders without 500). Commit: `feat(report): shared report layout with tab bar + one-shot data fetch (PP-idrb)`.

---

## Task 4: Bind the Single form's entry-#1 fields to the store

**Files:**

- Modify: `src/app/(app)/report/unified-report-form.tsx` (source the 9 synced fields from `useReportDraft().entries[0]`; keep identity/CAPTCHA/images/recent-issues local)
- Modify: `src/app/(app)/report/page.tsx` (render the form inside the provider; drop its own machine/assignee fetch + draft effects that Task 2 absorbed)
- Test: extend `src/app/(app)/report/unified-report-form.test.tsx`

**Interfaces:**

- Consumes `useReportDraft`: replace the local `useState` for `selectedMachineId, title, description, severity, priority, status, frequency, assignedTo, watchIssue, idempotencyKey` with reads of `entries[0]` and writes via `patchEntry(0, …)`. Move `firstName/lastName/email/uploadedImages/turnstileToken` reads to `single` (`patchSingle`) — these persist in the unified draft but never sync to the grid.
- The two localStorage effects (restore on mount, save on change) and the legacy-migration block in `unified-report-form.tsx:243-386` are **deleted** — the provider owns persistence now.

- [ ] **Step 1: Write/adjust failing tests** — assert typing a title updates the store (`entries[0].title`); switching machine updates `entries[0].machineId`; the idempotency hidden input value equals `entries[0].idempotencyKey`; on successful submit the store's entry[0] resets and mints a fresh key (the success `useEffect` now calls `resetEntryZero()` instead of the local setters). Keep the existing PP-lql stale-machine and PP-2053 image tests green (images stay in `single`).

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Refactor `unified-report-form.tsx`.** Swap local state for store reads/writes; delete the two persistence effects + legacy migration + the `report_form_state` removals (the provider's `clearAll`/`resetEntryZero` replace them). Keep: `useActionState`, the hidden inputs, CAPTCHA, images, recent-issues sidebar, the Clear dialog (now calls `resetEntryZero()` + `patchSingle(blankSingle())`). Preserve the URL `?machine=` sync behavior.

- [ ] **Step 4: Run — PASS.** `pnpm run check`.

- [ ] **Step 5: Commit.** `refactor(report): single form sources entry #1 from shared store (PP-idrb)`

---

## Task 5: Bind the grid to the store (row 0 = entry #1) + rich-text description

**Files:**

- Modify: `src/app/(app)/report/quick/quick-report-grid.tsx` (rows come from `useReportDraft().entries`; row 0 is entry #1; expanded row swaps `<Textarea>` for the shared `RichTextEditor`)
- Modify: `src/app/(app)/report/quick/page.tsx` (render grid inside provider; drop own fetch)
- Modify: `src/app/(app)/report/quick/actions.ts` + `schemas.ts` (accept a ProseMirror description, not plain text — see below)
- Test: extend `src/app/(app)/report/quick/quick-report-grid.test.tsx`

**Interfaces:**

- The grid's `RowState` is replaced by the store's `SharedEntry` plus grid-local UI flags (`open`, `submitting`, `submitted`, `error`) held in a parallel local map keyed by entry index/id (UI flags don't belong in the shared draft). Row 0 renders the same, but its synced fields are the store's `entries[0]` — so a title typed on the Single tab already appears here.
- **Description becomes ProseMirror** to match the single form (spec §4). `quick/schemas.ts` `description` changes from `z.string()` to the ProseMirror doc shape (reuse the single form's `description` validation / `ProseMirrorDoc`); `quick/actions.ts` `createOne` stops calling `plainTextToDoc` and passes the doc straight through, routing an empty editor to `null` via `docIsEmpty` (spec §4 empty-editor handling). Update `quick-report-action.test.ts` + `validation.test.ts` accordingly.

- [ ] **Step 1: Failing tests** — (a) grid renders `entries` from the store; editing row 0's title reflects in `entries[0]`; (b) expanded row shows the rich editor and an empty editor submits `description: null`; (c) `parseQuickRow` accepts a ProseMirror doc and rejects a bare string; (d) existing submit/idempotency/ready-count tests still pass against the store-backed rows.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — refactor the grid to read `entries` + `patchEntry`/`setEntries` from the store; keep the UI-flag map local; swap the description control to `RichTextEditor` (dynamic import as the single form does) in the expanded row; update `schemas.ts`/`actions.ts`/validation to the doc-shaped description with `docIsEmpty` → `null`.

- [ ] **Step 4: Run — PASS.** `pnpm run check` + targeted integration `pnpm exec vitest run src/test/integration/quick-report-action.test.ts`.

- [ ] **Step 5: Commit.** `feat(report): grid shares entry #1 with single form + rich-text description (PP-idrb)`

---

## Task 6: The one lock — 2+ content rows disables the Single tab

**Files:**

- Modify: `src/app/(app)/report/report-tabs.tsx`
- Test: extend `report-tabs.test.tsx`

**Interfaces:**

- `ReportTabs` reads `contentRowCount` from the store. When `contentRowCount >= 2`, the **Single** tab is disabled: rendered as a non-navigating `<button>` (not a `Link`) with `aria-disabled` + a lock cue; **tapping it** (works on touch, no hover) toggles a one-line reason rendered directly under the tab bar: _"You're logging several issues — remove the extras to go back to a single report."_ (spec §5 approved copy). Dropping back to one content row re-enables it immediately (derived, no extra state beyond the "reason visible" toggle, which auto-hides when re-enabled).

- [ ] **Step 1: Failing test** — with a store seeded to 2 content rows, the Single tab is `aria-disabled`, does not navigate on click, and clicking reveals the exact reason string; seeded to 1 content row, Single is enabled and the reason is absent.

- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.** **Step 4: Run — PASS.**

- [ ] **Step 5: Commit.** `feat(report): disable Single tab while multiple issues are drafted (PP-idrb)`

---

## Task 7: Collapse header/nav to a single "Report Issue" entry

**Files:**

- Modify: `src/components/layout/AppHeader.tsx` (remove the separate `nav-quick-report` "Quick" button added in #1667; keep the single "Report Issue" button → `/report`)
- Modify: `src/components/layout/BottomTabBar.tsx` (the "Quick report" more-sheet entry now points at `/report/quick` = Multiple tab; label stays "Quick report" or "Multiple" — settle with Tim if unsure, default "Quick report")
- Modify: `next.config.ts` (keep the `/rq` shortlink → `/report/quick`; unchanged)
- Test: extend `src/components/layout/AppHeader.test.tsx` if present (assert no second report button)

- [ ] **Step 1: Failing/adjusted test** — AppHeader renders exactly one report entry point; the `nav-quick-report` test id is gone. **Step 2: FAIL. Step 3: Remove the button + import. Step 4: PASS.**

- [ ] **Step 5:** `pnpm run check`. Commit: `feat(nav): single Report Issue entry; quick report lives in the tabbed page (PP-idrb)`

---

## Task 8: Anonymous gating + redirects

**Files:**

- Modify: `src/app/(app)/report/layout.tsx` (render the tab bar only when `canQuick`; anon/guests see the Single form with no tab chrome)
- Modify: `src/app/(app)/report/quick/page.tsx` (already redirects non-permitted → `/report`; confirm it still holds under the layout)
- Test: `report-tabs.test.tsx` (no tabs when `canQuick=false`) + an E2E in Task 9

- [ ] **Step 1: Failing test** — `canQuick=false` → `ReportTabs` renders nothing (or just a plain heading), no Multiple tab, no lock affordance. **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5:** confirm `/report/quick` still redirects anon (existing `page.tsx` guard). Commit: `feat(report): anonymous reporters get single form only (PP-idrb)`

---

## Task 9: Fold-in fix + E2E journeys

**Files:**

- Modify: `src/app/(app)/report/validation.ts` (drop the `` `${field}: ${message}` `` prefix — mirror `quick/validation.ts`; spec §7)
- Modify: `src/app/(app)/report/validation.test.ts` (assert plain message, no field-name leak)
- Create: `e2e/full/report-tabbed.spec.ts` (targeted) + a smoke assertion in `e2e/smoke/`
- Reference: existing `e2e/full/quick-report.spec.ts`, `e2e/smoke/quick-report.spec.ts`

- [ ] **Step 1: validation fold-in (TDD)** — failing test asserting `report/validation.ts` returns `"Please select a machine"` (no `machineId:` prefix); implement; pass.

- [ ] **Step 2: E2E (member+):** `/report` opens on Single; typing machine+title then clicking the **Multiple** tab shows the same machine+title in row 1; adding a 2nd content row disables the Single tab and clicking it reveals the reason; removing the 2nd row re-enables Single; deep-link `/report/quick` opens on Multiple; back/forward keeps the right tab active. Assert **no** duplicate issue when submitting entry #1 from one view after touching it in the other (idempotency).

- [ ] **Step 3: E2E (anon):** `/report` shows the single form with no tabs; visiting `/report/quick` redirects to `/report`.

- [ ] **Step 4:** run locally `pnpm exec playwright test e2e/full/report-tabbed.spec.ts --project=chromium`; keep smoke green (`pnpm run smoke`). Full suite is CI's job.

- [ ] **Step 5: Commit.** `test(report): tabbed page E2E + validation fold-in (PP-idrb)`

---

## Task 10: Spec reconciliation + design-bible + landing

**Files:**

- Modify: `pinpoint-design-bible` (§5 page archetypes / §17 modal archetypes) if the tabbed report page introduces a new archetype — **edit the canonical spec in place** (AGENTS.md §8), don't append divergence notes.
- Modify: the design spec's §8 to state the **final** architecture chosen (from the Task 1 spike outcome).

- [ ] **Step 1:** update design-bible + spec §8 to match what shipped. **Step 2:** `pnpm run preflight` (this PR touches server actions + a schema shape + middleware-adjacent routing — non-trivial, so preflight, not just check). **Step 3:** push, open PR ready-for-review, let CI run. **Step 4:** address Copilot/Claude review, merge via `scripts/workflow/merge-pr.sh`, watch the prod deploy, close **PP-idrb** after merge.

---

## Self-review notes

- **Spec coverage:** header collapse (T7), tabbed deep-linkable page (T3), synced entry #1 both directions (T4/T5), rich-text on grid + empty→null (T5), 2+-rows lock with approved copy (T6), anon single-only + redirect (T8), validation fold-in (T9), unified draft persistence + legacy migration (T2), idempotency across the shared entry (global constraint + T4/T5 + T9 E2E). All §12 acceptance criteria map to a task.
- **Hard part isolated:** the store (T2) and the two bindings (T4/T5) carry the risk; the spike (T1) de-risks the core assumption before any of it is built.
- **Type consistency:** `SharedEntry`/`SingleOnlyState`/`useReportDraft` names are used identically across T2→T5. Description is ProseMirror end-to-end after T5 (schema + action + both views).
- **Reuse:** enum sets and image-hardening are imported from existing files, not re-declared (CORE-ARCH-010). `docIsEmpty`/`RichTextEditor`/`MachineCombobox`/field selects reused as-is.
