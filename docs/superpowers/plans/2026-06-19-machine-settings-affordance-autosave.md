# Machine Settings — auto-save + editable-affordance redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Machine Settings tab's per-unit "Edit / Save / Cancel" model with always-live inputs that auto-save, and give every editable field a clear resting affordance (pure-black inset box + 1px border + hover text-glow + focus ring), so editable fields obviously look editable on desktop and touch.

**Architecture:** Today `SettingsTab` runs an _atomic per-unit commit_ engine — a working copy + a committed baseline, per-unit edit state (`editingUnits`/`savingUnits`/`unitErrors`), and per-unit Save that merges one unit's slice onto the baseline. The pivot **deletes that engine**: with always-live fields there are no "units" and no slice isolation to protect, because every change is committed continuously. What remains is far simpler — one working copy, a debounced whole-row auto-save through the existing coalescing `useSettingsSaveQueue`, and a page-level failure banner + navigation guard that only appears when a save fails. The affordance is a new `glow-editable` utility applied uniformly to the now-always-live leaf inputs.

**Tech Stack:** Next.js App Router (React 19, Server Components default), TypeScript ts-strictest, Tailwind v4 (`@theme` + `@utility` in `src/app/globals.css`, semantic tokens, no `dark:`), shadcn/ui, Drizzle/Supabase (unchanged — jsonb whole-row persist, **no migration**), Vitest + RTL + PGlite integration, `~/` path aliases.

> **Revised 2026-06-19 after a 3-reviewer adversarial pass** (architecture/data-loss, spec-coverage, codebase-accuracy). Material changes baked in below: payload is staged at the call site to preserve mid-save change detection (C1); the three structural-op call sites are enumerated (H1); rich-text auto-save is **debounce-only** — `RichTextEditor` has no `onBlur` (H2); the bug-#6 fix is a **`key` bump** — no imperative `setContent` exists (C2); the nav guard merges machine-level-field state through one `saveStatus` (H3); `beforeunload` flush reframed as best-effort, the nav guard is the real protection (H4); **auto-retry** added (spec §C.2); `--project` flags on all test commands; added viewer-state/affordance tests.

## Global Constraints

These apply to **every** task. Copied from the design doc (`docs/superpowers/specs/2026-06-19-machine-settings-affordance-autosave-design.md`) and AGENTS.md §2.

- **Work in THIS worktree** (`.claude/worktrees/agent-abe71d6b68d9c0273`), branch `feat/machine-settings-tab-scaffold-PP-43q3`. The main checkout is on `main` and lacks these files.
- **Commit each task locally. Do NOT push, do NOT merge, do NOT `bd dolt push`** without Tim's explicit per-time say-so. Never `--no-verify`.
- **`pnpm run check` is the floor before every commit** (~12s). Any change to `settings/actions.ts` also runs `pnpm run preflight` (it touches server actions). No DB migration is expected (jsonb schema unchanged) — if a task thinks it needs one, STOP and escalate.
- **Test commands use the project flag** to match `package.json`/`vitest.config.ts`: unit → `pnpm vitest run --project unit <path>`; integration → `pnpm vitest run --project integration <path>`. (Bare `pnpm vitest run <path>` misfires for integration specs.)
- **`aria-sort` is N/A here** — the settings tables are not sortable, so `<th scope="col">` + accessible name satisfy CORE-A11Y; do **not** add `aria-sort`. (Recorded so the omission is intentional, not an oversight — flagged by review.)
- **Do not touch other sessions' files:** `src/server/db/index.ts` (PP-d8l8), `src/services/issues.ts` (PP-qk7s). Claude-PinballMapLinking is in `schema.ts` + `m/` create/edit forms + permission matrix — none of our files, but if a merge surfaces a conflict there, escalate.
- **CORE non-negotiables:** `"use client"` only on interaction leaves (CORE-ARCH-001); ts-strictest — no `any`/`!`/unsafe `as` (CORE-TS-007); `~/` aliases (CORE-TS-008); semantic tokens only, no `dark:` (CORE-RESP/design-bible); CORE-A11Y (real `<button>`, `<th scope>`+`aria-sort`, `motion-reduce:` on every animation incl. the glow fade, `inert` on background when a dialog/sheet is open, no hover-only controls on touch); CORE-FORM (`enterkeyhint`, `:user-invalid`/`aria-invalid` on blur, visible required indicators); CORE-RESP — CSS over JS, the `use-is-mobile` split is the **sanctioned** exception (PP-43q3).
- **Auto-save is JS-driven**, which does not satisfy CORE-ARCH-002 progressive-enhancement forms. The mitigation (already true today): the **read view SSRs** without JS; editing requires JS. Keep server actions as the persistence layer. Note this explicitly in the PR description as a sanctioned exception, the same way the current code already relies on JS to edit.
- **Throwaway:** never commit `playground-editable-affordance.html` (worktree root).

---

## Slicing decision (read before executing)

