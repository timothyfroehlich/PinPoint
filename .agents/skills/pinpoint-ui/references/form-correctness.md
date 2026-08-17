# Form Correctness & Native HTML Primitives

`pinpoint-design-bible` §20 owns the CORE-FORM-001..006 conventions — required input attributes, the autocomplete token table, validation-feedback timing, submit-button state. Read it for the rules.

This file holds only the two things §20 can't: the shared primitives' validation boundary, and when a native platform primitive is the right answer instead of a shadcn component.

## Where validation styling lives — and where it deliberately doesn't

`:user-invalid` styling and the blur-time `aria-invalid` sync are implemented **once, in the shared primitives**: `src/components/ui/input.tsx` and `src/components/ui/textarea.tsx`. Read those two files rather than a description of them; both are short. Never copy either treatment to a call site.

Two boundaries are decisions rather than facts you can read off, so they're recorded here:

**`select.tsx` is deliberately excluded, and "finishing the job" there is a mistake.** The shadcn `Select` trigger is a Radix `<button>`, not a form control: it has no native validity state, so `:user-invalid` can never match and `checkValidity()` has nothing to report. Invalid state on a Select is caller-driven — pass `aria-invalid` to `<SelectTrigger>`, which already styles it. If you find yourself adding a blur handler to `select.tsx`, stop; the mechanism you want is the caller's.

**A caller that passes `aria-invalid` owns it end to end.** The primitives' blur handler stands down when the caller supplies the attribute, so a Server Action's or schema's verdict survives instead of being overwritten by the browser's weaker `checkValidity()` result. Don't "fix" the guard — it exists because the two validation sources disagree, and the richer one should win.

## Native HTML primitives alongside shadcn/Radix

**shadcn/Radix is the design system.** It owns Dialog, AlertDialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, Accordion. It does **not** own form state — the shadcn `Form` shim was deleted in PP-8hl8 along with `react-hook-form`, because nothing used it; forms are plain `<form onSubmit>` + Server Actions. Don't migrate components off Radix to chase native primitives — Radix delivers consistent variants, theming, focus trapping, animation, and one tested behavior across the app.

The platform's Widely-available primitives **complement** that stack. Reach for them in two situations: a one-off use that doesn't deserve a new shadcn variant, or an attribute that drops straight onto a shadcn component and strengthens it.

**Native `<dialog>` is not the default.** `<dialog>.showModal()` ships a focus trap, the top layer, and `::backdrop` for free, but product UI uses shadcn `<Dialog>` / `<AlertDialog>` / `<Sheet>` / `<Drawer>`. Reach for native only for one-off, self-contained surfaces that would never earn a variant — a debug-only inspector, an `<a href="#fragment">`-driven help blurb. If a Radix modal is doing its job, leave it.

**`<details>` + `<summary>` for trivial disclosure.** Collapsible content that doesn't animate and doesn't need `<Accordion>`'s visual treatment — debug panels, an inline "show more" — uses the native pair: keyboard- and SR-accessible with zero JS. Anything that is part of the product UI (FAQs, settings panels, content sections) uses `<Accordion>`.

**Native validation layers with shadcn, it doesn't compete.** `<Input>` forwards `required`, `pattern`, `minLength`, `maxLength`; the browser validates, `:user-invalid` styles the result, and `useActionState` covers cross-field and server-side checks.

(`inert` on modal backgrounds — CORE-A11Y-006 — is in `references/accessibility.md` with the rest of the a11y floor.)
