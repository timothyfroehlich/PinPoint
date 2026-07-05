# Machine Settings (PP-43q3 + PP-8a5r) Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks marked **[APPLIED]** are already in the working tree — their steps are _review + regression-test_, not re-implement.

**Goal:** Remediate every finding from the high-effort code review of the Machine Settings feature (the settings tab, the two always-open machine-level fields, the per-unit atomic-commit rework, and PP-8a5r owner-requests), and prove each fix with a test.

**Architecture:** Most fixes are already applied to the working tree (this branch, `feat/machine-settings-tab-scaffold-PP-43q3`, worktree `.claude/worktrees/agent-abe71d6b68d9c0273`, PR #1388, with `origin/main` already merged in at commit `3178c48b`). This plan exists so reviewers can verify each applied change against an explicit description, add the regression tests that lock the behavior in, and complete the few remaining items. Work is reviewed task-by-task as we go.

**Tech Stack:** Next.js App Router, React 19, TypeScript ts-strictest, Drizzle ORM, Tiptap/ProseMirror, Tailwind v4 + semantic tokens, shadcn/ui, Vitest + RTL (unit), PGlite (integration), Playwright (E2E).

**Severity legend (from the review):** 🔴 data loss · 🟡 user-visible bug / a11y / coverage · 🟢 cleanup.

**Verification commands:**

- Fast gate: `pnpm run check` (types, lint, format, unit, ~12s)
- Targeted unit: `pnpm exec vitest run <path>`
- Full pre-commit gate: `pnpm run preflight`
- A1/B1/A2 journeys (E2E, optional): `pnpm exec playwright test e2e/full/machine-settings.spec.ts --project=chromium`

---

## File Map

| File                                                          | Responsibility                                                            | Findings touched      |
| :------------------------------------------------------------ | :------------------------------------------------------------------------ | :-------------------- |
| `src/lib/tiptap/types.ts`                                     | Shared ProseMirror helpers (`docIsEmpty`, `docsEqualByText`)              | Cl3, Cl4              |
| `src/components/machines/settings/InlineMarkdownField.tsx`    | Use shared `docIsEmpty`                                                   | Cl3/Cl4               |
| `src/components/inline-editable-field.tsx`                    | Machine-level rich field: optimistic value, dirty memo, dirty-up callback | B3, Cl2, Cl4, Cl5, B1 |
| `src/components/machines/settings/InlineEditableText.tsx`     | Inline single-line field: clear-optional, required indicator              | A2, I1                |
| `src/components/machines/settings/EditableCell.tsx`           | Table cell editor: placeholder contrast                                   | I2                    |
| `src/components/machines/settings/ConfirmingDeleteButton.tsx` | Two-tap delete: remove `title` tooltip                                    | I3                    |
| `src/components/machines/settings/SettingsTab.tsx`            | Island state machine: `today()`, nav guard, save executor                 | A4, B1, A1            |
| `src/components/machines/settings/use-settings-save-queue.ts` | Per-set serial save queue: dead-branch removal                            | A3                    |
| `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts`       | Server actions: `as` cast review                                          | C1                    |
| Tests (unit/integration)                                      | Lock in A1, A2, B3, B1, B2                                                | —                     |

---

## Task 1: Shared ProseMirror helpers **[APPLIED]** 🟢 (Cl3, Cl4)

**Files:**

- Modify: `src/lib/tiptap/types.ts` (appended after `docToPlainText`)

The dirty/empty idiom had 4 copies, and `inline-editable-field.tsx` read `displayValue.content[0]` **unguarded** — a stored bare `{ type: "doc" }` (legal: `content` is optional in the persisted schema) crashes it (Cl4). One guarded `docIsEmpty` + one `docsEqualByText` replace all copies.

- [x] **Step 1 (applied): the helpers exist**

```ts
export function docIsEmpty(doc: ProseMirrorDoc | null | undefined): boolean {
  const content = doc?.content;
  const firstNode = content?.[0];
  const length = content?.length ?? 0;
  return (
    !doc ||
    length === 0 ||
    (length === 1 && firstNode?.type === "paragraph" && !firstNode.content)
  );
}

export function docsEqualByText(
  a: ProseMirrorDoc | string | null | undefined,
  b: ProseMirrorDoc | string | null | undefined
): boolean {
  return docToPlainText(a).trim() === docToPlainText(b).trim();
}
```

- [ ] **Step 2: Review** — confirm `docIsEmpty` is undefined-tolerant (no `.content[0]` without `?.`), and `docsEqualByText` matches the normalization the save path uses (`docToPlainText(...).trim()`).
- [ ] **Step 3: Add unit test** — `src/lib/tiptap/types.test.ts` (create if absent):

```ts
import { describe, it, expect } from "vitest";
import { docIsEmpty, docsEqualByText } from "~/lib/tiptap/types";

describe("docIsEmpty", () => {
  it("treats a bare { type: doc } (no content) as empty without crashing", () => {
    expect(docIsEmpty({ type: "doc" } as never)).toBe(true);
  });
  it("treats a single empty paragraph as empty", () => {
    expect(docIsEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(
      true
    );
  });
  it("treats a paragraph with text as non-empty", () => {
    expect(
      docIsEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      })
    ).toBe(false);
  });
});

describe("docsEqualByText", () => {
  it("ignores whitespace-only differences", () => {
    const a = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    };
    const b = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi  " }] },
      ],
    };
    expect(docsEqualByText(a, b)).toBe(true);
  });
  it("null and empty doc are text-equal", () => {
    expect(
      docsEqualByText(null, { type: "doc", content: [{ type: "paragraph" }] })
    ).toBe(true);
  });
});
```

- [ ] **Step 4:** `pnpm exec vitest run src/lib/tiptap/types.test.ts` → PASS.
- [ ] **Step 5: Commit** (batched with Task 2/3 — same helper rollout).

---

## Task 2: `InlineMarkdownField` uses the shared helper **[APPLIED]** 🟢 (Cl3/Cl4)

**Files:**

- Modify: `src/components/machines/settings/InlineMarkdownField.tsx`

- [x] **Step 1 (applied):** local `docIsEmpty` (and the now-unused `ProseMirrorNode` import) removed; imports `docIsEmpty` from `~/lib/tiptap/types`. `normalize()` stays (text-emptiness → null).
- [ ] **Step 2: Review** — confirm no duplicate `docIsEmpty` remains and behavior is unchanged (`isEmpty = docIsEmpty(value)`).
- [ ] **Step 3:** covered by existing `InlineMarkdownField` render tests; run `pnpm run check`.

---

## Task 3: `inline-editable-field.tsx` — optimistic value, dirty memo, dirty-up **[APPLIED]** 🟡🟢 (B3, Cl2, Cl4, Cl5, B1-child)

**Files:**

- Modify: `src/components/inline-editable-field.tsx`

Four coupled changes:

1. **B3 + Cl2:** `optimisticValue ?? value` could not represent an optimistic _clear_ (cleared → `null ?? value` showed the stale prop) and never reconciled with later prop changes. Replaced with a discriminated wrapper + a reconcile effect.
2. **Cl4:** `isEmpty` now uses the guarded `docIsEmpty`.
3. **Cl5/Cl3:** `isDirty` is a `useMemo` over `docsEqualByText`.
4. **B1 (child half):** new `onDirtyChange?` prop fires on dirty transitions (and `false` on unmount) so the parent guard can include these fields.

- [x] **Step 1 (applied): optimistic state + reconcile**

```tsx
const [optimistic, setOptimistic] = useState<{
  value: ProseMirrorDoc | null;
} | null>(null);
// ...
const displayValue = optimistic ? optimistic.value : (value ?? null);
const isEmpty = docIsEmpty(displayValue);
useEffect(() => {
  setOptimistic(null);
}, [value]); // fresh server value wins
```

- [x] **Step 2 (applied): handleSave** sets `setOptimistic({ value: valueToSave })`; on failure `setOptimistic(null)` (revert to prop).
- [x] **Step 3 (applied): dirty memo + dirty-up + early return moved below hooks**

```tsx
const isDirty = useMemo(
  () => !docsEqualByText(editValue, displayValue),
  [editValue, displayValue]
);
useEffect(() => {
  onDirtyChange?.(isDirty);
  return () => {
    onDirtyChange?.(false);
  };
}, [isDirty, onDirtyChange]);
if (isEmpty && !canEdit) return null; // AFTER all hooks
```

- [ ] **Step 4: Review** — (a) rules-of-hooks: every `useState/useEffect/useMemo` runs before the `if (isEmpty && !canEdit) return null`; (b) the reconcile effect doesn't fight the optimistic write (it keys on `value`, which only changes post-revalidation); (c) `onDirtyChange` is stable from the parent (Task 9) so the effect doesn't churn.
- [ ] **Step 5: Regression test (B3 clear)** — add to `src/test/unit/components/InlineEditableFieldPresets.test.tsx` (or a sibling `inline-editable-field.test.tsx`):

```tsx
it("clearing a filled field renders empty immediately (optimistic clear)", async () => {
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  const filled = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "old" }] }],
  };
  render(
    <InlineEditableField
      label="How to change settings"
      value={filled}
      machineId="m1"
      canEdit
      onSave={onSave}
      openWhenEmpty
      headingProminent
    />
  );
  await userEvent.click(screen.getByTestId(/-edit$/)); // open editor
  // clear the editor to empty, then Save
  // (use the editor's clear affordance / type-and-delete per the RichTextEditor test harness)
  await userEvent.click(screen.getByText("Save"));
  // The optimistic display must show the empty/placeholder state, NOT "old".
  expect(screen.queryByText("old")).not.toBeInTheDocument();
});
```

- [ ] **Step 6:** `pnpm exec vitest run src/test/unit/components/InlineEditableFieldPresets.test.tsx` → PASS.
- [ ] **Step 7: Commit** (helper rollout: Tasks 1–3).

---

## Task 4: `InlineEditableText` — clear-optional + required indicator **[APPLIED]** 🟡 (A2, I1)

**Files:**

- Modify: `src/components/machines/settings/InlineEditableText.tsx`

- [x] **Step 1 (applied, A2):** `commit()` guard changed from `if (trimmed && trimmed !== value)` to `if (trimmed !== value)`. The required guard above already blocks empty for required fields, so optional fields (e.g. a DIP bank name) can now be cleared. **User decision: DIP bank name stays optional-but-clearable.**
- [x] **Step 2 (applied, I1):** required fields get a visible up-front cue (design-bible §683 asterisk, adapted to label-less inline inputs) + `aria-required`:

```tsx
const editPlaceholder = required ? `${placeholder} *` : placeholder;
// ...
<Input placeholder={editPlaceholder} aria-required={required || undefined} aria-invalid={showInvalid || undefined} ... />
```

- [ ] **Step 3: Review** — confirm required fields still block empty Save (the `commit()` early-return on `required && trimmed === ""` is untouched), and the asterisk shows only on required fields in edit mode (not the resting view span).
- [ ] **Step 4: Regression tests** — extend `src/test/unit/components/machines/settings/inline-editable-text.test.tsx`:

```tsx
it("an OPTIONAL field can be cleared to empty (propagates the clear)", async () => {
  const onValueChange = vi.fn();
  render(
    <InlineEditableText
      value="Bank A"
      onValueChange={onValueChange}
      canEdit
      ariaLabel="bank name"
    />
  );
  const input = screen.getByRole("textbox", { name: /bank name/i });
  await userEvent.clear(input);
  await userEvent.tab(); // blur → commit
  expect(onValueChange).toHaveBeenCalledWith("");
});

it("a REQUIRED field shows the asterisk placeholder and is aria-required", () => {
  render(
    <InlineEditableText
      value=""
      onValueChange={vi.fn()}
      canEdit
      required
      placeholder="Name this set"
      ariaLabel="set name"
    />
  );
  const input = screen.getByRole("textbox", { name: /set name/i });
  expect(input).toHaveAttribute("aria-required", "true");
  expect(input).toHaveAttribute("placeholder", "Name this set *");
});
```

- [ ] **Step 5:** `pnpm exec vitest run src/test/unit/components/machines/settings/inline-editable-text.test.tsx` → PASS.
- [ ] **Step 6: Commit.**

---

## Task 5: `EditableCell` placeholder contrast **[APPLIED]** 🟡 (I2)

**Files:**

- Modify: `src/components/machines/settings/EditableCell.tsx`

- [x] **Step 1 (applied):** the editor placeholder span changed from `text-muted-foreground/60` (~2.8:1) to full `text-muted-foreground` (~7:1 on the dark surface) so the only cue for what a blank cell expects clears WCAG 1.4.3. The decorative read-only em-dash (line ~159) intentionally stays `/60`.
- [ ] **Step 2: Review** — confirm only the editable-cell placeholder changed; em-dash unchanged.
- [ ] **Step 3:** visual/no test needed; `pnpm run check`.
- [ ] **Step 4: Commit** (batched with Task 6 — a11y polish).

---

## Task 6: `ConfirmingDeleteButton` — remove misused `title` **[APPLIED]** 🟡 (I3)

**Files:**

- Modify: `src/components/machines/settings/ConfirmingDeleteButton.tsx`

- [x] **Step 1 (applied):** removed `title={armed ? "Tap again to confirm" : undefined}` (CORE-A11Y-005: `title` is not a tooltip — invisible on touch/keyboard). The armed state is still conveyed by the destructive color class **and** the live `aria-label` (`… — activate again to confirm`).
- [ ] **Step 2: Review** — confirm the armed `className` color cue and `aria-label` swap remain; no info is now conveyed by color alone to a screen reader (aria-label covers it).
- [ ] **Step 3:** existing `ConfirmingDeleteButton`/section-delete tests still pass; `pnpm run check`.
- [ ] **Step 4: Commit** (batched with Task 5).

---

## Task 7: `SettingsTab.today()` → local date **[APPLIED]** 🟢 (A4)

**Files:**

- Modify: `src/components/machines/settings/SettingsTab.tsx`

- [x] **Step 1 (applied):** `today()` builds the local `YYYY-MM-DD` (year/month/day) instead of `new Date().toISOString().slice(0,10)` (UTC), which showed tomorrow's date for negative-UTC editors late in the evening until reload.
- [ ] **Step 2: Review** — confirm zero-padding and that this is display-only (the server still writes the authoritative `updatedAt`).
- [ ] **Step 3:** `pnpm run check`.

---

## Task 8: `use-settings-save-queue` — remove dead cleanup branch **[APPLIED]** 🟢 (A3)

**Files:**

- Modify: `src/components/machines/settings/use-settings-save-queue.ts`

- [x] **Step 1 (applied):** removed the unreachable `if (waiters.length === 0) { queues.current.delete(key); }` (every `persist` registers a waiter, so it was never empty at settle). Idle entries are reclaimed by `forget()` on delete; the comment now states this.
- [ ] **Step 2: Review** — confirm settling still resolves all waiters and the rekey path is unaffected.
- [ ] **Step 3:** `pnpm exec vitest run src/test/unit/components/machines/use-settings-save-queue.test.ts` → PASS.
- [ ] **Step 4: Commit.**

---

## Task 9: `SettingsTab` — nav guard covers the machine-level fields **[APPLIED]** 🟡 (B1, parent half)

**Files:**

- Modify: `src/components/machines/settings/SettingsTab.tsx`

The page-level `useUnsavedChangesGuard` only watched `editingUnits` (the sets). The two always-open `InlineEditableField`s hold their drafts internally, so an unsaved owner-requests / how-to-change draft was lost on nav without a warning.

- [x] **Step 1 (applied):** added dirty state + stable callbacks, and folded them into the guard:

```tsx
const [machineFieldDirty, setMachineFieldDirty] = useState({
  requests: false,
  instructions: false,
});
const onRequestsDirty = useCallback((dirty: boolean): void => {
  setMachineFieldDirty((p) =>
    p.requests === dirty ? p : { ...p, requests: dirty }
  );
}, []);
const onInstructionsDirty = useCallback((dirty: boolean): void => {
  setMachineFieldDirty((p) =>
    p.instructions === dirty ? p : { ...p, instructions: dirty }
  );
}, []);
useUnsavedChangesGuard(
  canEdit &&
    (anyUnitDirty ||
      machineFieldDirty.requests ||
      machineFieldDirty.instructions)
);
```

- [x] **Step 2 (applied):** `onDirtyChange={onRequestsDirty}` and `onDirtyChange={onInstructionsDirty}` wired onto the two `InlineEditableField` instances.
- [ ] **Step 3: Review** — confirm callbacks are `useCallback`-stable (so the child effect doesn't churn) and the equality guard prevents redundant renders.
- [ ] **Step 4: Regression test (B1)** — extend `src/test/unit/components/machines/SettingsTabDirty.test.tsx`:

```tsx
it("arms the unsaved-changes guard when a machine-level field becomes dirty", async () => {
  // render SettingsTab with empty settingsRequests, canEdit
  // type into the "Before you change anything" editor
  // assert window 'beforeunload' is now prevented (guard armed) — mirror the
  // existing anyUnitDirty test's assertion style in this file.
});
```

- [ ] **Step 5:** `pnpm exec vitest run src/test/unit/components/machines/SettingsTabDirty.test.tsx` → PASS.
- [ ] **Step 6: Commit.**

---

## Task 10: `SettingsTab.execute()` — atomic-commit data loss **[APPLIED]** 🔴 (A1)

**Files:**

- Modify: `src/components/machines/settings/SettingsTab.tsx` (the `execute` callback)

**The bug:** saving a section while a brand-new set's first insert is still in flight dropped the section silently. `execute` deleted `pendingPayloadsRef[temp]` unconditionally on success and rekeyed `temp→real`; the queue's coalesced rerun called `execute(real)`, found no payload, and returned `ok` without writing — yet the new-set baseline was built from the _full working copy_, so the section looked committed locally but never reached the DB (lost on reload).

**The fix (two halves):**

- [x] **Step 1 (applied, a): don't discard a newer staged payload; carry it to the real id**

```tsx
const stagedNow = pendingPayloadsRef.current.get(setId);
const newerPending = stagedNow && stagedNow !== payload ? stagedNow : null;
if (!newerPending) pendingPayloadsRef.current.delete(setId);
// in the isNew && realId !== setId branch:
if (newerPending) {
  pendingPayloadsRef.current.delete(setId);
  pendingPayloadsRef.current.set(realId, {
    ...newerPending,
    name: payload.name, // header we just inserted is authoritative
    description: payload.description,
  });
}
```

- [x] **Step 2 (applied, b): baseline the new set from the SENT slice, not the full working copy**

```tsx
const persisted = setsRef.current.find((s) => s.id === realId);
if (persisted) {
  baselineRef.current.set(realId, {
    ...persisted,
    name: payload.name,
    description: payload.description,
    sections: payload.sections.map(cloneSectionDeep), // [] for a header insert
  });
}
```

- [ ] **Step 3: Review (highest scrutiny)** — verify: (a) existing-set path still clears its payload when no newer one arrived and leaves a newer one for the rerun; (b) `newerPending` only triggers on a _different_ staged object (`!==`); (c) sections unsaved at header-insert time stay dirty against the new baseline (they require their own Save); (d) no regression to the temp→real rekey of `editingUnits`/`savingUnits`/`unitErrors`.
- [ ] **Step 4: Integration regression test (A1)** — add to `src/test/integration/machine-settings-actions.test.ts` a test that drives the _island executor ordering_ OR, more cheaply, an RTL test in `SettingsTabDirty.test.tsx` that: creates a new set, Saves the header with a deferred (manually-resolved) action promise, Saves a section while the insert is pending, resolves the insert, and asserts the section's payload is persisted (the action is called a second time with the section in `sections`). Mirror the existing save-queue test's deferred-promise pattern.
- [ ] **Step 5:** `pnpm exec vitest run src/test/unit/components/machines/use-settings-save-queue.test.ts src/test/unit/components/machines/SettingsTabDirty.test.tsx` → PASS.
- [ ] **Step 6: Commit** (its own commit — this is the data-loss fix).

---

## Task 11: Restore the preset-overwrite-confirm test **[PENDING]** 🟡 (B2)

**Files:**

- Modify: `src/test/unit/components/InlineEditableFieldPresets.test.tsx`

The rework deleted the only test covering the "Replace current text?" `AlertDialog` (`applyPreset` → `pendingPreset` → `confirmPreset`), but that data-loss-prevention path is still live and now untested.

- [ ] **Step 1: Write the test**

```tsx
it("confirms before a preset overwrites existing editor content", async () => {
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  const presets = [
    {
      key: "stern",
      label: "Stern",
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Stern path" }],
          },
        ],
      },
    },
  ];
  const filled = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "my custom note" }],
      },
    ],
  };
  render(
    <InlineEditableField
      label="How to change settings"
      value={filled}
      machineId="m1"
      canEdit
      onSave={onSave}
      presets={presets}
      openWhenEmpty
      headingProminent
    />
  );
  await userEvent.click(
    screen.getByTestId("machine-settings-instructions-edit")
  ); // open
  await userEvent.click(
    screen.getByTestId("machine-settings-instructions-preset-trigger")
  );
  await userEvent.click(
    screen.getByTestId("machine-settings-instructions-preset-stern")
  );
  // existing content present → confirm dialog, not an immediate replace
  expect(screen.getByText("Replace current text?")).toBeInTheDocument();
  expect(screen.getByText("my custom note")).toBeInTheDocument(); // not yet replaced
  await userEvent.click(
    screen.getByTestId("machine-settings-instructions-preset-confirm")
  );
  // after confirm, the preset text is in the editor
  expect(screen.getByText("Stern path")).toBeInTheDocument();
});

it("inserts a preset directly when the editor is empty (no confirm)", async () => {
  // open empty field, pick preset → no "Replace current text?" dialog, text inserted
});
```

- [ ] **Step 2:** `pnpm exec vitest run src/test/unit/components/InlineEditableFieldPresets.test.tsx` → first run may need test-id/selectors aligned to the harness; iterate until PASS.
- [ ] **Step 3: Commit.**

---

## Task 12: Decision — the `as ProseMirrorDoc` cast **[PENDING / DECISION]** 🟢 (C1)

**Files:**

- Read: `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts:128` (and the requests/instructions actions)

The actions validate with `proseMirrorDocSchema.nullable()` then cast `parsed.data.value as ProseMirrorDoc | null` (CORE-TS-007 flags `as`). The value **is** runtime-validated (`type: "doc"` confirmed), and this is the **same grandfathered pattern** as `saveSettingsSetAction` (`description as ProseMirrorDoc | null`, line 128) and the comment actions.

- [ ] **Step 1: Decision (needs Tim, or default).**
  - **Recommended — keep as-is + a one-line comment** matching the sibling actions. Diverging a single new action from the established validated-cast pattern adds inconsistency; a real fix means retyping the shared `proseMirrorDocSchema` (broad churn across many call sites), which belongs in its own cleanup, not this PR.
  - Alternative — add a `parseProseMirrorDoc()` helper in `~/lib/tiptap/types.ts` that returns `ProseMirrorDoc | null` from validated Zod output, and use it in all three actions (settings, requests, instructions). Larger, but removes the `as` everywhere consistently.
- [ ] **Step 2:** apply the chosen option; `pnpm run check`.

---

## Task 13: (Optional) collapse `openWhenEmpty` + `headingProminent` into one variant **[PENDING / OPTIONAL]** 🟢 (Cl6)

**Files:**

- Modify: `src/components/inline-editable-field.tsx`, `src/components/machines/settings/SettingsTab.tsx`

The two booleans always travel together and `openWhenEmpty` fans out into four behaviors. A `variant: "section" | "inline"` prop would prevent illegal combinations.

- [ ] **Step 1: Decision (needs Tim, or default to SKIP).** Recommended **skip for this PR** — it's a non-behavioral API tidy on a component already heavily edited this session; bead it as a follow-up to avoid churn risk. If approved, introduce `variant` deriving the internal booleans, update both call sites, keep behavior identical.

---

## Task 14: Full verification gate **[PENDING]**

- [ ] **Step 1:** `pnpm run check` → green (this settles the spurious LSP `JSX.IntrinsicElements` / `no default export` diagnostics — the real compiler is the arbiter; PP-4k76).
- [ ] **Step 2:** `pnpm run preflight` (schema/migration in scope → full gate incl. build + integration) → green.
- [ ] **Step 3 (optional):** `pnpm exec playwright test e2e/full/machine-settings.spec.ts --project=chromium` → green.
- [ ] **Step 4: Commit** any test additions; confirm `git status` shows only intended files.

---

## Out of scope / deferred (file as beads, do NOT fix here)

- **Refuted, not bugs:** the "formatting-only edit hides Save" (A5/C2 — explicit edits set `isEditing=true`, so Save always shows) and "applyPreset dropped `setIsEditing`" (B6 — presets only render inside an open editor). No action.
- **Broader concurrency race (discovered while fixing A1):** the per-unit model + queue coalescing means saving _two different units_ of the **same** set within one network round-trip keeps only the last-staged unit's slice (each `buildUnitPayload` starts from the not-yet-advanced baseline). A1's fix covers the new-set header+section case; the general N-unit case is a deeper redesign. **File a bead** (P2) — note it's pre-existing to this session's edits.
- **Lower-severity UX/a11y not fixed:** B4 (the empty-state edit pencil is opacity-0 until hover/focus — touch discoverability for the name/description/notes callers), B5 (`sectionSliceDirty` returns false for a section missing from the working copy — narrow), I5 (focus `select()` on multi-field edit), I6 (read-only "Add row" hidden via `invisible+aria-hidden+tabIndex` vs `inert`). **File a bead** (P3) for the batch.
- **Housekeeping:** `pnpm install` (after the dep-bump merge) re-touched `pnpm-lock.yaml` (~42 lines). Decide before committing whether to keep the re-resolution or `git checkout pnpm-lock.yaml` to the merged version — it should NOT ride along with the settings fixes.
- **Already-applied turn-1 placeholder polish (verify in review):** italic Tiptap placeholder (`src/app/globals.css`), taller always-open box (`min-h-[140px]`) and preset-under-title in `inline-editable-field.tsx`, shortened section-1 / preset-referencing section-2 placeholder copy in `SettingsTab.tsx`.