**This ships as ONE PR (the existing PR #1388 branch), not multiple.** I evaluated splitting wave 1 and concluded it cannot be cleanly sliced into smaller _complete_ features:

- **Affordance and always-live are mutually dependent.** Always-live inputs _without_ the affordance reintroduce exactly the cluttered "open editors" look Tim rejected ("the thing I didn't like… was mostly the look of the open editors"). The affordance _without_ always-live has nothing to attach to (today fields are only inputs while their unit is in edit mode). They must land together.
- **A mixed save model is worse than either.** Shipping "sets auto-save but the two machine-level fields still have Save buttons" (or vice-versa) is a visibly half-migrated tab. Auto-save must be uniform.
- **The peripheral fixes are too small for their own PRs** (Tim's "no slivers" rule): bug #6 (preset replace), the mobile keyboard fix, and the delete-affordance redesign each touch the same components and are individually sub-PR-sized.

So the work is **one coherent feature** ("Machine Settings auto-save redesign"), sequenced internally as the tasks below with a review gate after each. The one genuinely atomic step is the pivot itself (Task 6) — the leaf↔card↔tab prop-semantics change won't compile partway, so it is deliberately a single task.

**Task dependency shape:**

```
T1 affordance utility ─┐
T2 debounce helper ────┼─► T6 THE PIVOT ─► T7 delete ─► T8 empty-row ─► T9 mobile sheet ─► T10 machine fields+bug#6 ─► T11 final
T3 failure banner ─────┘        (atomic)
T4 leaf affordance  ───► folded into T6 (they must compile together)
T5 (removed — folded)
```

T1–T3 are independent, additive, and compile on their own (new code, not yet wired). T6 is the atomic pivot that wires them in and removes the old engine. T7–T10 layer on top, each independently testable.

---

## Task 1: The `glow-editable` affordance utility + design-bible §2 amendment

**Files:**

- Modify: `src/app/globals.css` (add a `@utility` after the existing `glow-success`, ~line 111)
- Modify: `.agents/skills/pinpoint-design-bible/SKILL.md` (§2 glow rule — amend in place)
- Create: `src/components/machines/settings/affordance.ts` (shared class constants)

**Interfaces:**

- Produces: `EDITABLE_FIELD_CLASS` (string) and `EDITABLE_TEXT_CLASS` (string) exported from `~/components/machines/settings/affordance`, consumed by Tasks 6 & 10's leaf components.

**Context for the implementer:** The affordance is LOCKED (Tim reviewed it rendered in a playground). At rest an editable field shows a **pure-black (`#000`) inset fill box** with a **1px `outline`-colored border** and a **3px `ring/50` focus ring**; on hover (desktop only — pointer:fine) the value text gains a **primary-green neon `text-shadow` that fades in** (~0.3s). The black box + border + text is the cue on touch (no hover dependence); the glow is desktop delight. This mirrors the existing `text-link` utility's hover-text-shadow pattern (`globals.css:113`). The glow is an **interactivity affordance**, not decorative — that distinction is the design-bible amendment.

- [ ] **Step 1: Add the `glow-editable` text-glow utility to `globals.css`**

After the `glow-success` block (line 111), before `text-link` (line 113), add:

```css
/* Editable-field affordance (PP-43q3): a primary-green neon text-shadow that
   fades IN on hover, signalling "you can edit this". Desktop delight only —
   the box+border+text carries the cue on touch (no hover). Distinct from the
   decorative glow-* box-shadows above; this glows the VALUE TEXT to mark
   interactivity. motion-reduce disables the transition (CORE-A11Y). */
@utility glow-editable-text {
  transition: text-shadow 0.3s ease;
  @media (hover: hover) {
    &:hover {
      text-shadow:
        0 0 10px color-mix(in srgb, var(--color-primary) 55%, transparent),
        0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
```

- [ ] **Step 2: Add the shared class constants**

Create `src/components/machines/settings/affordance.ts`:

```ts
/**
 * Shared resting-affordance classes for editable Machine Settings fields
 * (PP-43q3). An editable field signals editability at rest with a pure-black
 * inset fill box, a 1px outline border, a hover text-glow (desktop delight,
 * see `glow-editable-text` in globals.css), and a bright focus ring. Identical
 * on desktop and touch (the box+border carries the cue without hover).
 * Read-only viewers never get these — they render clean static text.
 */

/** Applied to the <input>/<button>/editor box itself. Pure-black fill reads on
 *  BOTH the tinted header band (muted #27272a) and the card body (#18151b),
 *  solving the "shade works on one bg not the other" problem. */
export const EDITABLE_FIELD_CLASS =
  "bg-black border border-outline rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Applied to the value TEXT inside the box so it picks up the hover glow. */
export const EDITABLE_TEXT_CLASS = "glow-editable-text";
```

- [ ] **Step 3: Amend the design-bible §2 glow rule in place**

In `.agents/skills/pinpoint-design-bible/SKILL.md`, find the §2 rule banning glow on form controls. Replace its prohibition with the scoped version (do NOT append a divergence note — edit the canonical text):

> Glow is permitted **as an interactivity affordance on editable fields** — a text-glow that fades in on hover marks "you can edit this" (`glow-editable-text`, PP-43q3). This is distinct from decorative glow on arbitrary form controls, which remains banned. Editable Machine Settings fields use it via `~/components/machines/settings/affordance`.

Quote the exact pre-existing rule text in your commit message so the reviewer can confirm the swap is faithful.

- [ ] **Step 4: Verify the CSS compiles and the constants type-check**

Run: `pnpm run check`
Expected: PASS (lint/types/format clean). The `@utility` is build-time Tailwind v4 — a passing `check` confirms it parses.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/machines/settings/affordance.ts .agents/skills/pinpoint-design-bible/SKILL.md
git commit -m "feat(machine-settings): glow-editable affordance utility + design-bible §2 amendment (PP-43q3)"
```

---

## Task 2: Debounced auto-save helper

**Files:**

- Create: `src/components/machines/settings/use-auto-save.ts`
- Test: `src/test/unit/components/machines/use-auto-save.test.ts`

**Interfaces:**

- Consumes: nothing (wraps a caller-supplied `persist` fn).
- Produces: `useAutoSave(persist: (id: string) => void): { schedule(id): void; flush(id): void; flushAll(): void; cancel(id): void }`. Task 6 wires `persist` to `saveQueue.persist`.

**Context:** The existing `useSettingsSaveQueue` (`use-settings-save-queue.ts`) already coalesces overlapping saves per set and handles temp→real id rekey — keep it unchanged. This helper adds the _trigger timing_ on top: text edits debounce ~800ms; blur/toggle flush immediately. It must be referentially stable (refs, not state) and clear timers on unmount.

- [ ] **Step 1: Write the failing test**

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "~/components/machines/settings/use-auto-save";

describe("useAutoSave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces schedule() to one persist after 800ms of quiet", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("a");
      result.current.schedule("a");
    });
    expect(persist).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(800));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("a");
  });

  it("flush() persists immediately and cancels the pending debounce", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.flush("a");
    });
    expect(persist).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(800));
    expect(persist).toHaveBeenCalledTimes(1); // no double-fire
  });

  it("tracks debounce timers per id independently", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
      vi.advanceTimersByTime(800);
    });
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("flushAll() flushes every pending id", () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useAutoSave(persist));
    act(() => {
      result.current.schedule("a");
      result.current.schedule("b");
      result.current.flushAll();
    });
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/test/unit/components/machines/use-auto-save.test.ts`
Expected: FAIL ("useAutoSave is not a function" / module not found).

- [ ] **Step 3: Implement the helper**

```ts
"use client";

import { useCallback, useEffect, useRef } from "react";

const DEBOUNCE_MS = 800;

/**
 * Auto-save trigger timing for the Machine Settings editor (PP-43q3). Sits on
 * top of `useSettingsSaveQueue` (which coalesces + serializes the actual
 * whole-row writes): text edits `schedule()` a debounced persist; blur and
 * toggles `flush()` immediately. Per-id timers so editing two sets at once
 * doesn't cross-cancel. Timers live in a ref (no render output) and are cleared
 * on unmount.
 */
export function useAutoSave(persist: (id: string) => void): {
  schedule: (id: string) => void;
  flush: (id: string) => void;
  flushAll: () => void;
  cancel: (id: string) => void;
} {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Hold persist in a ref so the returned callbacks stay referentially stable.
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const cancel = useCallback((id: string): void => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const flush = useCallback(
    (id: string): void => {
      cancel(id);
      persistRef.current(id);
    },
    [cancel]
  );

  const schedule = useCallback(
    (id: string): void => {
      cancel(id);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          persistRef.current(id);
        }, DEBOUNCE_MS)
      );
    },
    [cancel]
  );

  const flushAll = useCallback((): void => {
    for (const id of [...timers.current.keys()]) flush(id);
  }, [flush]);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    []
  );

  return { schedule, flush, flushAll, cancel };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/components/machines/use-auto-save.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/settings/use-auto-save.ts src/test/unit/components/machines/use-auto-save.test.ts
git commit -m "feat(machine-settings): debounced auto-save trigger helper (PP-43q3)"
```

---

## Task 3: Save-failure banner + navigation guard

**Files:**

- Create: `src/components/machines/settings/SaveFailureBanner.tsx`
- Create: `src/components/machines/settings/use-save-status.ts`
- Test: `src/test/unit/components/machines/use-save-status.test.ts`
- Test: `src/test/unit/components/machines/SaveFailureBanner.test.tsx`

**Interfaces:**

- Produces:
  - `useSaveStatus(): { failedIds: Set<string>; pending: boolean; markPending(id): void; markSaved(id): void; markFailed(id): void; hasUnsaved: boolean }`
  - `<SaveFailureBanner failedCount={number} onRetry={() => void} />`
- Consumed by Task 6's `SettingsTab`.

**Context:** There is **no existing `FieldSaveStatus`/`use-field-save-status`** (the design doc was wrong — this is net-new; confirmed by review). Feedback is **failure-only**: no "Saved ✓". When any save is in flight (`pending`) or has failed (`failedIds`), navigation must be guarded; when a save fails, a Google-Docs-style banner appears with a Retry. Replaces the per-unit error display and repurposes the existing `useUnsavedChangesGuard` (currently in `SettingsTab.tsx:152`) to key off this status instead of per-unit dirtiness.

> **Auto-retry (spec §C.2)** is wired in the SettingsTab failure handler (Task 6 Step 9), not here — `useSaveStatus` only tracks state; the one-shot retry timer lives with the save wiring. The banner copy (Step 6) is written to be honest in both the auto-retry window and after it's exhausted.

- [ ] **Step 1: Write the failing test for `use-save-status`**

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSaveStatus } from "~/components/machines/settings/use-save-status";

describe("useSaveStatus", () => {
  it("marks pending then clears on saved", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markPending("a"));
    expect(result.current.pending).toBe(true);
    expect(result.current.hasUnsaved).toBe(true);
    act(() => result.current.markSaved("a"));
    expect(result.current.pending).toBe(false);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("records a failure and surfaces it until re-saved", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markPending("a"));
    act(() => result.current.markFailed("a"));
    expect(result.current.failedIds.has("a")).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.hasUnsaved).toBe(true);
    act(() => result.current.markSaved("a"));
    expect(result.current.failedIds.has("a")).toBe(false);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("re-pending a failed id keeps hasUnsaved true and clears the failure on success", () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => {
      result.current.markFailed("a");
      result.current.markPending("a"); // retry
    });
    expect(result.current.failedIds.has("a")).toBe(false);
    expect(result.current.pending).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/test/unit/components/machines/use-save-status.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `use-save-status.ts`**

```ts
"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Page-level save status for the auto-saving Machine Settings editor (PP-43q3).
 * Feedback is FAILURE-ONLY — there is no "Saved ✓" state. Tracks which sets
 * have a save in flight (`pending`) and which last failed (`failedIds`), so the
 * tab can show a single Google-Docs-style banner and arm a navigation guard
 * while anything is unsaved. Set ids here are the CURRENT id (temp id until a
 * new set's first insert swaps it).
 */
export function useSaveStatus(): {
  failedIds: Set<string>;
  pending: boolean;
  markPending: (id: string) => void;
  markSaved: (id: string) => void;
  markFailed: (id: string) => void;
  hasUnsaved: boolean;
} {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

  const markPending = useCallback((id: string): void => {
    setPendingIds((p) => new Set(p).add(id));
    // A retry clears the prior failure optimistically; markFailed re-adds it.
    setFailedIds((p) => {
      if (!p.has(id)) return p;
      const next = new Set(p);
      next.delete(id);
      return next;
    });
  }, []);

  const markSaved = useCallback((id: string): void => {
    setPendingIds((p) => removeFrom(p, id));
    setFailedIds((p) => removeFrom(p, id));
  }, []);

  const markFailed = useCallback((id: string): void => {
    setPendingIds((p) => removeFrom(p, id));
    setFailedIds((p) => new Set(p).add(id));
  }, []);

  const pending = pendingIds.size > 0;
  const hasUnsaved = pending || failedIds.size > 0;

  return useMemo(
    () => ({
      failedIds,
      pending,
      markPending,
      markSaved,
      markFailed,
      hasUnsaved,
    }),
    [failedIds, pending, markPending, markSaved, markFailed, hasUnsaved]
  );
}

function removeFrom(prev: Set<string>, id: string): Set<string> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/components/machines/use-save-status.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Write the banner render test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaveFailureBanner } from "~/components/machines/settings/SaveFailureBanner";

describe("SaveFailureBanner", () => {
  it("renders nothing when there are no failures", () => {
    const { container } = render(
      <SaveFailureBanner failedCount={0} onRetry={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an alert with a working Retry when there are failures", async () => {
    const onRetry = vi.fn();
    render(<SaveFailureBanner failedCount={2} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run it to verify it fails, then implement `SaveFailureBanner.tsx`**

Run: `pnpm vitest run src/test/unit/components/machines/SaveFailureBanner.test.tsx`
Expected: FAIL (module not found). Then implement:

```tsx
"use client";

import type React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "~/components/ui/button";

interface SaveFailureBannerProps {
  /** How many sets currently have a failed save. 0 → render nothing. */
  failedCount: number;
  onRetry: () => void;
}

/**
 * Page-level, failure-only save banner for the Machine Settings editor
 * (PP-43q3). Auto-save shows NO success state; this appears only when a save
 * fails, mirroring Google Docs' "couldn't save" affordance. The typed text is
 * never dropped — the working copy keeps it and Retry re-enqueues the write.
 * Sits sticky at the top of the tab. role="alert" announces it (CORE-A11Y).
 */
export function SaveFailureBanner({
  failedCount,
  onRetry,
}: SaveFailureBannerProps): React.JSX.Element | null {
  if (failedCount <= 0) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Some changes couldn&apos;t be saved. Your edits are still here — retry
        to save them.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="shrink-0"
      >
        Retry
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Run both tests, then `pnpm run check`**

Run: `pnpm vitest run src/test/unit/components/machines/use-save-status.test.ts src/test/unit/components/machines/SaveFailureBanner.test.tsx`
Expected: PASS. Then `pnpm run check` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/machines/settings/SaveFailureBanner.tsx src/components/machines/settings/use-save-status.ts src/test/unit/components/machines/use-save-status.test.ts src/test/unit/components/machines/SaveFailureBanner.test.tsx
git commit -m "feat(machine-settings): failure-only save banner + status hook (PP-43q3)"
```

---

## Task 4: Action audit — confirm whole-row auto-save is safe (no code change expected)

**Files:**

- Review only: `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts` (`saveSettingsSetAction` at line 114)
- Test: `src/test/integration/machine-settings-actions.test.ts` (add cases if a gap is found)

**Context:** Auto-save will call `saveSettingsSetAction` far more often (every blur + debounce tick) than the old per-unit Save did. Before the pivot relies on it, confirm: (a) it's idempotent for an unchanged whole-row payload (returns `changed: false`, no spurious write), (b) it handles rapid successive calls for the same set safely (the queue serializes, but verify no server-side assumption breaks), (c) the byte-size accounting and name-cap logic don't reject a normal payload. This is a **verification task** — only write code if you find a real gap.

- [ ] **Step 1: Read `saveSettingsSetAction` and its no-op guard**

Read `actions.ts:114` through the end of `saveSettingsSetAction`. Confirm it compares incoming vs stored (the design doc references an `isDeepStrictEqual` no-op tuple) and returns a `changed` flag. Note whether an unchanged payload short-circuits before the DB write.

- [ ] **Step 2: Run the existing integration suite to confirm green baseline**

Run: `pnpm vitest run --project integration src/test/integration/machine-settings-actions.test.ts`
Expected: PASS (current behavior intact).

- [ ] **Step 3: Add a coalesced-save round-trip test IF missing**

If there's no test asserting "saving the same payload twice produces one logical change / no error," add one (mirror the existing fixtures in that file). If coverage already exists, note that and skip.

- [ ] **Step 4: Commit (only if step 3 added a test)**

```bash
git add src/test/integration/machine-settings-actions.test.ts
git commit -m "test(machine-settings): cover idempotent whole-row save for auto-save (PP-43q3)"
```

If no change was needed, record "no gap found — action is auto-save-safe" in the task notes and proceed. **Do not** invent a change.

---

## Task 5: Empty-row pruning helper

**Files:**

- Create: `src/components/machines/settings/prune-empty-rows.ts`
- Test: `src/test/unit/components/machines/prune-empty-rows.test.ts`

**Interfaces:**

- Produces: `pruneEmptyRows(section: SettingsSection): SettingsSection` and `rowIsEmpty`/`switchIsEmpty` predicates. Consumed by Task 6 (called on blur / before a save flush).

**Context (bug #4b):** New rows must not persist until they have content, and a **fully-empty** row (every field blank) is pruned. The guard must check the _whole_ row — a row with an id but no name/value is NOT empty. Applies to `software`/`table` rows (`id`+`name`+`value`) and `dip` switches (`switch`+`note`; `position` defaults to "OFF" so it doesn't count as content). Note sections and titles are not rows — out of scope here.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { pruneEmptyRows } from "~/components/machines/settings/prune-empty-rows";
import type { SettingsSection } from "~/lib/machines/settings-types";

const software = (
  rows: { _key: string; id: string; name: string; value: string }[]
): SettingsSection => ({
  id: "s1",
  kind: "software",
  baseline: "Factory Install",
  rows,
});

describe("pruneEmptyRows", () => {
  it("drops a fully-empty software row", () => {
    const out = pruneEmptyRows(
      software([
        { _key: "1", id: "", name: "", value: "" },
        { _key: "2", id: "A.1", name: "Balls", value: "3" },
      ])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(1);
    expect(out.kind === "software" && out.rows[0]?._key).toBe("2");
  });

  it("keeps a row that has ANY field filled (id only)", () => {
    const out = pruneEmptyRows(
      software([{ _key: "1", id: "A.1", name: "", value: "" }])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(1);
  });

  it("treats whitespace-only fields as empty", () => {
    const out = pruneEmptyRows(
      software([{ _key: "1", id: "  ", name: "\t", value: " " }])
    );
    expect(out.kind === "software" && out.rows).toHaveLength(0);
  });

  it("drops a dip switch with no switch id and no note (OFF is not content)", () => {
    const dip: SettingsSection = {
      id: "d1",
      kind: "dip",
      name: "Bank 1",
      switches: [
        { _key: "1", switch: "", position: "OFF", note: "" },
        { _key: "2", switch: "SW1", position: "ON", note: "free play" },
      ],
    };
    const out = pruneEmptyRows(dip);
    expect(out.kind === "dip" && out.switches).toHaveLength(1);
  });

  it("returns note/unaffected sections unchanged", () => {
    const note: SettingsSection = {
      id: "n1",
      kind: "note",
      title: "X",
      customTitle: true,
      body: null,
    };
    expect(pruneEmptyRows(note)).toBe(note);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/test/unit/components/machines/prune-empty-rows.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

```ts
import type { SettingsSection } from "~/lib/machines/settings-types";

const blank = (s: string): boolean => s.trim() === "";

/** A software/table row is empty when id, name, AND value are all blank. */
export function rowIsEmpty(row: {
  id: string;
  name: string;
  value: string;
}): boolean {
  return blank(row.id) && blank(row.name) && blank(row.value);
}

/** A DIP switch is empty when its switch id and note are blank. `position`
 *  defaults to "OFF", so it is not treated as user content. */
export function switchIsEmpty(sw: { switch: string; note: string }): boolean {
  return blank(sw.switch) && blank(sw.note);
}

/**
 * Drop fully-empty rows from a section (bug #4b, PP-43q3). The whole row must be
 * blank — a row with only an id filled is kept. Returns the SAME reference when
 * nothing is pruned, so callers can cheaply detect a no-op. Note sections are
 * unaffected.
 */
export function pruneEmptyRows(section: SettingsSection): SettingsSection {
  switch (section.kind) {
    case "software":
    case "table": {
      const rows = section.rows.filter((r) => !rowIsEmpty(r));
      return rows.length === section.rows.length
        ? section
        : { ...section, rows };
    }
    case "dip": {
      const switches = section.switches.filter((s) => !switchIsEmpty(s));
      return switches.length === section.switches.length
        ? section
        : { ...section, switches };
    }
    case "note":
      return section;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/components/machines/prune-empty-rows.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/components/machines/settings/prune-empty-rows.ts src/test/unit/components/machines/prune-empty-rows.test.ts
git commit -m "feat(machine-settings): empty-row pruning helper (PP-43q3)"
```

---

## Task 6: THE PIVOT — always-live inputs + auto-save, remove the per-unit engine (ATOMIC)

This is the load-bearing task. It will not compile partway, so it is one task with one commit. Work bottom-up (leaves → sections → card → tab) and only commit when `pnpm run check` is fully green.

**Files (all Modify):**

- `src/components/machines/settings/EditableCell.tsx`
- `src/components/machines/settings/InlineEditableText.tsx`
- `src/components/machines/settings/InlineMarkdownField.tsx`
- `src/components/machines/settings/NoteSection.tsx`
- `src/components/machines/settings/SoftwareSettingsSection.tsx`
- `src/components/machines/settings/TableSection.tsx`
- `src/components/machines/settings/DipBankSection.tsx`
- `src/components/machines/settings/EditableSettingsTable.tsx`
- `src/components/machines/settings/SortableSection.tsx`
- `src/components/machines/settings/SettingsSetCard.tsx`
- `src/components/machines/settings/SettingsTab.tsx`
- Test: `src/test/unit/components/machines/SettingsTabDirty.test.tsx` (rewrite for the new model)
- Test: `src/test/integration/machine-settings-actions.test.ts` (add auto-save persistence assertions)

**The model change in one sentence:** every `canEdit`/`editing` prop that currently means "this unit is in edit mode" becomes "this user has permission to edit" — fields are always-live for permitted users; there is no edit mode, no Save/Cancel/Edit.

### 6a — Leaf inputs (always-live + affordance)

- [ ] **Step 1: `EditableCell` — collapse to an always-live input.** Remove `isEditing` state, the display `<button>`, `startEdit`, `commit(fromKeyboard)`/`cancel` keyboard-close focus dance, and `autoFocusOnMount`-as-edit-trigger. The component renders: read-only viewers → the existing `<span>`; permitted users → always an `<Input>` seeded from `value`, applying `EDITABLE_FIELD_CLASS` + `EDITABLE_TEXT_CLASS` from `~/components/machines/settings/affordance`. Keep: `codeLike` autocorrect-off, `enterKeyHint="done"`, `ariaLabel`, the trim-on-commit compare. Change the commit contract from "buffer to working copy" to "report value up + signal blur":
  - `onCommit(newValue)` still fires on change (push to working copy).
  - Add `onCommitBlur?()` fired on blur so the parent can flush the auto-save. (Enter also flushes via blur or an explicit call.)
  - Keep `autoFocusOnMount` but make it mean "focus this input on mount" (for the freshly-added row), not "enter edit mode".

- [ ] **Step 2: `InlineEditableText` — same collapse.** `canEdit` now means permission. Remove the `useEffect` that focuses on the edit transition's `canEdit` flip (keep an `autoFocus`-on-mount option for added rows). Always render the `<Input>` for permitted users with the affordance classes (replace the current `bg-background` opaque fill with `EDITABLE_FIELD_CLASS`'s `bg-black`). Keep the `required`/`:user-invalid`/`aria-invalid`-on-commit logic. Add an `onBlurCommit?()` so the parent flushes.

- [ ] **Step 3: `InlineMarkdownField` — always-editable for permitted users.** `editing` prop → `canEdit`. When `canEdit`, always render `RichTextEditor`; else `RichTextDisplay` (or null when empty). Wrap the editor container so it carries the affordance border (`EDITABLE_FIELD_CLASS` minus the input-specific bits — a bordered black box around the editor). Keep streaming `onValueChange` on every change, and call `autoSave.schedule(setId)` from that stream so rich edits debounce-save.

> **Rich-text auto-save is debounce-ONLY (H2).** Confirmed against `src/components/editor/RichTextEditor.tsx`: `RichTextEditorProps` has **no `onBlur` prop** (the handle exposes only `clear()`/`focus()`). Do not attempt a blur flush for rich text — the ~800ms debounce on `onValueChange` is the save trigger. (The design doc's "blur/debounce" reduces to debounce here. Plain-text fields in Steps 1–2 still flush on blur.)

### 6b — Section components (prop semantics)

- [ ] **Step 4: `NoteSection`, `SoftwareSettingsSection`, `TableSection`, `DipBankSection`, `EditableSettingsTable`.** Their `editing`/`canEdit` props are passed straight through from the card's per-unit state today. Change every call site so they receive **permission** (`canEdit`), not edit-mode. In `EditableSettingsTable`, `useRowEditSheet({ canEdit })` already derives `rowEditable = canEdit && !isMobile` — that stays correct once `canEdit` is permission. Remove the `reserveEditUi` "viewing but not editing" branch (declared `EditableSettingsTable.tsx:64`, used `:174`/`:234`) — with always-live there is no "permitted but not editing" state to reserve space for. The leaf inputs now carry the affordance.

### 6c — Card + section chrome (remove Edit/Save/Cancel)

- [ ] **Step 5: `SortableSection`.** Remove `editing`, `saving`, `saveError`, `onEdit`, `onSave`, `onCancel` props and the Edit/Save/Cancel/error UI they drive. Keep `canEdit` (gates the grip/kebab/reorder/delete), the drag grip, Move up/down, and section Delete. The section body is always rendered editable for permitted users.

- [ ] **Step 6: `SettingsSetCard`.** Remove `headerUnitId`, `isUnitEditing`, `unitSaveState`, `onEditUnit`, `onSaveUnit`, `onCancelUnit`, the `headerEditing`/`headerIsButton` branching, the header Edit/Save/Cancel button cluster (lines ~516–585), and the per-section `sectionEditing`/`sectionSave` wiring. The header name (`InlineEditableText`) and description (`InlineMarkdownField`) are always-live for permitted users. **Header alignment fix:** put the chevron in its own column and left-align name/description/audit in a shared column (already prototyped) so the name and description boxes share one left edge. The set-level Delete stays an `AlertDialog`. `renderSection(section)` no longer takes an `editing` arg.

### 6d — `SettingsTab` (the engine swap)

- [ ] **Step 7: Delete the per-unit engine.** Remove: `editingUnits`/`savingUnits`/`unitErrors` state and all their helpers (`unitKey` usage for edit state, `isUnitEditing`, `unitSaveState`, `editUnit`, `saveUnit`, `cancelUnit`, `buildUnitPayload`, `headerSliceDirty`, `sectionSliceDirty`, `anyUnitDirty`, the rekey/drop helpers for unit state, `HEADER_UNIT`). Keep: `setsRef` working copy, `mutateSets`, `pendingPayloadsRef`, `tempToRealRef`, the temp→real swap in `execute`, `useSettingsSaveQueue`.

- [ ] **Step 8: Rework `execute` + payload staging — preserve mid-save change detection (C1, CRITICAL).** With no slice isolation, a set persists its **whole** working copy (name + description + sections). **The trap:** the queue detects "a newer edit landed during the await" by object IDENTITY (`pendingPayloadsRef` `stagedNow !== payload`, `SettingsTab.tsx:386`). That only works if a _fresh payload object_ is staged **at the call site, before `persist`** — NOT snapshotted inside `execute`. If `execute` self-snapshots, a new set's first INSERT silently drops everything typed during insert latency. So:
  - Every auto-save trigger stages first, then persists: `stagePayload(setId, setsRef.current.find((s) => s.id === setId)!)` then `autoSave.schedule(setId)` (or `.flush`). `execute` reads `pendingPayloadsRef.current.get(setId)` exactly as today — **do not** change `execute` to self-snapshot.
  - Keep the temp→real rekey path and the `newerPending` carry-over (`:384–404`) intact — they keep working precisely because staging happens at the call site.
  - The baseline advances to the sent payload on success (as today, `:456–469`); it's now used only for the no-op compare and structural-op composition.

- [ ] **Step 8b: Convert the THREE structural-op call sites to stage from the WORKING COPY (H1).** `deleteSection` (`SettingsTab.tsx:717`), `reorderSections` (`:742`), and `moveSection` (`:770`) currently `stagePayload(setId, nextBaseline)`. Change each to apply the structural change to the working copy and `stagePayload(setId, setsRef.current.find((s) => s.id === setId)!)`, then `autoSave.flush(setId)`. Otherwise a concurrent half-typed field gets clobbered by stale baseline content on reorder/delete. **All three — missing one silently overwrites in-flight edits.**

- [ ] **Step 9: Wire auto-save + one-shot auto-retry into every mutation (spec §C.2).** Add the save runner:

```tsx
const saveStatus = useSaveStatus();
const autoRetried = useRef(new Set<string>());
const retryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

// runSave is referenced by its own retry timer, so reach it through a ref to
// avoid a definition cycle with useAutoSave below.
const runSaveRef = useRef<(id: string) => void>(() => {});
const runSave = useCallback(
  (id: string): void => {
    saveStatus.markPending(id);
    void saveQueue.persist(id).then((o) => {
      if (o.ok) {
        saveStatus.markSaved(id);
        autoRetried.current.delete(id); // a future failure may auto-retry again
        return;
      }
      saveStatus.markFailed(id);
      if (!autoRetried.current.has(id)) {
        autoRetried.current.add(id);
        retryTimers.current.set(
          id,
          setTimeout(() => {
            retryTimers.current.delete(id);
            runSaveRef.current(id); // ONE automatic retry; then manual only
          }, 5000)
        );
      }
    });
  },
  [saveStatus, saveQueue]
);
runSaveRef.current = runSave;

const autoSave = useAutoSave(runSave);

// Clear pending retry timers on unmount.
useEffect(
  () => () => {
    for (const t of retryTimers.current.values()) clearTimeout(t);
    retryTimers.current.clear();
  },
  []
);
```

Every working-copy mutation (`renameSet`, `updateDescription`, `updateSoftwareRow`, `updateNoteTitle`, `updateNoteBody`, `renameDipBank`, `updateDipSwitch`, `updateTableTitle`, `updateBaseline`) **stages the payload from the working copy (Step 8), then** calls `autoSave.schedule(setId)`. Plain-text leaf blur callbacks and toggles call `autoSave.flush(setId)` (immediate). Structural ops use Step 8b (stage from working copy) then `autoSave.flush(setId)`. The manual banner Retry (Step 11) and the auto-retry both go through `runSave`, so they share the one-shot semantics.

- [ ] **Step 10: Empty-row prune on blur/flush.** Before staging a payload on a flush, run each section through `pruneEmptyRows` (Task 5) so fully-empty rows never persist. A brand-new set with an empty name still must not insert (keep the existing `execute` guard: `isNew && payload.name.trim() === ""` → no-op). (Minor, accepted: the empty-name no-op still flips pending→saved — a harmless status flash, no extra handling needed.)

- [ ] **Step 11: Merge the nav guard (H3) + render the banner (H4 framing).**
  - **The guard must cover BOTH save systems.** The two machine-level `InlineEditableField`s save via their own path, not the set queue. Task 9 brings them into the SAME `saveStatus` (they call `markPending/markSaved/markFailed` under stable ids `"machine:requests"`/`"machine:instructions"`), so the guard becomes simply `useUnsavedChangesGuard(canEdit && saveStatus.hasUnsaved)` — **delete** the old `machineFieldDirty` state + `onRequestsDirty`/`onInstructionsDirty`/`onDirtyChange` plumbing entirely. (Do NOT leave the guard keyed only on the set queue — that was the H3 wiring bug: machine-field edits would escape it.)
  - **`beforeunload` is best-effort, NOT the protection.** The real protection is the nav guard blocking in-app navigation while `saveStatus.hasUnsaved`. On `beforeunload`, call `autoSave.flushAll()` (fires pending writes) AND `e.preventDefault()` for the native "Leave?" dialog — but do NOT assume the async writes complete after the user confirms leaving (the JS context is torn down). Frame/comment it that way; don't claim the flush persists on close.
  - Render `<SaveFailureBanner failedCount={saveStatus.failedIds.size} onRetry={() => { for (const id of saveStatus.failedIds) runSave(id); }} />` at the top of the tab (manual Retry routes through `runSave`, same path as auto-retry). Update the `SettingsSetCard` JSX to drop all the removed props.

- [ ] **Step 12: Rewrite `SettingsTabDirty.test.tsx`** (run as `pnpm vitest run --project unit ...`) for the new model:
  - (a) a permitted user sees always-live inputs (no "Edit" button);
  - (b) typing schedules a save (fake timers for the debounce);
  - (c) a read-only viewer (`canEdit=false`) sees **clean static text and NO inputs/affordance across every field type** — table cell, set name, table title, DIP bank name, and the rich description/note (must render `RichTextDisplay`, never `RichTextEditor`). This is the spec §B "viewers get clean static text" guard the review flagged as untested;
  - (d) the always-on set-name input carries `autocomplete="off"` (it's always rendered now — CORE-FORM);
  - (e) a `customTitle: true` NoteSection renders editable title + body with **no Save button** (bug #7 regression guard).

- [ ] **Step 13: Add an auto-save persistence integration test.** In `machine-settings-actions.test.ts`, assert a row-add + field edit persists via the action without an explicit Save (the bug class the friend hit that E2E missed — see PP-jn45). This is integration (PGlite + direct action), not E2E.

- [ ] **Step 14: Green-gate and commit.**

Run: `pnpm run check` → PASS, then `pnpm run preflight` (this task changes save wiring touching the action contract).
Expected: all green.

```bash
git add src/components/machines/settings/ src/test/unit/components/machines/SettingsTabDirty.test.tsx src/test/integration/machine-settings-actions.test.ts
git commit -m "feat(machine-settings): pivot to always-live inputs + auto-save, remove per-unit edit engine (PP-43q3)"
```

> If this task balloons mid-execution, the safe fallback split is: commit 6a (leaves, with their old call sites temporarily adapted) only if `check` is green; otherwise keep it atomic. Do NOT commit a non-compiling tree.

---

## Task 7: Delete affordance — desktop 2×-wide armed button + mobile confirm dialog

**Files:**

- Modify: `src/components/machines/settings/ConfirmingDeleteButton.tsx`
- Test: `src/test/unit/components/machines/ConfirmingDeleteButton.test.tsx` (create)

**Context (bug #4a):** The current two-tap arm/confirm (3s timeout) is not discoverable — it just turns red. Desktop: keep two-tap but **expand the armed state to ~2× width** with explicit copy ("Tap again to delete"). Mobile (`use-is-mobile`): replace two-tap with a small **confirm/deny `AlertDialog`**. Section-level and set-level deletes keep their existing `AlertDialog` (unchanged).

- [ ] **Step 1: Write the failing test** (desktop arm→confirm widens + fires; mobile path opens a dialog). Mock `~/hooks/use-is-mobile`'s `useIsMobile` for both branches; assert the armed desktop button exposes the "Tap again to delete" accessible name and that a second click calls `onConfirmedDelete`; assert the mobile branch renders an `AlertDialog` with Delete/Cancel.

- [ ] **Step 2: Run it to verify it fails.**

Run: `pnpm vitest run src/test/unit/components/machines/ConfirmingDeleteButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** Branch on `useIsMobile()`:
  - Desktop: keep the arm/timeout logic; when `armed`, render a wider button (`w-auto px-2` with a visible "Tap again to delete" label instead of the icon-only `size-6`), `glow-destructive` optional, `motion-reduce:` on the transition.
  - Mobile: render the trash trigger that opens an `AlertDialog` ("Delete this row?" / Delete / Cancel); confirm calls `onConfirmedDelete`. Reuse the shadcn `AlertDialog` primitives already imported elsewhere. Keep `e.stopPropagation()` so a tap never bubbles to the row's sheet-open handler.

- [ ] **Step 4: Run the test to verify it passes**, then `pnpm run check`.
      Expected: PASS, green.

- [ ] **Step 5: Commit.**

```bash
git add src/components/machines/settings/ConfirmingDeleteButton.tsx src/test/unit/components/machines/ConfirmingDeleteButton.test.tsx
git commit -m "feat(machine-settings): discoverable delete — desktop 2x armed, mobile confirm dialog (PP-43q3)"
```

---

## Task 8: Mobile `RowEditSheet` — auto-save + keyboard occlusion fix

**Files:**

- Modify: `src/components/machines/settings/RowEditSheet.tsx`
- Modify: `src/components/machines/settings/use-row-edit-sheet.ts` (if the close/commit contract changes)
- Test: `src/test/unit/components/machines/RowEditSheet.test.tsx` (create or extend)

**Context (bug #2):** The sheet's "Save" only buffered; remove it and auto-save. And the on-screen keyboard covers the lower fields with no scroll. Fix sizing to be keyboard-aware and the body scrollable.

- [ ] **Step 1: Remove the buffer-"Save" model.** Drop the `SheetFooter` Save button and `handleSave`-buffers-only. Auto-save: each field change calls the caller's per-field update immediately (or on blur), routed through the tab's `autoSave.schedule/flush`. Closing the sheet flushes. Replace the footer with a single "Done" that just closes (no separate persist), or remove it and rely on the sheet's dismiss.

- [ ] **Step 2: Keyboard-aware, scrollable body.** Size the sheet with `max-h-[100dvh]` and make the fields region `overflow-y-auto` so the focused field can scroll above the keyboard. Use the `interactive-widget=resizes-content` viewport behavior if not already set, and `scroll-margin`/`scrollIntoView` on focus so the active field is never hidden. Look up the current best pattern first: `npx -y modern-web-guidance@latest search "keyboard avoidance virtual keyboard dvh"` then `retrieve` the relevant id (CORE-UI-005/006). Keep the 16px (`text-base`) inputs (iOS zoom guard).

- [ ] **Step 2b: Confirm background `inert` while the sheet is open (CORE-A11Y).** shadcn `Sheet` builds on Radix Dialog, which sets `aria-modal` + a focus trap and marks outside content inert (via `aria-hidden`). Verify this holds for the bottom sheet (open it, inspect: sibling content gets `aria-hidden`/inert). If it does, no code is needed — record it. If there's a gap, add `inert` to the card region while `open`. (Review flagged this as listed-but-unverified.)

- [ ] **Step 3: Test** what's testable in jsdom — Save button gone; field edits call the update callback; close flushes. (Keyboard occlusion itself is NOT unit-testable — flag it for device verification on the preview, per PP-jn45.)

- [ ] **Step 4: `pnpm run check`, commit.**

```bash
git add src/components/machines/settings/RowEditSheet.tsx src/components/machines/settings/use-row-edit-sheet.ts src/test/unit/components/machines/RowEditSheet.test.tsx
git commit -m "feat(machine-settings): mobile sheet auto-saves + keyboard-aware scroll (PP-43q3)"
```

---

## Task 9: Machine-level fields — auto-save + fix preset-replace (bug #6)

**Files:**

- Modify: `src/components/inline-editable-field.tsx`
- Modify: `src/components/machines/settings/SettingsTab.tsx` (the two `InlineEditableField` call sites, lines ~1067 & ~1093)
- Test: `src/test/unit/components/InlineEditableFieldPresets.test.tsx` (**extend the EXISTING file** — do NOT create a parallel `InlineEditableField.test.tsx`) — bug #6 regression + viewer state

**Context:** The two machine-level sections ("Before you change anything" / "How to change settings") use `InlineEditableField` with explicit Save/Cancel + optimistic + `openWhenEmpty` + presets. Convert to auto-save (remove the explicit Save/Cancel; save on blur + debounce) and apply the affordance. **Bug #6:** picking a preset and confirming "Replace" doesn't update the editor. Root cause: `RichTextEditor` takes `content={editValue}` as an _initial_ prop and is uncontrolled afterward, so `setEditValue(pendingPreset)` (line 167) never reaches the mounted editor. Fix by forcing the editor to re-init when a preset is applied (e.g. a `key` that changes on preset-apply, or the editor's imperative `setContent`).

- [ ] **Step 1: Add the failing bug-#6 test to the EXISTING file (H5).** Extend `src/test/unit/components/InlineEditableFieldPresets.test.tsx` (it already covers preset-picking for this component). Add a case: render with presets and existing text; pick a preset → confirm Replace; assert the editor content becomes the preset text. This fails today.

- [ ] **Step 2: Run it to verify it fails.**

Run: `pnpm vitest run --project unit src/test/unit/components/InlineEditableFieldPresets.test.tsx`
Expected: FAIL (editor keeps the old text).

- [ ] **Step 3: Fix the editor re-init with a `key` bump (C2 — `setContent` does NOT exist).** Confirmed: `RichTextEditorHandle` exposes only `clear()`/`focus()` (`src/components/editor/RichTextEditor.tsx:27`), and its internal content-sync `useEffect` only fires when the editor is empty — so it won't inject a preset over existing text. The ONLY viable fix is to change the `RichTextEditor`'s React `key` when a preset is applied (e.g. a counter bumped in `confirmPreset`/`applyPreset`), forcing a remount seeded with the preset doc. Keep the AlertDialog confirm-on-overwrite. **Do not reach for an imperative `setContent` — it doesn't exist and will not type-check.**

- [ ] **Step 4: Convert to auto-save + affordance, and into the shared `saveStatus` (H3).** Remove the explicit Save/Cancel buttons (lines ~313–332) and the `handleSave` flow in favor of debounce auto-save through `onSave` (rich-text → debounce-only, no blur — same as Task 6 Step 3). Keep the optimistic value. **Route status into the shared `saveStatus`** instead of the old `onDirtyChange`/`machineFieldDirty`: each field gets a stable id (`"machine:requests"` / `"machine:instructions"`) and calls `saveStatus.markPending/markSaved/markFailed` around its `onSave`, so the single nav guard + banner (Task 6 Step 11) cover them too. Drop `onDirtyChange` and the parent's `machineFieldDirty` state. Apply `EDITABLE_FIELD_CLASS` to the editor box. **Verify governance-neutral placeholder copy is untouched** (PP-8a5r).

- [ ] **Step 4b: Test the viewer state (review GAP6).** Add a case to `InlineEditableFieldPresets.test.tsx`: with `canEdit=false` and a value, the field renders `RichTextDisplay` and **no editor chrome / no Save**; with `canEdit=false` and empty, it renders nothing. Guards against the auto-save conversion leaking the editor to viewers.

- [ ] **Step 5: Run the tests to verify they pass**, then `pnpm run check`.

Run: `pnpm vitest run --project unit src/test/unit/components/InlineEditableFieldPresets.test.tsx`

- [ ] **Step 6: Commit.**

```bash
git add src/components/inline-editable-field.tsx src/components/machines/settings/SettingsTab.tsx src/test/unit/components/InlineEditableFieldPresets.test.tsx
git commit -m "fix(machine-settings): machine-level fields auto-save + preset replace updates editor (bug #6, PP-43q3/PP-8a5r)"
```

---

## Task 10: Final integration pass + verification checklist

**Files:**

- Review: all changed components
- Test: full `pnpm run preflight`

**Context:** Bugs #1/#3/#5/#7 should now be dissolved by the pivot; confirm them explicitly and run the full local gate. Manual/visual verification is REQUIRED (this is the failure mode that started the redesign — green tests missed the friend's 7 bugs).

- [ ] **Step 1: Re-run the bug→resolution map** from the design doc and confirm each is addressed in code:
  - #1 double-Save → no Save buttons (grep settings/ for "Save" buttons; only structural confirm dialogs remain).
  - #3 collapsed-set Edit edits only title → no Edit button; expanding shows all fields editable.
  - #5 Tab needs Enter → cells are real inputs; Tab lands ready to type.
  - #7 Save renders in title → gone with the Save buttons; NoteSection title/body render clean.
  - #2/#4a/#4b/#6 → Tasks 8/7/5+6/9.

- [ ] **Step 2: `pnpm run preflight`** (full: check + build + integration).
      Expected: green.

- [ ] **Step 3: Manual verification on dev** (`pnpm run dev:status`; if down, `supabase start` + `pnpm dev`; seed AFM via the machine-settings seed). At `/m/AFM/settings` logged in as an editor:
  - Every field shows the black-box affordance at rest; hover glows the text (desktop); focus shows the ring.
  - Typing into a cell / name / description / note auto-saves (reload persists, no Save click).
  - Read-only viewer (log out or use a viewer role) sees clean static text, no boxes/inputs.
  - Add a row, leave it empty, blur/navigate → it does not persist.
  - Delete: desktop arms to a wide "Tap again" button; mobile shows a confirm dialog.
  - Force a save failure (e.g. offline) → the banner appears, text is retained, Retry works.

- [ ] **Step 4: Mobile verification** is on the **preview** after this lands (the friend re-tests). Note keyboard-occlusion + sheet auto-save can only be confirmed on a real device — call this out in the PR.

- [ ] **Step 5: Update the PR description** noting the auto-save / progressive-enhancement exception (read view SSRs; editing needs JS) and the manual/mobile verification status. Do NOT push or merge without Tim's go-ahead.

---

## Self-Review (completed by plan author)

**Spec coverage** (design doc §A–§F + bug map):

- §A always-live/auto-save → Tasks 2, 6. §B affordance → Tasks 1, 6, 9. §C auto-save mechanics (debounce/blur/toggle, failure-only banner, nav block, no Cancel) → Tasks 2, 3, 6. §D mobile sheet → Task 8. §E delete → Task 7. §F empty rows → Tasks 5, 6. Bug #6 → Task 9. #7 + header alignment → Task 6. Design-bible amendment → Task 1. PP-8a5r owner-requests field → Task 9. ✓ All covered.

**Known gaps / risks called out (not placeholders — real unknowns to resolve in-task):**

1. **`RichTextEditor` API — RESOLVED by review (no longer an assumption).** Verified against the real component: no `onBlur` prop → rich-text auto-save is debounce-only (Task 6 Step 3); no `setContent` on the handle → bug-#6 fix is a `key` bump (Task 9 Step 3). Both are now specified, not guessed.
2. **Task 6 is large and atomic** by necessity (the prop-semantics change spans leaf→card→tab and won't compile partway). The fallback note forbids committing a non-compiling tree.
3. **Mobile keyboard occlusion (Task 8) is not unit-testable** — device verification on the preview is the gate (PP-jn45 covers the E2E-coverage follow-up).
4. **Affordance CSS is locked but visual** — Task 10's manual check is the real sign-off, not the render tests.

**Type consistency:** `EDITABLE_FIELD_CLASS`/`EDITABLE_TEXT_CLASS` (Task 1) consumed verbatim in 6/9; `useAutoSave`/`useSaveStatus`/`SaveFailureBanner`/`pruneEmptyRows` signatures defined in 2/3/5 match their Task 6 call sites. `saveSettingsSetAction` contract unchanged (Task 4 confirms).
