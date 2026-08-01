---
name: pinpoint-ui
description: shadcn/ui patterns, Server Action forms, Server Components, Client Components, form handling, Tailwind CSS v4, accessibility. Also the Radix Select form-reset footgun (useActionState dispatch, PP-0fvr/PP-1ajq), CREATE form reset (return-redirect + dual-pass reset), the native `<select>` stale-option-ID silent fallback (PP-lql), authoring config-driven enums with rich metadata (labels/icons/styles), discriminated-union component props, Server Action conventions (`Action` suffix, `checkPermission`, `Result`, `serverActionError`), colocated data access with React `cache()` and `revalidatePath`, derived machine status, and why `console.*` is correct inside client components. Use when building UI, forms, components, badges, server actions, or data fetching, or when user mentions UI/styling/components/forms/enums/dropdowns/logging.
---

# PinPoint UI Guide

## When to Use This Skill

Use this skill when:

- Building or modifying UI components
- Creating forms
- Working with shadcn/ui components
- Styling with Tailwind CSS v4
- Implementing Server Action forms, or resetting a CREATE form after a successful submit
- Any form that contains a Radix/shadcn `Select` (read **Server Action Forms** first — this is the codebase's biggest footgun)
- Deciding between Server and Client Components
- Authoring a new config-driven domain enum, or a badge component that renders several enum types
- Writing a Server Action or a colocated data-access module
- User mentions: "UI", "component", "form", "styling", "Tailwind", "shadcn", "button", "input", "select", "dropdown", "badge", "enum", "server action", "form reset"

## Quick Reference

### Critical UI Rules

1. **Server Components first**: Default to Server Components, use "use client" only for interactivity
2. **Honest failure** (CORE-ARCH-012): a control that cannot perform its action must not report that it did — never a success confirmation for input that could not have been collected. There is no no-JS requirement.
3. **shadcn/ui only**: No MUI components
4. **Direct Server Action references**: No inline wrappers in forms
5. **Dropdown Server Actions**: Use `onSelect`, not forms
6. **Tailwind CSS v4 + semantic tokens**: Use `bg-primary`, `text-destructive`, etc. — no raw palette classes (`bg-cyan-500`, `text-red-500`) and no hardcoded hex (enforced via ESLint `better-tailwindcss/no-restricted-classes`)
7. **TooltipProvider is hoisted**: `<TooltipProvider>` is mounted once in `ClientProviders` — don't add nested providers. See `pinpoint-design-bible` §12.
8. **Baseline Widely available is the floor** (CORE-UI-005): use `<dialog>`, container queries, `:has()`, `:user-invalid`, `inert`, `aspect-ratio`, `fetchpriority`, native form validation directly — no polyfills. Newly-available features (Popover API, View Transitions, anchor positioning) require a per-feature opt-in in `pinpoint-design-bible` §19. Never trust a cached Baseline date — look it up live (`references/browser-support.md`).
9. **Form correctness** (CORE-FORM-001..006): right `type`, correct `autocomplete` token, `:user-invalid` styling, `aria-invalid` blur sync, visible required-field indicator, `enterkeyhint` on sequential mobile fields. Conventions are owned by `pinpoint-design-bible` §20; the code is in `references/form-correctness.md`.
10. **Accessibility floor** (CORE-A11Y-001..006): skip link, `motion-reduce:` paired with animations, semantic `<table>` markup, real `<button>` (no `<div role="button">`), `title` is not a tooltip, `inert` background on modals. See **Accessibility** in `references/accessibility.md`.

## Reference Files

Everything below lives one hop away in `references/`. Load the file you need.

| File                                     | Covers                                                                                 |
| :--------------------------------------- | :------------------------------------------------------------------------------------- |
| `references/browser-support.md`          | How to look up a feature's Baseline status live; pointers to design-bible §19 / §22    |
| `references/key-files.md`                | Component basics, Issue Field Display Order, Key Files Registry, Label Standards       |
| `references/enums-and-props.md`          | Config-Driven Enums, discriminated-union props for multi-type components               |
| `references/form-patterns.md`            | Direct-Server-Action forms, `useActionState` forms, dropdown Server Actions            |
| `references/form-correctness.md`         | Form-correctness code (types, autocomplete, `:user-invalid`), native HTML primitives   |
| `references/styling-and-shadcn.md`       | Tailwind CSS v4 styling, shadcn/ui component patterns, Button variants/sizes/`loading` |
| `references/accessibility.md`            | Accessibility floor (CORE-A11Y-001..006), Animation & Motion                           |
| `references/layout-and-anti-patterns.md` | Layout Patterns, UI Anti-Patterns, External References                                 |

## Color System

- **Use semantic tokens** (`bg-primary`, `text-destructive`, `text-muted-foreground`, `border-success/40`). Raw Tailwind palette classes and hardcoded hex are **forbidden in component code**, enforced by ESLint (`better-tailwindcss/no-restricted-classes`). The token values live in the Tailwind v4 `@theme` block in `src/app/globals.css`; the rule and its two design-layer exceptions are `pinpoint-design-bible` §1.
- Status / severity / priority / frequency colors come from the configs in `src/lib/issues/status.ts` — never freestyle a status color at a call site.
- **PinPoint is dark-only.** `dark:` utility classes are dead code; remove them when you touch a file that still has them.
- **The secondary is teal, and purple is not in the palette** — a purple/fuchsia secondary was removed deliberately (PR #1204) so primary and secondary read as one green-family pairing rather than two competing brands. Do not reintroduce it.
- For the full visual identity (surface hierarchy, glow rules, accessibility constraints) see `pinpoint-design-bible` §1–§2.

## Core UI Patterns

### Server vs Client Components

Server Components are the default (CORE-ARCH-001). `"use client"` marks an **interaction leaf** — the smallest subtree that genuinely needs state, effects, or event handlers. Push it down: a page that renders a list of cards stays a Server Component even when one control inside a card is interactive.

The consequence that bites most often is that `"use client"` is viral downward — everything a client file imports is bundled for the client too. So don't co-locate a data query, a Node-only import, or `~/lib/logger` (which pulls in `fs`) in a file that is or will become a client component.

Canonical page composition and the layout wrappers are in `references/layout-and-anti-patterns.md`.

## Server Action Forms

### The Radix Select carve-out: dispatch directly, never `action={...}`

**This is the single biggest footgun in this codebase.** It caused a P0 (PP-0fvr) and four more live data-loss bugs (PP-1ajq).

`@radix-ui/react-select` >= 2.3.3 attaches a form-`reset` listener that replays `onValueChange` with the Select's **mount-time** value. React 19 auto-resets a `<form action={...}>` once the action settles — **on failure as well as success**, since React only sees that the action returned. Put those together and every Radix Select in the form snaps back about a second after submit.

The remedy is to remove the native submission path: build `FormData` by hand and call the `useActionState` dispatch directly inside `startTransition`. No form submission ever completes, so React never fires the reset.

```tsx
const dispatchForm = (): void => {
  if (!formRef.current) return;
  const fd = new FormData(formRef.current);
  startTransition(() => {
    formAction(fd);
  });
};
```

`startTransition` is not optional — outside a transition React 19 silently skips the Server Action. The reference implementation is the `<form onSubmit={...}>` in `src/app/(app)/report/unified-report-form.tsx`, which also guards `e.target !== e.currentTarget` so a submit bubbling up from a portalled descendant form doesn't get cancelled here (React propagates events through the React tree, not the DOM tree).

How it surfaced in each shape:

- **Auto-submitting from `onValueChange`** (the four inline issue-metadata forms, PP-0fvr): the replay looked like a real user selection and fired a **second write carrying the stale value** — silently reverting every status/priority/severity/frequency change.
- **Submitting from a real button** (edit-machine, create-machine, unified-report, delete-account — PP-1ajq): no bad write, but a **failed** save silently wiped unsaved edits while the form was still on screen. Worst case was delete-account, where a reverted machine-reassignment left the confirmation text intact and the destructive button still enabled — a destructive control armed against a target the user could no longer see.
- **A form with no Select at all** (machine owner transfer, `src/app/(app)/m/[initials]/(tabs)/edit/machine-owner-transfer.tsx` — PP-o355.19): this section is named for the Radix Select because that is the common case, but **Radix is only one symptom riding on React's reset**. Here a native reset blanked the form's _controlled_ hidden `id`/`name` inputs in the DOM without re-rendering React — the state behind them never changed, so React had no reason to re-sync — leaving a second attempt after a failed transfer to submit an **empty machine id**. If your form carries controlled hidden inputs, it has this bug whether or not a Select is anywhere near it.

Three things worth knowing before you try to fix this some other way:

- **Making the Select controlled does not help.** Radix's replay calls `onValueChange`, so the stale value is written straight into your state — the controlled path is the very path the replay travels.
- **Mocking `useActionState` is why this stayed invisible to a green suite for five days.** The regression guards (`src/test/unit/components/{issues,machines,settings,report}/*revert*.test.tsx`, plus the co-located `src/app/(app)/m/[initials]/(tabs)/edit/machine-details-form.test.tsx` for the machine Manage tab) deliberately mock neither `react` nor the Select wrappers. Keep it that way: a test that mocks `useActionState` or the Select wrapper cannot observe the reset, and will pass while the bug is live.
- **"No Select" is not a clean bill of health.** See the owner-transfer case above — reach for this remedy whenever a form's values live anywhere React won't re-render on reset, not just when Radix is present.

This is the form-level surface of CORE-ARCH-012 (honest failure).

### Silent stale-value submission: native `<select>` + a stale option ID (PP-lql)

Same failure family — a value the user never chose gets submitted without any visible error.

A controlled native `<select value="X">` whose `value` does not match any `<option>` does **not** error or render visibly broken — browsers display the first non-disabled `<option>` and `FormData.get(name)` returns its value. This is HTML-spec behavior, not a React bug.

This combines disastrously with localStorage-backed drafts: if the saved ID references a record that has since been deleted (or that belongs to a different tenant after a session change), restoration silently puts the form into a state where the dropdown shows — and submits — the alphabetically-first record. The Zod `uuid()` schema and any "does this id exist?" server checks both pass, because the submitted UUID _is_ a valid record. The user never sees an error, and an entity is created against the wrong target.

**Mitigation** (apply when restoring an option-ID from localStorage or any other side channel): validate the restored ID against the live options list before writing it into state, and add a defense-in-depth effect that clears the selection whenever the current value is absent from the list. Regression coverage lives at `src/app/(app)/report/select-fallback.test.tsx` (JSDOM unit test pinning the HTML behavior) and `e2e/full/report-stale-machine.spec.ts` (seeds a stale draft, asserts an empty placeholder and a refusal to submit).

**Better long term**: replace native `<select>` with the project's shadcn `Select` for any field whose options come from a list that can change between sessions — the command-palette pattern surfaces "no match" instead of silently picking the first option.

### CREATE form reset

Applies to CREATE forms only. Edit forms typically navigate or close on success, so they don't need this. A CREATE form is "fully reset" when, on successful submit:

1. The Server Action **returns** `ok({ ..., redirectTo })` — it does **not** call `redirect()` server-side.
2. A `useEffect` watching `state?.ok` (or `state.success`) runs `formRef.current?.reset()`, then explicit `setState("")` / `setState(null)` for every controlled field, plus a key bump on uncontrolled child editors (e.g. `RichTextEditor`) to remount them.
3. **Then** `window.location.assign(state.value.redirectTo)`.

The **return-redirect** requirement is the load-bearing piece. When a Server Action calls `redirect()` server-side, Next.js throws a redirect error that propagates **before** `useActionState` returns success to the client, so the cleanup `useEffect` never fires. Returning `redirectTo` shifts the redirect to the client and lets cleanup run first.

**Ordering inside the effect matters (PP-1ajq): `formRef.current.reset()` must run _before_ the explicit `setState` clears.** `reset()` synchronously fires the form-`reset` event, and Radix answers it by replaying each Select's mount-time value through `onValueChange`. Everything in the effect is one React batch, so whichever update is queued last wins — reset first and the stale replay is superseded by your clears; clear first and the replay overwrites them. See the commented `resetSingleForm` in `src/app/(app)/report/unified-report-form.tsx` for the worked case.

**Why both passes are needed:**

| Field type                                                | Cleared by `formRef.reset()`?                              |
| :-------------------------------------------------------- | :--------------------------------------------------------- |
| Native `<input>`, `<textarea>`, `<select>` (uncontrolled) | ✅                                                         |
| Native fields rendered with `value={...}` (controlled)    | ❌ — React re-renders the value back                       |
| shadcn/ui `Select`                                        | ❌ — internal state is React, hidden input is React-driven |
| `RichTextEditor` (TipTap) `content` prop                  | ❌ — internal editor state must be remounted via `key`     |
| Image-upload arrays (`useState<ImageMetadata[]>`)         | ❌ — pure React state                                      |

Native reset clears the form's DOM state; explicit `setState` clears React's view of every controlled field.

**Three valid reset strategies**, pick per form:

- **Dual-pass in an effect** — the default above. `src/components/issues/AddCommentForm.tsx` is the cleanest example: Result type, stays mounted on success, `formRef.reset()` + clears controlled state.
- **Remount on reopen** — for dialogs, put the form (and its `useActionState`) in a child that mounts with the dialog content, so every open starts clean. `src/components/users/InviteUserDialog.tsx` does exactly this; its comment says so.
- **Navigate away** — the redirect unmounts the form, so nothing needs clearing.

**Optional Clear button**: for long CREATE forms (≥3 fields), add one next to Submit, always gated behind an `<AlertDialog>` — the user just typed several fields. Reuse the same reset helper the success effect uses. Skip it for single-field forms and for dialogs that reset on close.

**Edge cases**: preserve URL-derived defaults across reset (`?machine=MM` → reset to `defaultMachineId ?? ""`, not `""`); clear localStorage drafts in the same effect and make the save-draft effect short-circuit on success so it doesn't race the reset; for a child that owns its own selection state (like `OwnerSelect`), bump a `key` to remount it.

**E2E coverage**: every CREATE form needs at least one assertion that, after a successful submit, every field reads back empty/placeholder. For forms that navigate away, submit → wait for redirect → navigate back → assert empty. See `e2e/full/form-resets.spec.ts`.

## Server & Data Conventions

### Server Actions

- Exported server actions are **suffixed `Action`** — `createMachineAction`, `markAsReadAction`. This is the house style for new code, not a universal invariant: a set of older actions under `src/app/**/actions.ts` predate the convention. Name new actions with the suffix; **don't** rename existing ones to match (the rename is churn with a real chance of missing a call site), and **don't assume an unsuffixed export isn't a Server Action** — several are wired straight into `useActionState`.
- Every action checks authorization through `checkPermission()` from `~/lib/permissions/helpers` (CORE-ARCH-008). Never hand-roll a role comparison. `pinpoint-security` has the full auth/permission gate walkthrough.
- Actions return `Result<T, C>` from `~/lib/result.ts` (`ok(...)` / `err(...)`), not thrown exceptions, so `useActionState` can render the failure.
- Report failures through `serverActionError()` from `~/lib/observability/report-error` rather than a bare `console.error` — that's what routes the error to Sentry with action context.
- Zod schemas live in a separate `schemas.ts` next to the action (a Next.js requirement — `"use server"` files may only export async functions).

### Data access

Data access lives in **colocated** `_data.ts` / `queries.ts` files next to the route that uses it, wrapped in `cache()` from React so a layout and its page don't double-hit the DB in one render pass. There is **no** `src/server/data-access/` directory — don't create one.

Revalidate with `revalidatePath` — that's the convention throughout. `revalidateTag` has **zero** usages in `src/`; if you think you need it, you're introducing a second caching convention.

### Machine status is derived, never stored

There is no `status` column on the `machines` table — a machine's operational status is computed at read time from its open issues. `src/lib/machines/status.ts` is the source of truth for the algorithm and the label/style helpers. Read it rather than reimplementing or restating the rules; an earlier prose copy of this algorithm drifted until it was behaviorally wrong. Query only the columns the derivation needs (`status`, `severity`) when loading issues for it.

### Logging

`docs/LOGGING.md` is canonical — read it for the structured-logging conventions (`log.info` / `log.warn` / `log.error` from `~/lib/logger`, context fields, never log PII).

One UI-specific fact that lives here: **`~/lib/logger` imports `mkdirSync` from `"fs"`, so it cannot be imported into a Client Component.** `console.*` is therefore correct and expected inside `"use client"` files. Don't "fix" a console call in a client component by swapping in `~/lib/logger`; that breaks the build.

## UI Checklist

Before committing UI code:

- [ ] Server Components by default (only "use client" when needed)
- [ ] No control reports success for an action it could not perform (CORE-ARCH-012)
- [ ] Direct Server Action references (no inline wrappers)
- [ ] Dropdowns use `onSelect` for Server Actions
- [ ] CSS variables, no hardcoded colors
- [ ] `cn()` used for className merging
- [ ] Semantic HTML (nav, main, article, etc.)
- [ ] ARIA labels for icon-only buttons
- [ ] Responsive design (mobile-first)
- [ ] shadcn/ui components only (no MUI)
- [ ] Input fields carry the correct `type` and `autocomplete` token (CORE-FORM-001, 002)
- [ ] Multi-field forms set `enterkeyhint` per field (CORE-FORM-006)
- [ ] Required fields have a visible `*` indicator (CORE-FORM-005)
- [ ] Every `animate-*` or non-essential `transition-*` pairs with `motion-reduce:` (CORE-A11Y-002)
- [ ] No `<div role="button">` introduced (CORE-A11Y-004)
- [ ] No `title="..."` as a tooltip (CORE-A11Y-005)
- [ ] If you added a sortable table: `<th scope="col">`, `aria-sort`, accessible name (CORE-A11Y-003)
- [ ] If you added an image with `priority`: it is the LCP candidate for the page's dominant viewport, and `sizes` is set (CORE-PERF-003)
- [ ] If you added an animation, dialog, or layout pattern: searched `modern-web-guidance` for the Widely-available primitive first (CORE-UI-006)
