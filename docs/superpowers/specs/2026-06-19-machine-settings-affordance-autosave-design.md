# Machine Settings — editable-affordance redesign + auto-save pivot (design decisions)

**Date:** 2026-06-19 · **Feature:** PP-43q3 + PP-8a5r · **Branch:** `feat/machine-settings-tab-scaffold-PP-43q3` · **PR:** #1388 (open, not merged)
**Status:** decisions LOCKED by Tim. This is the brainstorming output that feeds `writing-plans`.

## Context / problem

A friend manually reviewed the Machine Settings tab on desktop + Android and surfaced 7 issues the E2E suite missed (E2E gap tracked separately in **PP-jn45**). The two structural ones — a confusing **two-Save model** (a per-row/sheet "Save" that only buffered into a working copy, plus a section-level "Save" that actually persisted) and editable fields that **didn't look editable** (a hover-only pencil, invisible on touch) — drove a decision to **pivot the whole edit model to auto-save** and give editable fields a clear, on-brand resting affordance. Tim + Neil both want auto-save. The dislike of the prior "always-open editors" was the _look_, not the always-open behavior — so the fix is auto-save + fields that visibly read as editable.

## The locked decision

### A. Edit model — always-live inputs + auto-save (THE load-bearing change)

- Editable fields are **always live inputs** for permitted users (the field _is_ the input). **No edit mode. Remove every Edit / Save / Cancel button** (header-unit edit, section edit/save/cancel, the mobile sheet's "Save" as a buffer-commit). A permitted user just types and it saves.
- This dissolves three reported bugs for free: **#1 double-Save** (no Save button), **#3 collapsed-set "Edit" only edits the title** (no Edit button — expand a set and every field is directly editable), **#5 Tab needs Enter to type** (cells are real inputs, Tab lands ready to type).
- Read-only viewers (no permission) see **clean static text** — none of the input chrome/affordance.

### B. The resting affordance (Tim's final words, verbatim)

> Editable fields signal editability at rest with a pure-black inset field (a 'display' box that reads on any dark surface), glowing primary text that fades in on hover (neon text-shadow ~55%), a 1px outline border, a bright ring/50 focus ring. Apply to table cells, inline single-line text, and rich-text blocks; identical on desktop + touch (no hover dependence); read-only viewers get clean static text.

Concretely:

- **Fill:** pure black (`#000`) inset box behind the value — reads on both the header band (`muted` `#27272a`) and the body (`card` `#18151b`), solving the "shade works on one bg not the other" problem (the old fill used `input` `#27272a`, identical to the header → invisible there).
- **Border:** 1px `outline` border around the box.
- **Text glow:** primary-green (`#4ade80`) neon `text-shadow` (~55%) that **fades in on hover** (desktop delight only; not the cue — the box+border+text is the cue, works on touch with no hover). Use the existing `glow-*` utility family pattern (`globals.css` `@utility glow-primary` = `0 0 10px primary/50, 0 0 20px primary/30`); text glow is a `text-shadow`, fade via a `text-shadow`/`color` transition (~0.3s), `motion-reduce:` paired.
- **Focus:** bright `ring/50`, 3px focus ring (matches the shared `Input`).
- Apply uniformly to: table cells (`EditableCell`), inline single-line text (`InlineEditableText` — set name, table title, DIP bank name), and rich-text blocks (`InlineMarkdownField` / `inline-editable-field` — description, notes, access instructions).

**Design-bible amendment (scoped, NOT a reversal):** §2 currently bans glow on form controls. Amend to permit glow **as an interactivity affordance on editable fields** — it signals "you can edit this" (fades in on hover/focus), distinct from decorative glow on arbitrary form controls, which stays banned. Update `pinpoint-design-bible` in place (do not append a divergence note).

### C. Auto-save mechanics

1. **Trigger:** text fields save on **blur + ~800ms debounce while typing**; toggles save **immediately**; rich-text on blur/debounce. (Reuse `use-settings-save-queue` — serial per-set queue, coalesce, temp-id→uuid rekey.)
2. **Feedback = failure only.** No success "Saved ✓" indicator. On a failed save, show a **Google-Docs-style banner** ("Some changes couldn't be saved — retrying…/Retry") and **block page navigation** while there are unsaved/failed changes (`beforeunload` + Next App-Router nav guard). Reuse/repurpose `use-field-save-status` / `FieldSaveStatus` for the failure state; the banner is page/tab-level. Never drop typed text on failure; auto-retry + manual retry.
3. **No Cancel/undo.** Auto-save removes "Cancel" — accepted (normal in-field text undo only). Structural deletes still confirm (below).
4. **Structural ops** (add/delete row, add/delete section, reorder) keep **immediate persist** as today.

### D. Mobile

- **Keep the per-row bottom sheet** (`RowEditSheet`) on mobile (dense 4-col tables are miserable to edit inline on a phone) — the sanctioned `use-is-mobile` behavior split (PP-43q3) stays. But: **auto-save inside the sheet** (its "Save" buffer-commit button is removed) and **fix the keyboard occlusion** (bug #2): the sheet body must be **scrollable and keyboard-aware** so the focused field is never hidden behind the on-screen keyboard and the user can reach all fields. Use a `dvh`-based / `interactive-widget`-aware sizing + scrollable content region; verify on a real device via the preview. (E2E can't catch keyboard occlusion — see PP-jn45.)

### E. Delete affordance (bug #4a)

- **Row delete, desktop:** keep the two-tap confirm (`ConfirmingDeleteButton`) but **expand the armed button to ~2x width** with clear copy ("Tap again to delete" / countdown) so the second tap is obvious and easy to hit.
- **Row delete, mobile:** replace two-tap with a **confirm/deny popup** (small AlertDialog).
- **Section delete:** unchanged — keep the existing AlertDialog confirm/deny.

### F. Empty rows (bug #4b)

- A newly-added row is **not persisted until it has content**, and a **fully-empty row** (every field blank) is pruned on blur/navigation. Guard must check the _whole_ row is empty.

## Bug → resolution map

1. Double-Save → removed (auto-save, no Save buttons). **A**
2. Mobile keyboard covers fields / no scroll → fix the sheet (scrollable + keyboard-aware). **D**
3. Collapsed-set "Edit" only edits title → removed (no Edit button; expand → directly editable). **A**
   4a. Two-tap delete not discoverable → desktop 2x-wide armed button; mobile confirm dialog. **E**
   4b. Accidental empty rows → don't persist until non-empty; prune fully-empty rows. **F**
4. Tab needs Enter to edit → cells are real inputs now. **A**
5. Preset pick doesn't replace editor content → fix in `inline-editable-field` preset-confirm path (overwrite the editor value on confirm). Real bug, fix regardless.
6. Save button renders inside the title (custom text/note sections) → mostly auto-resolved once Save buttons are gone; ensure `NoteSection` title/body render as clean editable fields.

- Header alignment: set name vs description boxes share one left edge (already prototyped: chevron in its own column, name/description/audit in a left-aligned column).

## Scope — wave 1 (one shippable slice)

Affordance (B) + always-live-inputs/auto-save (A, C) + mobile sheet fix (D) + delete (E) + empty rows (F) + bugs #6, #7 + header alignment, applied uniformly across the settings components **and the PP-8a5r owner-requests section**. Design-bible §2 amendment.

**Out of scope / follow-ups:** E2E coverage expansion (PP-jn45); the friend's mobile re-test happens on the preview after this lands.

## Key files (this worktree — NOT the main checkout, which is on `main` and lacks these)

- `src/components/machines/settings/EditableCell.tsx` — click-to-edit button → always-live input (black box). Tab/focus.
- `src/components/machines/settings/InlineEditableText.tsx` — single-line always-live input.
- `src/components/machines/settings/InlineMarkdownField.tsx` + `src/components/inline-editable-field.tsx` — rich-text always-editable; remove pencil; fix preset-replace (#6).
- `src/components/machines/settings/RowEditSheet.tsx` — remove buffer-"Save"; auto-save; keyboard-aware scroll (#2).
- `src/components/machines/settings/use-row-edit-sheet.ts` — mobile sheet/add-row state; empty-row pruning hook-in.
- `src/components/machines/settings/SettingsSetCard.tsx` — remove header Edit/Save/Cancel; header alignment; sections render directly editable; delete-button copy.
- `src/components/machines/settings/SettingsTab.tsx` — remove per-unit edit-mode state/handlers; wire auto-save + failure banner + nav block.
- `src/components/machines/settings/SortableSection.tsx` — remove per-section Edit/Save/Cancel; keep grip/kebab/reorder/delete.
- `src/components/machines/settings/ConfirmingDeleteButton.tsx` — desktop 2x armed; mobile confirm dialog variant.
- `src/components/machines/settings/NoteSection.tsx`, `TableSection.tsx`, `DipBankSection.tsx`, `SoftwareSettingsSection.tsx` — propagate always-editable model (drop `editing`/`canEdit`-as-edit-mode in favor of permission-only).
- `src/components/machines/settings/use-settings-save-queue.ts`, `use-field-save-status.ts`, `FieldSaveStatus.tsx` — auto-save queue + failure status + banner.
- `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts` — persistence actions stay; ensure they suit per-field auto-save (idempotent, partial updates).
- Tests: `src/test/unit/components/machines/...`, `src/test/integration/machine-settings-actions.test.ts`, and the new RTL/integration coverage the plan adds. Target the POST-pivot UX.

## Constraints / gotchas

- **Subagents must work in THIS worktree** (`.claude/worktrees/agent-abe71d6b68d9c0273`), not the main checkout (which is on `main` and lacks the branch files — earlier Explore agents tripped on this).
- **Git: commit each task locally to the branch; do NOT push and do NOT merge** without Tim's explicit say-so. Never `--no-verify`. `pnpm run check` is the floor before each commit; run integration tests for any `actions.ts` change. No new DB migration expected (no schema change) → `check` + integration, not full preflight.
- **Don't touch other sessions' files:** `src/server/db/index.ts` (PP-d8l8, merged), `src/services/issues.ts` (PP-qk7s). This wave is the settings UI only.
- **CORE non-negotiables:** `"use client"` only on interaction leaves (CORE-ARCH-001); auto-save is JS-driven — keep server actions as the persistence layer and ensure the read view SSRs without JS (graceful degradation note for the PR, since pure progressive-enhancement forms (CORE-ARCH-002) don't express auto-save). ts-strictest, `~/` aliases, semantic tokens only, no `dark:`. CORE-A11Y (real `<button>`, `<th scope>`/`aria-sort`, `motion-reduce:` on the glow fade, `inert` on background when the mobile sheet/dialog is open), CORE-FORM (input `type`/`autocomplete`, `:user-invalid`, `aria-invalid` on blur), CORE-RESP (CSS over JS; the `use-is-mobile` split is the sanctioned exception).
- Throwaway `playground-editable-affordance.html` at the worktree root captured the affordance exploration — do NOT commit it.
